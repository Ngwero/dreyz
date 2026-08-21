import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, welcomeAccountHtml } from "@/lib/mail";
import { classOptions, feeTracks, schoolInfo } from "@/lib/data";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function portalBase(request: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (env) return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env}`;
  return new URL(request.url).origin;
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
    const requestedPassword = String(body.password ?? "");

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

    const learnerId = `DRY${Date.now().toString(36).toUpperCase().slice(-5)}`;

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

    await admin.from("learners").upsert(
      {
        id: learnerId,
        name,
        email,
        phone,
        course: track?.name ?? "Interior Design",
        enrollment_date: new Date().toISOString().slice(0, 10),
        progress: 0,
        status: "active",
      },
      { onConflict: "id" }
    );

    const loginUrl = `${portalBase(request)}/login`;
    const extras = [
      `Programme: ${track?.name ?? "Interior Design"}`,
      `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
    ];

    const text = [
      `Hi ${name.split(" ")[0] || name},`,
      ``,
      `Welcome to Dreyz Interior Design School.`,
      ``,
      `Your student portal account is ready.`,
      ...extras,
      ``,
      `Login details`,
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
      html: welcomeAccountHtml({
        name: name.split(" ")[0] || name,
        roleLabel: "Student",
        portalUrl: loginUrl,
        email,
        password,
        extras,
      }),
    });

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
