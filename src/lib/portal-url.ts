/** Public production site — used in welcome / credential emails. */
export const PUBLIC_SITE_ORIGIN = "https://www.dreyzschool.com";

/**
 * Login URL for emails and credential messages.
 * Prefers NEXT_PUBLIC_APP_URL when it is a real custom domain; ignores *.vercel.app.
 */
export function portalLoginUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (raw) {
    const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
    try {
      const host = new URL(withProtocol).hostname.toLowerCase();
      if (!host.endsWith(".vercel.app") && host !== "localhost" && host !== "127.0.0.1") {
        return `${withProtocol}/login`;
      }
    } catch {
      /* fall through */
    }
  }
  return `${PUBLIC_SITE_ORIGIN}/login`;
}

export function portalNoticesUrl(): string {
  return portalLoginUrl().replace(/\/login\/?$/, "/portal/notices");
}
