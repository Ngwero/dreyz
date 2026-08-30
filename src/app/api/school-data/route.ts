import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { combineSchoolSnapshots, mergeLiveSchoolData, persistSnapshotRecords } from "@/lib/school-merge";
import { requireSignedIn, requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Any signed-in portal user may read the live school snapshot. */
export async function GET() {
  try {
    const gated = await requireSignedIn();
    if (!gated.ok) return gated.response;

    const admin = gated.admin;
    const { data, error } = await admin
      .from("school_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const snapshot = (data?.data ?? {}) as Record<string, unknown>;
    const merged = await mergeLiveSchoolData(snapshot);
    return NextResponse.json({ ok: true, data: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, data: {} }, { status: 200 });
  }
}

/** Only staff may push/overwrite the school snapshot. */
export async function POST(request: Request) {
  try {
    const gated = await requireStaff();
    if (!gated.ok) return gated.response;

    const body = (await request.json()) as { data?: Record<string, unknown> };
    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    }
    const admin = gated.admin;

    const { data: existingRow } = await admin
      .from("school_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const existing = (existingRow?.data ?? {}) as Record<string, unknown>;
    const combined = combineSchoolSnapshots(existing, body.data);

    await persistSnapshotRecords(combined);
    const merged = await mergeLiveSchoolData(combined);
    const { error } = await admin.from("school_settings").upsert({
      id: "default",
      data: merged,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
