import { inferActivityCategory, recordPortalActivity, type ActivityCategory } from "@/lib/activity";

export type FlashKind = "success" | "error";

export function showFlash(
  kind: FlashKind,
  message: string,
  meta?: {
    category?: ActivityCategory;
    detail?: string;
    href?: string;
    emails?: string[];
    learnerIds?: string[];
  }
) {
  if (typeof window === "undefined") return;
  const text = message.trim();
  if (!text) return;
  recordPortalActivity({
    title: text,
    detail: meta?.detail,
    category: meta?.category ?? inferActivityCategory(text),
    tone: kind,
    href: meta?.href,
    emails: meta?.emails,
    learnerIds: meta?.learnerIds,
  });
  window.dispatchEvent(
    new CustomEvent("dreyz-flash", { detail: { kind, message: text } })
  );
}
