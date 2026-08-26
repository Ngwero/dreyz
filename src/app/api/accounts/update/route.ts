import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail";
import { generatePassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      status?: "active" | "inactive";
      specialty?: string;
      feeTrackId?: string;
      classOptionId?: string;
      resetPassword?: boolean;
    };

    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing account id." }, { status: 400 });
    }

    const admin = createAdminClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name) patch.name = body.name.trim();
    if (body.email) patch.email = body.email.trim().toLowerCase();
    if (body.phone !== undefined) patch.phone = body.phone.trim() || null;
    if (body.role) patch.role = body.role;
    if (body.status) patch.status = body.status;
    if (body.specialty !== undefined) patch.specialty = body.specialty;
    if (body.feeTrackId !== undefined) patch.fee_track_id = body.feeTrackId;
    if (body.classOptionId !== undefined) patch.class_option_id = body.classOptionId;

    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (body.email) {
      await admin.auth.admin
        .updateUserById(id, { email: body.email.trim().toLowerCase(), email_confirm: true })
        .catch(() => undefined);
    }

    let password: string | undefined;
    if (body.resetPassword) {
      password = generatePassword();
      const { error: pwError } = await admin.auth.admin.updateUserById(id, { password });
      if (pwError) {
        return NextResponse.json({ ok: false, error: pwError.message }, { status: 500 });
      }
      const email = String(body.email ?? "");
      if (email.includes("@")) {
        await sendMail({
          to: email,
          subject: "Your Dreyz Interior password was reset",
          text: `A school administrator reset your portal password.\n\nTemporary password: ${password}\n\nSign in and change it from My Account.`,
        }).catch(() => undefined);
      }
    }

    if (body.status === "inactive") {
      await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch(() => undefined);
    }
    if (body.status === "active") {
      await admin.auth.admin.updateUserById(id, { ban_duration: "none" }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, password });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
