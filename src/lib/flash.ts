export type FlashKind = "success" | "error";

export function showFlash(kind: FlashKind, message: string) {
  if (typeof window === "undefined") return;
  const text = message.trim();
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent("dreyz-flash", { detail: { kind, message: text } })
  );
}
