import { recordPortalActivity } from "@/lib/activity";

export type FlashKind = "success" | "error";

export function showFlash(kind: FlashKind, message: string) {
  if (typeof window === "undefined") return;
  const text = message.trim();
  if (!text) return;
  const emailed = /email/i.test(text);
  recordPortalActivity({
    title: text,
    category: emailed ? "email" : "portal",
    tone: kind,
  });
  window.dispatchEvent(
    new CustomEvent("dreyz-flash", { detail: { kind, message: text } })
  );
}
