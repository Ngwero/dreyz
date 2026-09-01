import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/api-auth";
import { uploadToResourcesBucket } from "@/lib/storage-upload";

export const runtime = "nodejs";

/** Studio uploads for projects / assessment submissions — any signed-in user. */
export async function POST(request: Request) {
  try {
    const gated = await requireSignedIn();
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
    const folder = gated.role === "student" ? "submissions" : "studio";
    const result = await uploadToResourcesBucket(
      gated.admin,
      bytes,
      file.name,
      file.type || "application/octet-stream",
      `${folder}/${gated.userId}`
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: result.url, name: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
