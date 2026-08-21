import { NextResponse } from "next/server";
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

    const result = verifyStoredOtp("login", email, code);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[OTP verify]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
