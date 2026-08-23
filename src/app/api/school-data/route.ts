import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const payload = (data?.data ?? {}) as Record<string, unknown>;
    return NextResponse.json({ ok: true, data: payload });
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
    const { error } = await admin.from("school_settings").upsert({
      id: "default",
      data: body.data,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
