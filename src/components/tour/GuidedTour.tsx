"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  pad?: number;
};

type Rect = { top: number; left: number; width: number; height: number };

function clampRect(el: Element, pad: number): Rect {
  const r = el.getBoundingClientRect();
  const top = Math.max(16, r.top - pad);
  const left = Math.max(16, r.left - pad);
  const right = Math.min(window.innerWidth - 16, r.right + pad);
  const bottom = Math.min(window.innerHeight - 16, r.bottom + pad);
  return {
    top,
    left,
    width: Math.max(80, right - left),
    height: Math.max(48, bottom - top),
  };
}

function hasSeen(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export function startTour(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("dreyz-tour-start", { detail: { storageKey } }));
}

export function GuidedTour({
  storageKey,
  steps,
  startDelay = 800,
  variant = "portal",
  onStart,
}: {
  storageKey: string;
  steps: TourStep[];
  startDelay?: number;
  variant?: "landing" | "portal";
  /** Called when the tour opens (auto first-visit or manual replay). */
  onStart?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const step = steps[index];
  const landing = variant === "landing";

  const close = useCallback(() => {
    markSeen(storageKey);
    setOpen(false);
    setIndex(0);
  }, [storageKey]);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(clampRect(el, step.pad ?? 12));
  }, [step]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= steps.length) {
        close();
        return;
      }
      setIndex(next);
    },
    [steps.length, close]
  );

  useEffect(() => {
    const begin = () => {
      onStartRef.current?.();
      window.setTimeout(
        () => {
          setIndex(0);
          setOpen(true);
        },
        onStartRef.current ? 280 : 0
      );
    };

    const onCustom = (e: Event) => {
      const key = (e as CustomEvent<{ storageKey?: string }>).detail?.storageKey;
      if (!key || key === storageKey) begin();
    };

    window.addEventListener("dreyz-tour-start", onCustom);

    // Auto-start only for first visit (storage key not marked yet)
    if (hasSeen(storageKey)) {
      return () => window.removeEventListener("dreyz-tour-start", onCustom);
    }

    const t = window.setTimeout(begin, startDelay);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("dreyz-tour-start", onCustom);
    };
  }, [storageKey, startDelay]);

  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      const skip = window.setTimeout(() => {
        if (index < steps.length - 1) goTo(index + 1);
      }, 250);
      return () => window.clearTimeout(skip);
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const t = window.setTimeout(measure, 380);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open, step, measure, index, steps.length, goTo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "Enter") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, close, goTo]);

  if (!open || !step) return null;

  const tooltipBelow =
    rect ? rect.top + rect.height + 220 < window.innerHeight : true;
  const largeTarget = rect ? rect.height > window.innerHeight * 0.62 : false;
  const tooltipLeft = rect
    ? Math.max(16, Math.min(rect.left, window.innerWidth - 376))
    : 0;
  const tooltipStyle = !rect
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : largeTarget
      ? { bottom: 24, left: tooltipLeft, top: "auto" as const }
      : tooltipBelow
        ? { top: rect.top + rect.height + 14, left: tooltipLeft }
        : {
            top: Math.max(16, rect.top - 14),
            left: tooltipLeft,
            transform: "translateY(-100%)",
          };

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Quick tour"
    >
      <button
        type="button"
        className={rect ? "absolute inset-0 cursor-default bg-transparent" : "absolute inset-0 bg-black/60"}
        aria-label="Dismiss tour"
        onClick={close}
      />

      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: landing
              ? "0 0 0 9999px rgba(6, 26, 74, 0.78), 0 0 0 2px rgba(216, 255, 89, 0.9)"
              : "0 0 0 9999px rgba(6, 26, 74, 0.72), 0 0 0 2px rgba(27, 126, 239, 0.95)",
          }}
        />
      )}

      <div
        className={cn(
          "absolute z-10 w-[min(360px,calc(100vw-32px))] rounded-2xl p-5 shadow-2xl",
          landing
            ? "border border-white/15 bg-[#082878]/95 text-white backdrop-blur-md"
            : "border border-border bg-card text-foreground"
        )}
        style={tooltipStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.16em]",
              landing ? "text-[#d8ff59]" : "text-muted"
            )}
          >
            {index + 1} / {steps.length}
          </p>
          <button
            type="button"
            onClick={close}
            className={cn(
              "rounded-lg p-1 transition",
              landing ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-surface hover:text-foreground"
            )}
            aria-label="Close tour"
          >
            <X size={14} />
          </button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{step.title}</h2>
        <p className={cn("mt-2 text-sm leading-relaxed", landing ? "text-white/65" : "text-muted")}>
          {step.body}
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            className={cn(
              "text-xs font-semibold",
              landing ? "text-white/45 hover:text-white" : "text-muted hover:text-foreground"
            )}
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold",
                  landing
                    ? "border border-white/15 text-white/80 hover:bg-white/10"
                    : "border border-border hover:bg-surface"
                )}
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white",
                landing ? "bg-[#1b7eef]" : "bg-navy"
              )}
            >
              {index === steps.length - 1 ? "Got it" : "Next"}
              {index < steps.length - 1 && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
