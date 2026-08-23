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

    const otp = createSixDigitOtp(email);
    await saveOtp("login", email, otp);

    const name = profile.name?.split(" ")[0] || "there";
    await sendMail({
      to: email,
      subject: "Your Dreyz login code",
      text: [
        `Hi ${name},`,
        ``,
        `Your 6-digit login code is: ${otp}`,
        ``,
        `This code expires in 10 minutes. If you didn't request it, ignore this email.`,
        ``,
        `— Dreyz Interior Design School`,
      ].join("\n"),
      html: authEmailHtml({
        name,
        intro: "Your 6-digit login code is:",
        code: otp,
        note: "This code expires in 10 minutes. If you didn't request it, you can ignore this email.",
      }),
    });

    return NextResponse.json({
      ok: true,
      message: `Code sent to ${email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[OTP send]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
