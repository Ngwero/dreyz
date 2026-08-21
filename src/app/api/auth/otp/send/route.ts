import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail";

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
      .select("id, email, name, status, role")
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

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !linkData) {
      return NextResponse.json(
        { ok: false, error: linkError?.message ?? "Could not generate OTP." },
        { status: 500 }
      );
    }

    const otp =
      linkData.properties?.email_otp ||
      (linkData as { email_otp?: string }).email_otp;

    if (!otp) {
      return NextResponse.json(
        { ok: false, error: "OTP unavailable. Try password login." },
        { status: 500 }
      );
    }

    const name = profile.name?.split(" ")[0] || "there";
    await sendMail({
      to: email,
      subject: "Your Dreyz login code",
      text: [
        `Hi ${name},`,
        ``,
        `Your one-time login code is: ${otp}`,
        ``,
        `This code expires in a few minutes. If you didn't request it, ignore this email.`,
        ``,
        `— Dreyz Interior Design School`,
      ].join("\n"),
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#082878">
          <p>Hi ${name},</p>
          <p>Your one-time login code is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0">${otp}</p>
          <p style="color:#5b6f94;font-size:14px">This code expires in a few minutes. If you didn't request it, you can ignore this email.</p>
          <p style="margin-top:24px;font-size:13px">— Dreyz Interior Design School</p>
        </div>
      `,
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
