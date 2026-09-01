/** Max size for embedding a file as a data URL when cloud storage is unavailable. */
export const MAX_EMBED_FILE_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export type ClientUploadResult =
  | { ok: true; url: string; name: string; embedded?: boolean }
  | { ok: false; error: string };

/**
 * Upload via API route; if storage/auth fails, embed small files locally so staff
 * can still add handouts on this browser.
 */
export async function uploadFileWithFallback(
  file: File,
  endpoint: string
): Promise<ClientUploadResult> {
  try {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch(endpoint, {
      method: "POST",
      body: data,
      credentials: "same-origin",
    });
    const json = (await res.json()) as {
      ok?: boolean;
      url?: string;
      name?: string;
      error?: string;
    };

    if (res.ok && json.ok && json.url) {
      return { ok: true, url: json.url, name: json.name ?? file.name };
    }

    const apiError = json.error ?? `Upload failed (${res.status})`;
    if (file.size <= MAX_EMBED_FILE_BYTES && shouldEmbedFallback(res.status)) {
      const url = await fileToDataUrl(file);
      return { ok: true, url, name: file.name, embedded: true };
    }

    return { ok: false, error: apiError };
  } catch {
    if (file.size <= MAX_EMBED_FILE_BYTES) {
      try {
        const url = await fileToDataUrl(file);
        return { ok: true, url, name: file.name, embedded: true };
      } catch {
        return { ok: false, error: "Could not read the file." };
      }
    }
    return { ok: false, error: "Network error while uploading the file." };
  }
}

function shouldEmbedFallback(status: number) {
  return status === 401 || status === 403 || status >= 500;
}
