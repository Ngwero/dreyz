import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authEmailHtml, sendMail } from "@/lib/mail";
import { createSixDigitOtp, saveOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, name, status")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "No account found for this email." },
        { status: 404 }
      );
    }

    if (profile.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "This account is inactive. Contact admin." },
        { status: 403 }
      );
    }

    const otp = createSixDigitOtp();
    await saveOtp("reset", email, otp);

    const name = profile.name?.split(" ")[0] || "there";
    await sendMail({
      to: email,
      subject: "Reset your Dreyz password",
      text: [
        `Hi ${name},`,
        ``,
        `Your 6-digit password reset code is: ${otp}`,
        ``,
        `This code expires in 10 minutes. If you didn't request a reset, ignore this email.`,
        ``,
        `— Dreyz Interior Design School`,
      ].join("\n"),
      html: authEmailHtml({
        name,
        intro: "Your 6-digit password reset code is:",
        code: otp,
        note: "This code expires in 10 minutes. If you didn't request a reset, you can ignore this email.",
      }),
    });

    return NextResponse.json({
      ok: true,
      message: `Reset code sent to ${email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[password forgot]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
