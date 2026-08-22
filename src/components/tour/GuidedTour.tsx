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

function measureEl(el: Element, pad: number): Rect {
  const r = el.getBoundingClientRect();
  const top = Math.max(8, r.top - pad);
  const left = Math.max(8, r.left - pad);
  const right = Math.min(window.innerWidth - 8, r.right + pad);
  const bottom = Math.min(window.innerHeight - 8, r.bottom + pad);
  return {
    top,
    left,
    width: Math.max(48, right - left),
    height: Math.max(40, bottom - top),
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
  window.dispatchEvent(new CustomEvent("dreyz-tour-start", { detail: { storageKey } }));
}

function placeTooltip(rect: Rect) {
  const gap = 16;
  const tw = Math.min(360, window.innerWidth - 32);
  const th = 220;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(16, Math.min(x, vw - tw - 16));
  const clampY = (y: number) => Math.max(16, Math.min(y, vh - th - 16));

  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;

  if (spaceRight >= tw + gap + 8) {
    return { top: clampY(rect.top), left: rect.left + rect.width + gap };
  }
  if (spaceBelow >= th + gap) {
    return { top: rect.top + rect.height + gap, left: clampX(rect.left) };
  }
  if (spaceLeft >= tw + gap + 8) {
    return { top: clampY(rect.top), left: rect.left - tw - gap };
  }
  if (spaceAbove >= th + gap) {
    return { top: rect.top - th - gap, left: clampX(rect.left) };
  }
  return { top: 16, left: clampX(vw - tw - 16) };
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
    setRect(null);
  }, [storageKey]);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(measureEl(el, step.pad ?? 10));
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
    const begin = (manual: boolean) => {
      if (!manual) markSeen(storageKey);
      onStartRef.current?.();
      window.setTimeout(
        () => {
          setIndex(0);
          setOpen(true);
        },
        onStartRef.current ? 320 : 0
      );
    };

    const onCustom = (e: Event) => {
      const key = (e as CustomEvent<{ storageKey?: string }>).detail?.storageKey;
      if (!key || key === storageKey) begin(true);
    };

    window.addEventListener("dreyz-tour-start", onCustom);

    if (hasSeen(storageKey)) {
      return () => window.removeEventListener("dreyz-tour-start", onCustom);
    }

    const t = window.setTimeout(() => begin(false), startDelay);
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
      }, 280);
      return () => window.clearTimeout(skip);
    }
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    const t = window.setTimeout(measure, 360);
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

  const tooltipStyle = rect
    ? placeTooltip(rect)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const dim = landing ? "bg-[#061a4a]/80" : "bg-black/55 dark:bg-black/70";
  const ring = landing
    ? "0 0 0 3px #d8ff59, 0 0 28px rgba(216,255,89,0.55)"
    : "0 0 0 3px #d8ff59, 0 0 24px rgba(27,126,239,0.55)";

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="Quick tour"
    >
      {rect ? (
        <>
          <button
            type="button"
            className={cn("absolute cursor-default", dim)}
            style={{ top: 0, left: 0, right: 0, height: rect.top }}
            aria-label="Dismiss tour"
            onClick={close}
          />
          <button
            type="button"
            className={cn("absolute cursor-default", dim)}
            style={{
              top: rect.top,
              left: 0,
              width: rect.left,
              height: rect.height,
            }}
            aria-label="Dismiss tour"
            onClick={close}
          />
          <button
            type="button"
            className={cn("absolute cursor-default", dim)}
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
            aria-label="Dismiss tour"
            onClick={close}
          />
          <button
            type="button"
            className={cn("absolute cursor-default", dim)}
            style={{
              top: rect.top + rect.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-label="Dismiss tour"
            onClick={close}
          />
          <div
            className="pointer-events-none absolute rounded-xl"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: ring,
            }}
          />
        </>
      ) : (
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          aria-label="Dismiss tour"
          onClick={close}
        />
      )}

      <div
        className={cn(
          "absolute z-10 w-[min(360px,calc(100vw-32px))] rounded-2xl p-5 shadow-2xl",
          landing
            ? "border border-white/15 bg-[#082878]/95 text-white backdrop-blur-md"
            : "border border-[#d8ff59]/40 bg-card text-foreground"
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
              landing
                ? "text-white/50 hover:bg-white/10 hover:text-white"
                : "text-muted hover:bg-surface hover:text-foreground"
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
