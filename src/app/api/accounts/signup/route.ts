import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, welcomeStudentHtml, enrollmentAlertHtml } from "@/lib/mail";
import { portalLoginUrl } from "@/lib/portal-url";
import { classOptions, feeTracks, schoolInfo } from "@/lib/data";
import { resolveAdmissionIdServer } from "@/lib/admission-server";
import { currentOpenIntake } from "@/lib/intakes";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Public student signup — always creates role=student and emails welcome. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone ?? "").trim() || null;
    const feeTrackId = String(body.feeTrackId ?? "4-month").trim() || "4-month";
    const classOptionId =
      String(body.classOptionId ?? "weekday").trim() || "weekday";
    const requestedPassword = String(body.password ?? "").trim();

    if (!name || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter your full name and a valid email." },
        { status: 400 }
      );
    }

    if (requestedPassword && requestedPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const password = requestedPassword || generatePassword();
    const admin = createAdminClient();

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    const learnerId = await resolveAdmissionIdServer(admin, email);
    const intake =
      String(body.intake ?? "").trim() || currentOpenIntake();

    const paymentAmount = Number(body.paymentAmount ?? 0) || 0;
    const paymentKind = String(body.paymentKind ?? "registration").trim() || "registration";

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "student" },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { ok: false, error: createError?.message ?? "Could not create account." },
        { status: 500 }
      );
    }

    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        name,
        role: "student",
        phone,
        status: "active",
        learner_id: learnerId,
        fee_track_id: feeTrackId,
        class_option_id: classOptionId,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 }
      );
    }

    const track = feeTracks.find((t) => t.id === feeTrackId);
    const klass = classOptions.find((c) => c.id === classOptionId);

    const learnerActive = paymentAmount >= 1_000_000;

    await admin.from("learners").upsert(
      {
        id: learnerId,
        name,
        email,
        phone,
        course: track?.name ?? "Interior Design",
        enrollment_date: new Date().toISOString().slice(0, 10),
        intake,
        progress: 0,
        status: learnerActive ? "active" : "paused",
        paid_amount: paymentAmount,
        fee_due: track?.total ?? 3_350_000,
      },
      { onConflict: "id" }
    );

    if (paymentAmount > 0) {
      await admin.from("payments").insert({
        id: `PAY${Date.now().toString(36).toUpperCase()}`,
        learner_name: name,
        learner_email: email,
        phone,
        fee_track_id: feeTrackId,
        class_option_id: classOptionId,
        amount: paymentAmount,
        method: "mobile_money",
        reference: `${paymentKind}-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        status: "confirmed",
        credentials_sent: true,
        student_user_id: userId,
      });
    }

    const loginUrl = portalLoginUrl();
    const extras = [
      `Programme: ${track?.name ?? "Interior Design"}`,
      `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
    ];

    const text = [
      `Hi ${name.split(" ")[0] || name},`,
      ``,
      `Welcome to Dreyz Interior Design School.`,
      ``,
      `Your student portal is ready.`,
      ...extras,
      ``,
      `Student login`,
      `Portal: ${loginUrl}`,
      `Email: ${email}`,
      `Password: ${password}`,
      ``,
      `Sign in anytime at the portal. You can change your password from My Account.`,
      ``,
      `Questions? ${schoolInfo.email} · ${schoolInfo.phones.join(" / ")}`,
      ``,
      `— Dreyz Interior Design School`,
      `Learn | Design | Inspire`,
    ].join("\n");

    await sendMail({
      to: email,
      subject: "Welcome to Dreyz Interior Design School",
      text,
      html: welcomeStudentHtml({
        name: name.split(" ")[0] || name,
        portalUrl: loginUrl,
        email,
        password,
        extras,
      }),
    });

    const { data: admins } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "super_admin")
      .eq("status", "active");
    for (const adminRow of admins ?? []) {
      if (!adminRow.email || adminRow.email.toLowerCase() === email) continue;
      await sendMail({
        to: adminRow.email,
        subject: `New student signup: ${name}`,
        text: `${name} (${email}) registered for ${track?.name ?? "Interior Design"}. Declared payment: UGX ${paymentAmount.toLocaleString()} (${paymentKind}).`,
        html: enrollmentAlertHtml({
          studentName: name,
          email,
          phone: phone ?? undefined,
          programme: track?.name,
          amount: paymentAmount || undefined,
        }),
      }).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      message: `Welcome to Dreyz Interior — confirmation sent to ${email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[accounts signup]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
