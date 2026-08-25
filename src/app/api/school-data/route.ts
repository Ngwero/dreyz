import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeLiveSchoolData, persistSnapshotRecords } from "@/lib/school-merge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
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
    await admin.from("school_settings").upsert({
      id: "default",
      data: merged,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, data: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, data: {} }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { data?: Record<string, unknown> };
    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    }
    const admin = createAdminClient();
    await persistSnapshotRecords(body.data);
    const merged = await mergeLiveSchoolData(body.data);
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
