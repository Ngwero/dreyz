"use client";

import { useEffect, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const plates = [
  { id: "a", Comp: FloorPlanPlate, className: "-left-[8%] top-[2%] w-[min(580px,82vw)]", parallax: 0.1, opacity: "opacity-[0.1]" },
  { id: "b", Comp: ElevationPlate, className: "-right-[4%] top-[6%] w-[min(520px,72vw)]", parallax: 0.16, opacity: "opacity-[0.09]" },
  { id: "c", Comp: SectionPlate, className: "bottom-[0%] left-[8%] w-[min(620px,88vw)]", parallax: 0.08, opacity: "opacity-[0.08]" },
  { id: "d", Comp: FurniturePlanPlate, className: "right-[2%] bottom-[12%] w-[min(420px,62vw)]", parallax: 0.18, opacity: "opacity-[0.1]" },
  { id: "e", Comp: DetailPlate, className: "left-[36%] top-[32%] w-[min(320px,48vw)]", parallax: 0.22, opacity: "opacity-[0.08]" },
  { id: "f", Comp: AxisPlate, className: "left-[52%] top-[2%] w-[min(280px,42vw)]", parallax: 0.14, opacity: "opacity-[0.07]" },
] as const;

/** Architectural drawings that visibly drift and float */
export function ArchDrawingBackdrop() {
  const [scrollY, setScrollY] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const motionOff = prefersReducedMotion();
    setReduce(motionOff);
    if (motionOff) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="arch-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#082878]" />

      <div
        className="absolute inset-[-25%] h-[150%] w-[150%]"
        style={
          reduce ? undefined : { transform: `translate3d(${-scrollY * 0.03}px, ${-scrollY * 0.05}px, 0)` }
        }
      >
        <svg className="arch-grid-layer h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="arch-grid-sm" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.7" />
            </pattern>
            <pattern id="arch-grid-lg" width="240" height="240" patternUnits="userSpaceOnUse">
              <rect width="240" height="240" fill="url(#arch-grid-sm)" />
              <path d="M 240 0 L 0 0 0 240" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.1" />
            </pattern>
            <radialGradient id="arch-vignette" cx="50%" cy="35%" r="72%">
              <stop offset="0%" stopColor="#082878" stopOpacity="0" />
              <stop offset="55%" stopColor="#082878" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#082878" stopOpacity="0.9" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#arch-grid-lg)" />
          <rect width="100%" height="100%" fill="url(#arch-vignette)" />
        </svg>
      </div>

      <div className="absolute inset-0">
        {plates.map(({ id, Comp, className, parallax, opacity }) => (
          <div
            key={id}
            className={`absolute ${className}`}
            style={
              reduce
                ? undefined
                : { transform: `translate3d(0, ${-scrollY * parallax}px, 0)` }
            }
          >
            {/* Inner wrapper owns the float animation so it isn't overridden */}
            <div className={`arch-mover arch-mover--${id}`}>
              <Comp className={`h-auto w-full ${opacity}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="arch-glow absolute inset-0" />
    </div>
  );
}

function FloorPlanPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 40 H360 V280 H40 Z" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" />
      <path d="M40 140 H220" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
      <path d="M220 40 V280" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
      <path d="M220 180 H360" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
      <path d="M120 140 V280" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <path d="M160 140 A28 28 0 0 1 188 168" stroke="rgba(180,212,122,0.85)" strokeWidth="1.4" />
      <path d="M220 100 A24 24 0 0 0 244 76" stroke="rgba(180,212,122,0.85)" strokeWidth="1.4" />
      <path d="M280 180 A22 22 0 0 1 302 202" stroke="rgba(27,126,239,0.8)" strokeWidth="1.4" />
      <rect x="55" y="55" width="70" height="40" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="245" y="200" width="90" height="55" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeDasharray="4 3" />
      <text x="200" y="314" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">12 400</text>
      <text x="55" y="75" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="monospace">LIVING</text>
      <text x="235" y="70" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="monospace">STUDIO</text>
    </svg>
  );
}

function ElevationPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 420 280" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 230 H400" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
      <path d="M60 230 V90 H180 V230" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
      <path d="M180 230 V70 H340 V230" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
      <path d="M50 90 L120 40 L190 90" stroke="rgba(255,255,255,0.8)" strokeWidth="1.6" />
      <rect x="85" y="110" width="28" height="28" stroke="rgba(180,212,122,0.8)" strokeWidth="1.3" />
      <rect x="125" y="110" width="28" height="28" stroke="rgba(180,212,122,0.8)" strokeWidth="1.3" />
      <rect x="210" y="95" width="36" height="30" stroke="rgba(27,126,239,0.75)" strokeWidth="1.3" />
      <rect x="265" y="95" width="36" height="30" stroke="rgba(27,126,239,0.75)" strokeWidth="1.3" />
      <rect x="210" y="160" width="90" height="50" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
      <text x="372" y="155" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="monospace">EL. +6.2</text>
    </svg>
  );
}

function SectionPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 480 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 180 H450" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <path d="M60 180 V100 H140 V60 H220 V100 H300 V50 H380 V180" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
      <path d="M60 100 H140 M220 100 H300" stroke="rgba(180,212,122,0.65)" strokeWidth="1.3" />
      <text x="110" y="216" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">SECTION A–A</text>
    </svg>
  );
}

function FurniturePlanPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="240" height="200" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
      <rect x="40" y="40" width="100" height="36" rx="4" stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" />
      <ellipse cx="170" cy="130" rx="32" ry="22" stroke="rgba(180,212,122,0.7)" strokeWidth="1.3" />
      <rect x="50" y="150" width="70" height="50" rx="3" stroke="rgba(27,126,239,0.7)" strokeWidth="1.3" />
      <text x="30" y="35" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">FURN. LAYOUT</text>
    </svg>
  );
}

function DetailPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 170 H70 V140 H100 V110 H130 V80 H160 V50" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" />
      <path d="M30 170 V50 H160" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="160" cy="50" r="5" stroke="rgba(27,126,239,0.85)" strokeWidth="1.3" />
      <text x="100" y="190" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">STAIR DETAIL</text>
    </svg>
  );
}

function AxisPlate({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 150 H190" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <path d="M40 150 V40" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <path d="M40 40 H160 V120 H40" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
      <path d="M70 40 V120 M110 40 V120 M40 70 H160 M40 100 H160" stroke="rgba(180,212,122,0.4)" strokeWidth="0.9" />
      <circle cx="40" cy="40" r="3.5" fill="rgba(27,126,239,0.8)" />
      <text x="100" y="168" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">AXIS 01</text>
    </svg>
  );
}
