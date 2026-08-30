import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  resolveRukaPayApiKey,
  resolveRukaPayEnvironment,
} from "@/lib/rukapay-server";
import { requireFinance } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAdmissionIdServer } from "@/lib/admission-server";
import { feeTracks, classOptions, schoolInfo } from "@/lib/data";
import { sendMail, welcomeStudentHtml } from "@/lib/mail";
import { portalLoginUrl } from "@/lib/portal-url";
import { currentOpenIntake } from "@/lib/intakes";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function isSuccessStatus(status: unknown) {
  const s = String(status ?? "").toUpperCase();
  return (
    s === "SUCCESS" ||
    s === "SUCCESSFUL" ||
    s === "COMPLETED" ||
    s === "COMPLETE" ||
    s === "PAID"
  );
}

async function settlePaymentByReference(
  partnerReference: string,
  transactionId?: string
) {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("reference", partnerReference)
    .maybeSingle();

  if (!payment) {
    // Also try id pattern used by collect route
    const { data: byId } = await admin
      .from("payments")
      .select("*")
      .eq("id", `PAY-${partnerReference}`)
      .maybeSingle();
    if (!byId) return { settled: false, reason: "payment_not_found" as const };
    return settleRow(admin, byId, transactionId);
  }
  return settleRow(admin, payment, transactionId);
}

async function settleRow(
  admin: ReturnType<typeof createAdminClient>,
  payment: Record<string, unknown>,
  transactionId?: string
) {
  if (String(payment.status) === "confirmed") {
    return { settled: true, reason: "already_confirmed" as const };
  }

  const email = String(payment.learner_email ?? "").toLowerCase();
  const name = String(payment.learner_name ?? "");
  const phone = String(payment.phone ?? "");
  const feeTrackId = String(payment.fee_track_id ?? "4-month");
  const classOptionId = String(payment.class_option_id ?? "weekday");
  const amount = Number(payment.amount) || 0;

  await admin
    .from("payments")
    .update({
      status: "confirmed",
      reference: transactionId || payment.reference,
      rukapay_txn_id: transactionId ?? payment.rukapay_txn_id ?? null,
      credentials_sent: true,
    })
    .eq("id", payment.id);

  if (!email.includes("@") || !name) {
    return { settled: true, reason: "confirmed_no_account" as const };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, learner_id")
    .eq("email", email)
    .maybeSingle();

  const learnerId = await resolveAdmissionIdServer(
    admin,
    email,
    existingProfile?.learner_id ? String(existingProfile.learner_id) : null
  );
  const track = feeTracks.find((t) => t.id === feeTrackId);

  const { data: paidRows } = await admin
    .from("payments")
    .select("amount")
    .eq("learner_email", email)
    .eq("status", "confirmed");
  const paidTotal = (paidRows ?? []).reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0
  );

  await admin.from("learners").upsert(
    {
      id: learnerId,
      name,
      email,
      phone: phone || null,
      course: track?.name ?? "Interior Design",
      enrollment_date: new Date().toISOString().slice(0, 10),
      intake: currentOpenIntake(),
      progress: 0,
      status: paidTotal >= 1_000_000 ? "active" : "paused",
      paid_amount: paidTotal,
      fee_due: track?.total ?? 3_350_000,
      fee_track_id: feeTrackId,
    },
    { onConflict: "id" }
  );

  if (existingProfile?.id) {
    await admin
      .from("profiles")
      .update({
        learner_id: learnerId,
        fee_track_id: feeTrackId,
        class_option_id: classOptionId,
        status: "active",
      })
      .eq("id", existingProfile.id);
    await admin
      .from("payments")
      .update({ student_user_id: existingProfile.id })
      .eq("id", payment.id);
    return { settled: true, reason: "confirmed_existing_user" as const };
  }

  const password = generatePassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student" },
  });
  if (createError || !created.user) {
    return {
      settled: true,
      reason: "confirmed_user_create_failed" as const,
      error: createError?.message,
    };
  }

  await admin.from("profiles").upsert(
    {
      id: created.user.id,
      email,
      name,
      role: "student",
      phone: phone || null,
      status: "active",
      learner_id: learnerId,
      fee_track_id: feeTrackId,
      class_option_id: classOptionId,
    },
    { onConflict: "id" }
  );
  await admin
    .from("payments")
    .update({ student_user_id: created.user.id })
    .eq("id", payment.id);

  const klass = classOptions.find((c) => c.id === classOptionId);
  const loginUrl = portalLoginUrl();
  const extras = [
    `Programme: ${track?.name ?? "Interior Design"}`,
    `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
  ];
  await sendMail({
    to: email,
    subject: "Your Dreyz Interior student login",
    text: [
      `Dear ${name},`,
      ``,
      `Thank you for your payment. Your student account is ready.`,
      ``,
      ...extras,
      ``,
      `Portal: ${loginUrl}`,
      `Email: ${email}`,
      `Temporary password: ${password}`,
      ``,
      `Questions? ${schoolInfo.email}`,
    ].join("\n"),
    html: welcomeStudentHtml({
      name: name.split(" ")[0] || name,
      portalUrl: loginUrl,
      email,
      password,
      extras,
    }),
  }).catch(() => undefined);

  return { settled: true, reason: "confirmed_and_provisioned" as const };
}

/**
 * RukaPay collection callback — settles pending payments and provisions logins.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const partnerReference = String(
      body.partnerReference ?? body.merchant_reference ?? body.reference ?? ""
    ).trim();
    const transactionId = String(
      body.transactionId ?? body.transaction_id ?? body.id ?? ""
    ).trim();
    const status = body.status ?? body.transaction?.status;
    const event = body.event ?? body.type ?? "collection.callback";

    console.info("[RukaPay Webhook]", {
      event,
      partnerReference,
      transactionId,
      status,
    });

    let settle: Awaited<ReturnType<typeof settlePaymentByReference>> | null =
      null;
    if (partnerReference && isSuccessStatus(status)) {
      settle = await settlePaymentByReference(
        partnerReference,
        transactionId || undefined
      );
    } else if (partnerReference && status) {
      const admin = createAdminClient();
      const failed = ["FAILED", "FAILURE", "CANCELLED", "CANCELED", "REJECTED"].includes(
        String(status).toUpperCase()
      );
      if (failed) {
        await admin
          .from("payments")
          .update({ status: "failed" })
          .eq("reference", partnerReference);
        await admin
          .from("payments")
          .update({ status: "failed" })
          .eq("id", `PAY-${partnerReference}`);
      }
    }

    return NextResponse.json({
      received: true,
      partnerReference,
      transactionId,
      status,
      settle,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[RukaPay Webhook]", message);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "rukapay-webhook",
    note: "POST collection callbacks from RukaPay PARTNER_COLLECT_MNO here",
  });
}
