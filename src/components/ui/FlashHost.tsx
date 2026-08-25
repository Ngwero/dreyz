"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { FlashKind } from "@/lib/flash";

type Toast = {
  id: number;
  kind: FlashKind;
  message: string;
};

export function FlashHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onFlash = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: FlashKind; message?: string }>).detail;
      if (!detail?.message || (detail.kind !== "success" && detail.kind !== "error")) {
        return;
      }
      const toast: Toast = {
        id: Date.now() + Math.random(),
        kind: detail.kind,
        message: detail.message,
      };
      setToasts((prev) => [...prev.slice(-2), toast]);
    };
    window.addEventListener("dreyz-flash", onFlash);
    return () => window.removeEventListener("dreyz-flash", onFlash);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 6500)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const ok = toast.kind === "success";
        return (
          <div
            key={toast.id}
            role={ok ? "status" : "alert"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
              ok
                ? "border-emerald-500/35 bg-white text-emerald-900 dark:bg-[#0b1f14] dark:text-emerald-100"
                : "border-red-500/35 bg-white text-red-900 dark:bg-[#2a1010] dark:text-red-100"
            }`}
          >
            {ok ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
            )}
            <p className="min-w-0 flex-1 font-medium leading-snug">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 rounded-lg p-1 text-current/60 hover:bg-black/5 hover:text-current"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
