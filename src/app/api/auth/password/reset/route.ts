import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OTP_LENGTH, verifyStoredOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const code = String(body.code ?? "").replace(/\D/g, "");
    const password = String(body.password ?? "");

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (code.length !== OTP_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const checked = verifyStoredOtp("reset", email, code);
    if (!checked.ok) {
      return NextResponse.json(checked, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { ok: false, error: "Account not found." },
        { status: 404 }
      );
    }

    if (profile.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "This account is inactive. Contact admin." },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      profile.id,
      { password }
    );

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[password reset]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
