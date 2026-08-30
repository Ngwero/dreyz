import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const gated = await requireStaff();
    if (!gated.ok) return gated.response;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File must be under 25 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `handouts/${Date.now()}-${safeName}`;

    try {
      const admin = gated.admin;
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
      /* fall through */
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Upload to storage failed. Check Supabase storage is configured.",
      },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
