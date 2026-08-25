import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStoredOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const code = String(body.code ?? "").replace(/\D/g, "");

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const result = await verifyStoredOtp("login", email, code);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    let hashedToken: string | undefined;
    let emailOtp: string | undefined;
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      hashedToken = data.properties?.hashed_token;
      emailOtp = data.properties?.email_otp;
    } catch (linkErr) {
      console.error("[OTP verify] magic link", linkErr);
    }

    return NextResponse.json({ ok: true, hashedToken, emailOtp });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[OTP verify]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
