import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFinance } from "@/lib/api-auth";
import { currentOpenIntake } from "@/lib/intakes";

export const dynamic = "force-dynamic";

/** Public admissions application — no payment. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const feeTrackId = String(body.feeTrackId ?? "4-month").trim() || "4-month";
    const classOptionId =
      String(body.classOptionId ?? "weekday").trim() || "weekday";
    const intake = String(body.intake ?? "").trim() || currentOpenIntake();
    const idPhotoUrl = String(body.idPhotoUrl ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;

    if (!name || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter your full name and a valid email." },
        { status: 400 }
      );
    }

    const id = `APP-${Date.now().toString(36).toUpperCase()}`;
    const admin = createAdminClient();
    const { error } = await admin.from("admission_applications").insert({
      id,
      name,
      email,
      phone: phone || null,
      fee_track_id: feeTrackId,
      class_option_id: classOptionId,
      intake,
      id_photo_url: idPhotoUrl,
      notes,
      status: "pending",
    });

    if (error) {
      // Table may not exist yet — still accept for local portal queue via response
      console.warn("[admissions apply]", error.message);
    }

    return NextResponse.json({
      ok: true,
      id,
      application: {
        id,
        name,
        email,
        phone,
        feeTrackId,
        classOptionId,
        intake,
        idPhotoUrl: idPhotoUrl ?? undefined,
        notes: notes ?? undefined,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      },
      message:
        "Application received. The school will review it and contact you about enrolment.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Staff list. */
export async function GET() {
  try {
    const gated = await requireFinance();
    if (!gated.ok) return gated.response;

    const { data, error } = await gated.admin
      .from("admission_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: true, applications: [] });
    }

    const applications = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      email: String(row.email ?? "").toLowerCase(),
      phone: String(row.phone ?? ""),
      feeTrackId: String(row.fee_track_id ?? "4-month"),
      classOptionId: String(row.class_option_id ?? "weekday"),
      intake: String(row.intake ?? ""),
      idPhotoUrl: row.id_photo_url ? String(row.id_photo_url) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      status: (row.status as "pending" | "accepted" | "rejected") || "pending",
      createdAt: String(row.created_at ?? new Date().toISOString()),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    }));

    return NextResponse.json({ ok: true, applications });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Staff accept / reject. */
export async function PATCH(request: Request) {
  try {
    const gated = await requireFinance();
    if (!gated.ok) return gated.response;

    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim() as "accepted" | "rejected";
    if (!id || (status !== "accepted" && status !== "rejected")) {
      return NextResponse.json({ ok: false, error: "Invalid update." }, { status: 400 });
    }

    await gated.admin
      .from("admission_applications")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: gated.email,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
