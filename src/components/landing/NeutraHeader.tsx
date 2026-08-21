"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export const brand = {
  navy: "#082878",
  navyDeep: "#061a4a",
  primary: "#1F429A",
  orange: "#1b7eef",
  sage: "#d8ff59",
  blue: "#082878",
  lime: "#d8ff59",
  navDark: "#061a4a",
} as const;

export type NavLink = {
  label: string;
  href: string;
};

type NeutraHeaderProps = {
  navLinks: NavLink[];
  ctaHref?: string;
  ctaLabel?: string;
  portalHref?: string;
};

/** Smoothstep ease — soft Neutra/Framer feel */
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function NeutraHeader({
  navLinks,
  ctaHref = "/login",
  ctaLabel = "Apply now",
  portalHref = "/login",
}: NeutraHeaderProps) {
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(navLinks[0]?.href ?? "#");
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const rafRef = useRef(0);
  const targetRef = useRef(0);
  const currentRef = useRef(0);

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Continuous scroll → smooth spring toward compact pill */
  useEffect(() => {
    const SCROLL_RANGE = 120;

    const measure = () => {
      targetRef.current = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
    };

    const tick = () => {
      const diff = targetRef.current - currentRef.current;
      // Soft spring (Framer-like damping)
      currentRef.current += diff * 0.12;
      if (Math.abs(diff) < 0.001) currentRef.current = targetRef.current;
      setProgress(currentRef.current);
      if (Math.abs(diff) >= 0.001) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      measure();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    measure();
    setProgress(targetRef.current);
    currentRef.current = targetRef.current;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const sections = navLinks
      .map((link) => {
        const id = link.href.replace("#", "");
        const el = document.getElementById(id);
        return el ? { href: link.href, el } : null;
      })
      .filter(Boolean) as { href: string; el: HTMLElement }[];

    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveHref(`#${visible[0].target.id}`);
        }
      },
      { threshold: [0.2, 0.45, 0.65], rootMargin: "-30% 0px -45% 0px" }
    );

    sections.forEach(({ el }) => io.observe(el));
    return () => io.disconnect();
  }, [navLinks]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const updateIndicator = (href: string | null) => {
    if (!href || !navRef.current) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const linkEl = linkRefs.current.get(href);
    const navEl = navRef.current;
    if (!linkEl) return;

    const navRect = navEl.getBoundingClientRect();
    const linkRect = linkEl.getBoundingClientRect();
    setIndicator({
      left: linkRect.left - navRect.left,
      width: linkRect.width,
      opacity: 1,
    });
  };

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      updateIndicator(hoveredHref ?? activeHref)
    );
    return () => cancelAnimationFrame(id);
  }, [hoveredHref, activeHref, progress]);

  useEffect(() => {
    const onResize = () => updateIndicator(hoveredHref ?? activeHref);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hoveredHref, activeHref]);

  const t = easeOutCubic(progress);
  const isCompact = progress > 0.55;
  const highlightHref = hoveredHref ?? activeHref;

  const barStyle = {
    maxWidth: `${lerp(1600, 960, t)}px`,
    padding: `${lerp(14, 6, t)}px ${lerp(8, 8, t)}px`,
    borderRadius: `${lerp(0, 14, t)}px`,
    backgroundColor: `rgba(31, 66, 154, ${lerp(0, 1, t)})`,
    backdropFilter: `blur(${lerp(0, 14, t)}px)`,
    WebkitBackdropFilter: `blur(${lerp(0, 14, t)}px)`,
    boxShadow:
      t > 0.05
        ? `0 ${lerp(0, 10, t)}px ${lerp(0, 36, t)}px rgba(8,40,120,${lerp(0, 0.4, t)}), 0 0 0 1px rgba(255,255,255,${lerp(0, 0.14, t)})`
        : "none",
    gap: `${lerp(12, 28, t)}px`,
  } as const;

  return (
    <>
      <header className="neutra-header pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4 lg:px-8">
        <div
          ref={barRef}
          data-tour="nav"
          className={`neutra-header-bar pointer-events-auto mx-auto flex w-full items-center justify-between ${
            isCompact ? "is-scrolled" : ""
          }`}
          style={barStyle}
        >
          <Link
            href="/"
            className="neutra-logo-box flex shrink-0 items-center justify-center rounded-lg"
            style={{
              padding: `${lerp(8, 6, t)}px`,
              backgroundColor: "transparent",
              borderColor: "transparent",
            }}
          >
            <Image
              src="/logo-dark.png"
              alt="Dreyz"
              width={280}
              height={256}
              className="w-auto object-contain"
              style={{
                height: `${lerp(isDesktop ? 220 : 60, isDesktop ? 56 : 36, t)}px`,
              }}
              priority
            />
          </Link>

          <nav
            ref={navRef}
            className="neutra-nav-pill relative hidden items-center rounded-xl lg:flex"
            style={{
              padding: 4,
              backgroundColor: `rgba(255, 255, 255, ${lerp(0.03, 0.14, t)})`,
              borderColor: `rgba(255, 255, 255, ${lerp(0.04, 0.18, t)})`,
            }}
            onMouseLeave={() => setHoveredHref(null)}
          >
            <span
              className="neutra-nav-indicator pointer-events-none absolute top-1/2 h-[calc(100%-8px)] -translate-y-1/2 rounded-lg"
              style={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
              }}
            />
            {navLinks.map((link) => {
              const isActive = highlightHref === link.href;
              return (
                <a
                  key={link.href}
                  ref={(el) => {
                    if (el) linkRefs.current.set(link.href, el);
                  }}
                  href={link.href}
                  data-active={isActive ? "true" : "false"}
                  className={`neutra-nav-link relative z-10 px-3.5 py-2 text-[13px] font-medium transition-colors duration-300 xl:px-4 ${
                    isActive ? "text-white" : "text-white/55 hover:text-white/85"
                  }`}
                  onMouseEnter={() => setHoveredHref(link.href)}
                  onClick={() => setActiveHref(link.href)}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Link
              href={portalHref}
              className="neutra-btn-secondary hidden rounded-lg px-3.5 py-2 text-[13px] font-medium md:inline-flex"
            >
              Portal
            </Link>
            <Link
              href={ctaHref}
              className="neutra-btn-primary hidden rounded-lg px-4 py-2.5 text-[12px] font-semibold sm:inline-flex"
              style={{
                transform: `scale(${lerp(1, 0.96, t)})`,
              }}
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
              className="neutra-menu-btn flex h-10 w-10 items-center justify-center rounded-lg lg:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#082878]">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-base font-semibold text-white">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#082878]"
            >
              <X size={18} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-1 px-5">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-baseline gap-4 rounded-2xl px-4 py-4 text-[clamp(1.75rem,6vw,2.75rem)] font-semibold tracking-tight text-white transition hover:bg-white/10"
              >
                <span className="font-mono text-sm text-white/50">0{i + 1}</span>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-white/20 px-5 py-8">
            <Link
              href={ctaHref}
              onClick={() => setMenuOpen(false)}
              className="inline-flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-sm font-semibold text-[#082878]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
