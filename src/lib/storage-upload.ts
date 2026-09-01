import type { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "resources";
const MAX_BYTES = 25 * 1024 * 1024;

type Admin = ReturnType<typeof createAdminClient>;

export async function uploadToResourcesBucket(
  admin: Admin,
  bytes: Buffer,
  fileName: string,
  contentType: string,
  folder = "handouts"
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (bytes.length > MAX_BYTES) {
    return { ok: false, error: "File must be under 25 MB." };
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (
    bucketError &&
    !/already exists/i.test(bucketError.message) &&
    !/duplicate/i.test(bucketError.message)
  ) {
    return {
      ok: false,
      error: `Could not prepare storage bucket: ${bucketError.message}`,
    };
  }

  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });

  if (error) {
    return {
      ok: false,
      error: `Storage upload failed: ${error.message}. Run migration 009_storage_resources.sql in Supabase.`,
    };
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    return { ok: false, error: "Upload succeeded but public URL was empty." };
  }

  return { ok: true, url: data.publicUrl };
}
