"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { programme } from "@/lib/data";
import { brand } from "./NeutraHeader";

const heroFrames = [
  {
    src: "/gallery/campus-15.jpg",
    alt: "Dreyz Interior Design School Class of 2026 graduates",
    className: "hero-frame hero-frame--main",
  },
  {
    src: "/gallery/studio/graduate.jpg",
    alt: "A Dreyz graduate in studio",
    className: "hero-frame hero-frame--top",
  },
  {
    src: "/gallery/campus-18.jpg",
    alt: "A Dreyz instructor explaining fittings to students on a site visit",
    className: "hero-frame hero-frame--bot",
  },
];

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HeroEnter({
  children,
  className = "",
  delay = 0,
  y = 96,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(true), 120 + delay * 1000);
    return () => window.clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={className}
      style={
        {
          opacity: shown ? 1 : 0,
          transform: shown
            ? "translate3d(0,0,0)"
            : `translate3d(0,${y}px,0)`,
          transition: `opacity 1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 1s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

function HeroCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="neutra-hero-cta group inline-flex items-stretch overflow-hidden rounded-xl">
      <span className="relative flex items-center overflow-hidden px-5 py-3.5 sm:px-6">
        <span className="neutra-hero-cta-text text-[13px] font-semibold text-white sm:text-sm">
          {label}
        </span>
        <span
          className="neutra-hero-cta-text neutra-hero-cta-text--hover absolute inset-0 flex items-center px-5 sm:px-6 text-[13px] font-semibold text-white sm:text-sm"
          aria-hidden
        >
          {label}
        </span>
      </span>
      <span
        className="neutra-hero-cta-icon flex w-12 shrink-0 items-center justify-center sm:w-14"
      >
        <ArrowUpRight
          size={18}
          className="text-white transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </span>
    </Link>
  );
}

export function NeutraHero() {
  return (
    <section className="relative z-10 min-h-[100svh] px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-44 lg:px-12 lg:pt-72 xl:pt-80">
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="relative z-10 flex flex-col gap-10">
          <HeroEnter delay={0.12} y={72}>
            <div className="flex flex-col gap-5">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: brand.sage }}
              >
                Dreyz Interior · January 2027 intake
              </p>
              <h1 className="text-[clamp(2.75rem,6.5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-white">
                Design spaces
                <br />
                people love.
                <br />
                <span style={{ color: brand.orange }}>Build a career that lasts.</span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">
                Studio craft, technical drawing, materials, and site practice —
                train like a professional interior designer from day one.
              </p>
            </div>
          </HeroEnter>

          <HeroEnter delay={0.28} y={64} className="flex flex-wrap items-center gap-4">
            <HeroCTA href="/login" label="Start your journey" />
            <Link
              href="#programme"
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-[13px] font-semibold text-white/80 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              See what you&apos;ll learn →
            </Link>
          </HeroEnter>

          <HeroEnter delay={0.4} y={40}>
            <div className="flex flex-wrap gap-8 border-t border-white/10 pt-8 sm:gap-12">
              {[
                { value: programme.courseworkUnits, label: "Skills to master" },
                { value: `${programme.internshipMonths}mo`, label: "Industry placement" },
                { value: "100%", label: "Hands-on training" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/80">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </HeroEnter>
        </div>

        {/* Editorial image composition — interiors, not ceremony */}
        <HeroEnter delay={0.2} y={48} className="relative">
          <div className="hero-gallery relative mx-auto aspect-[4/5] w-full max-w-[560px] lg:max-w-none">
            {heroFrames.map((frame, i) => (
              <div
                key={frame.src}
                className={`${frame.className} overflow-hidden`}
                style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              >
                <Image
                  src={frame.src}
                  alt={frame.alt}
                  fill
                  priority={i === 0}
                  quality={90}
                  sizes="(max-width: 1024px) 90vw, 520px"
                  className="object-cover transition duration-[1.2s] ease-out hover:scale-[1.04]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#082878]/35 via-transparent to-black/10" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />
              </div>
            ))}
            <div className="hero-gallery-caption absolute bottom-4 left-4 z-10 rounded-full border border-white/15 bg-black/35 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
              Learn · Design · Inspire
            </div>
          </div>
        </HeroEnter>
      </div>
    </section>
  );
}
