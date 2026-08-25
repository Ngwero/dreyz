"use client";

import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";
import dreyzLoader from "@/lottie/dreyz-loader.json";
import dreyzLoaderOnDark from "@/lottie/dreyz-loader-on-dark.json";

const SIZES = {
  xs: 36,
  sm: 72,
  md: 128,
  lg: 168,
} as const;

export function LottieLoader({
  label,
  size = "md",
  tone = "default",
  className,
}: {
  label?: string;
  size?: keyof typeof SIZES;
  tone?: "default" | "onDark";
  className?: string;
}) {
  const px = SIZES[size];
  const labelClass = tone === "onDark" ? "text-white/75" : "text-muted";

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)} role="status">
      <Lottie
        src={tone === "onDark" ? dreyzLoaderOnDark : dreyzLoader}
        loop
        autoplay
        className="shrink-0"
        style={{ width: px, height: px }}
      />
      {label ? <p className={cn("text-sm font-medium tracking-tight", labelClass)}>{label}</p> : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}

export function LottieScreen({
  label = "Loading…",
  tone = "default",
}: {
  label?: string;
  tone?: "default" | "onDark";
}) {
  const dark = tone === "onDark";
  return (
    <div
      className={cn(
        "flex min-h-[100svh] items-center justify-center px-4",
        dark ? "bg-[#082878]" : "bg-background"
      )}
    >
      <LottieLoader size="lg" tone={tone} label={label} />
    </div>
  );
}

export function LottiePanel({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[40vh] items-center justify-center py-10", className)}>
      <LottieLoader size="md" label={label} />
    </div>
  );
}
