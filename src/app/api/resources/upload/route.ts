import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File must be under 8 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `handouts/${Date.now()}-${safeName}`;

    try {
      const admin = createAdminClient();
      await admin.storage.createBucket("resources", { public: true }).catch(() => undefined);
      const { error } = await admin.storage.from("resources").upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (!error) {
        const { data } = admin.storage.from("resources").getPublicUrl(path);
        return NextResponse.json({ ok: true, url: data.publicUrl, name: file.name });
      }
    } catch {
      /* fall through to data URL */
    }

    const base64 = bytes.toString("base64");
    const mime = file.type || "application/octet-stream";
    return NextResponse.json({
      ok: true,
      url: `data:${mime};base64,${base64}`,
      name: file.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
