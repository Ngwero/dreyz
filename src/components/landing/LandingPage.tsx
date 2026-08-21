"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { schoolInfo, feeTracks, classOptions, programme, stats, admissionRequirements } from "@/lib/data";
import { formatUGX, formatNumber } from "@/lib/utils";
import { Reveal, RevealWords, useScrollProgress } from "./scroll";
import { NeutraHeader, brand } from "./NeutraHeader";
import { NeutraHero } from "./NeutraHero";
import { ArchDrawingBackdrop } from "./ArchDrawingBackdrop";

const gallery = [
  "/gallery/studio/design-team.png",
  "/gallery/studio/graduate.png",
  "/gallery/studio/speaker.png",
  "/gallery/kitchen-hero/slot-mid-top.jpg",
  "/gallery/kitchen-hero/slot-right-top.jpg",
  "/gallery/campus-01.jpg",
];

const classTaglines: Record<string, string> = {
  weekday: "Morning weekday block — steady progress without giving up your routine.",
  "weekday-pm": "Midday weekday block — the same Mon–Wed schedule, later start.",
};

const feeTaglines: Record<string, string> = {
  "4-month": "Complete the core programme and graduate job-ready.",
  "6-month": "Full course plus internship — maximum experience, maximum value.",
};

const navLinks = [
  { label: "Programme", href: "#programme" },
  { label: "Studio", href: "#studio" },
  { label: "About", href: "#about" },
  { label: "Admissions", href: "#admissions" },
  { label: "Contact", href: "#contact" },
];

function SectionBadge({
  children,
  color = brand.sage,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span className="landing-section-badge" style={{ color }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {children}
    </span>
  );
}

export function LandingPage() {
  const progress = useScrollProgress();

  useEffect(() => {
    document.documentElement.classList.add("landing-smooth");
    return () => {
      document.documentElement.classList.remove("landing-smooth");
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#082878] text-white">
      <ArchDrawingBackdrop />

      {/* Scroll progress */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[70] h-[2px] transition-[width] duration-150 ease-out"
        style={{
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${brand.sage}, ${brand.orange})`,
        }}
        aria-hidden
      />

      <NeutraHeader navLinks={navLinks} />

      <NeutraHero />

      {/* About */}
      <section
        id="about"
       
        className="relative z-10 border-t border-white/8 px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <Reveal>
                <SectionBadge color={brand.sage}>About Dreyz</SectionBadge>
              </Reveal>
              <RevealWords
                text="Where talent becomes a trade — and passion pays."
                className="mt-6 text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.12] tracking-[-0.02em]"
              />
            </div>
            <Reveal delay={0.15}>
              <p className="text-base leading-relaxed text-white/50 sm:text-lg lg:pt-10">
                We&apos;re not here to fill notebooks — we&apos;re here to build
                designers who can quote a project, draw it accurately, style it
                beautifully, and deliver it on time. That&apos;s the Dreyz
                difference: skills you can sell from day one.
              </p>
              <a
                href="#programme"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-[13px] font-semibold transition hover:border-white/30 hover:bg-white/5"
              >
                Explore the full programme
                <ArrowUpRight size={14} />
              </a>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {(
              [
                {
                  word: "Learn",
                  accent: brand.sage,
                  copy: "Master space, colour & material — the foundations every great designer needs.",
                },
                {
                  word: "Design",
                  accent: brand.orange,
                  copy: "From mood boards to technical drawings — create work clients can see and trust.",
                },
                {
                  word: "Inspire",
                  accent: "#ffffff",
                  copy: "Graduate with a certificate, portfolio & industry placement that sets you apart.",
                },
              ] as const
            ).map((item, i) => (
              <Reveal key={item.word} delay={i * 0.1} y={32}>
                <div
                  className="landing-glass landing-card-hover group relative overflow-hidden rounded-3xl p-7"
                  style={{
                    borderColor:
                      i === 0
                        ? `${brand.sage}33`
                        : i === 1
                          ? `${brand.orange}33`
                          : "rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-60"
                    style={{ background: `${item.accent}22` }}
                  />
                  <p
                    className="font-mono text-xs"
                    style={{ color: item.accent }}
                  >
                    0{i + 1}
                  </p>
                  <p
                    className="mt-4 text-3xl font-semibold tracking-tight"
                    style={{ color: item.accent }}
                  >
                    {item.word}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-white/45">
                    {item.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bento */}
      <section className="relative z-10 px-5 py-24 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionBadge color={brand.orange}>Why Dreyz works</SectionBadge>
                <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold tracking-tight">
                  Real training. Real results.
                </h2>
              </div>
              <p className="max-w-sm text-sm text-white/45">
                Everything you need to go from passion to profession — in one
                structured programme.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                value: programme.courseworkUnits,
                label: "Course units",
                note: "Skills that employers look for",
                accent: brand.sage,
              },
              {
                value: programme.internshipMonths,
                label: "Months on site",
                note: "Real-world experience before you graduate",
                accent: brand.orange,
              },
              {
                value: formatNumber(stats.learners),
                label: "Designers trained",
                note: "Join a growing creative community",
                accent: brand.sage,
              },
              {
                value: formatNumber(stats.certifications),
                label: "Graduates certified",
                note: "Proof you can deliver",
                accent: brand.orange,
              },
            ].map((fact, i) => (
              <Reveal key={fact.label} delay={i * 0.08} y={28}>
                <div className="landing-glass landing-card-hover h-full rounded-3xl p-7">
                  <p
                    className="text-[clamp(2.5rem,4vw,3.75rem)] font-semibold leading-none tracking-tight"
                    style={{ color: fact.accent }}
                  >
                    {fact.value}
                  </p>
                  <p className="mt-4 text-sm font-medium">{fact.label}</p>
                  <p className="mt-1 text-xs text-white/40">{fact.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Programme */}
      <section
        id="programme"
       
        className="relative z-10 border-t border-white/8 px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-12 lg:grid-cols-[0.45fr_1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Reveal>
                <SectionBadge color={brand.sage}>Programme</SectionBadge>
              </Reveal>
              <RevealWords
                text="Skills that pay. Training that lasts."
                className="mt-6 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold leading-[1.1] tracking-tight"
                delay={0.05}
              />
              <Reveal delay={0.15}>
                <p className="mt-6 text-base leading-relaxed text-white/50">
                  {programme.courseworkUnits} practical units take you from
                  beginner to professional — then {programme.internshipMonths}{" "}
                  months on the job put your skills to work where it matters
                  most. Choose a morning or midday weekday class — physical
                  studio learning only.
                </p>
              </Reveal>
            </div>

            <div className="grid gap-4">
              {classOptions.map((opt, i) => (
                <Reveal key={opt.id} delay={0.1 + i * 0.08} y={24}>
                  <div
                    className="landing-glass landing-card-hover flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: i === 0 ? brand.sage : brand.orange,
                    }}
                  >
                    <div>
                      <p className="text-lg font-semibold">{opt.name}</p>
                      <p className="mt-1 text-sm text-white/45">{opt.days}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/35">
                        {classTaglines[opt.id]}
                      </p>
                    </div>
                    <div className="landing-glass rounded-2xl px-4 py-2 text-right">
                      <p className="text-sm font-medium">{opt.time}</p>
                      <p className="text-xs text-white/40">
                        {opt.hoursPerDay}h per day
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Studio gallery */}
      <section id="studio" className="relative z-10 overflow-hidden py-20 sm:py-28">
        <div className="mx-auto mb-12 flex max-w-[1600px] flex-col gap-4 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 lg:px-12">
          <Reveal>
            <SectionBadge color={brand.sage}>Life at Dreyz</SectionBadge>
            <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold tracking-tight">
              People, practice, and proud moments
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-sm text-sm text-white/45">
              From studio collaboration to graduation day — the Dreyz community
              that builds careers in interior design.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15} y={40}>
          <div className="landing-marquee-wrap">
            <div className="landing-marquee flex gap-5 px-5">
              {[...gallery, ...gallery].map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="group relative h-[300px] w-[240px] shrink-0 overflow-hidden rounded-2xl sm:h-[420px] sm:w-[320px]"
                >
                  <Image
                    src={src}
                    alt="Dreyz studio and site work"
                    fill
                    quality={90}
                    className="object-cover transition duration-700 group-hover:scale-105"
                    sizes="320px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#082878]/50 via-transparent to-transparent" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/12" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Admissions */}
      <section
        id="admissions"
       
        className="relative z-10 px-5 py-24 sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="landing-glass-strong overflow-hidden rounded-[2rem] p-8 sm:p-12 lg:p-16">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <SectionBadge color={brand.orange}>
                  Admissions · {schoolInfo.intake} intake
                </SectionBadge>
                <RevealWords
                  text="Invest in your future. Pay your way."
                  className="mt-6 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold tracking-tight"
                />
                <Reveal delay={0.1}>
                  <p className="mt-3 text-sm font-medium text-[#d8ff59]">
                    {schoolInfo.intakeNote}
                  </p>
                </Reveal>
                <Reveal delay={0.15}>
                  <p className="mt-5 max-w-md text-base leading-relaxed text-white/50">
                    Quality design education shouldn&apos;t be out of reach.
                    Choose a payment plan that fits your life — 3 or 4
                    installments — and graduate with a certificate that opens
                    doors. In-studio learning only, because great designers
                    are made hands-on.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <ul className="mt-5 max-w-md space-y-2">
                    {admissionRequirements.map((req) => (
                      <li
                        key={req}
                        className="flex items-start gap-2 text-sm text-white/55"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: brand.sage }}
                        />
                        {req}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={0.25}>
                  <Link
                    href="/login"
                    className="landing-btn-lime mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold text-[#082878] transition hover:scale-[1.02]"
                  >
                    Claim your seat
                    <ArrowUpRight size={14} />
                  </Link>
                </Reveal>
              </div>

              <div className="grid gap-3">
                {feeTracks.map((track, i) => (
                  <Reveal key={track.id} delay={i * 0.1} y={20}>
                    <div className="landing-glass landing-card-hover flex items-end justify-between gap-4 rounded-2xl px-6 py-5">
                      <div>
                        <p className="text-sm text-white/50">{track.name}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                          {formatUGX(track.total)}
                        </p>
                        {feeTaglines[track.id] && (
                          <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/40">
                            {feeTaglines[track.id]}
                          </p>
                        )}
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          color: brand.orange,
                          background: `${brand.orange}18`,
                          border: `1px solid ${brand.orange}33`,
                        }}
                      >
                        {track.durationMonths} mo
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
       
        className="relative z-10 border-t border-white/8 px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      >
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <SectionBadge color={brand.sage}>Your next step</SectionBadge>
          </Reveal>
          <RevealWords
            text="Ready to design your future?"
            className="mt-6 max-w-3xl text-[clamp(2.25rem,7vw,5rem)] font-semibold leading-[0.95] tracking-[-0.03em]"
            delay={0.05}
          />

          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
              Visit us on Kira Road, opposite Total Kyaliwajjala. Talk to our
              team or apply for the {schoolInfo.intake} intake — your design
              career starts with one decision.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="landing-btn-blue inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-semibold text-white transition hover:scale-[1.02]"
              >
                Apply now — {schoolInfo.intake} intake
                <ArrowUpRight size={14} />
              </Link>
              <a
                href={`mailto:${schoolInfo.email}`}
                className="inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-[13px] font-semibold transition hover:scale-[1.02]"
                style={{
                  borderColor: `${brand.sage}66`,
                  color: brand.sage,
                  background: `${brand.sage}10`,
                }}
              >
                {schoolInfo.email}
              </a>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Visit", body: schoolInfo.location },
              { label: "Call", body: schoolInfo.phones.join(" · ") },
              {
                label: "Web",
                body: schoolInfo.website,
                href: `https://${schoolInfo.website.replace(/^https?:\/\//, "")}`,
              },
            ].map((item, i) => (
              <Reveal key={item.label} delay={i * 0.08}>
                <div className="landing-glass landing-card-hover rounded-2xl p-6">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: i === 0 ? brand.sage : i === 1 ? brand.orange : "#fff" }}
                  >
                    {item.label}
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-sm leading-relaxed text-white/70 transition hover:text-white"
                    >
                      {item.body}
                    </a>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-white/70">
                      {item.body}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-dark.png"
              alt="Dreyz"
              width={40}
              height={38}
              className="h-9 w-auto opacity-80"
            />
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} Dreyz Interior Design School
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-sm text-white/35">
              <span style={{ color: brand.sage }}>Learn</span>
              <span className="mx-2">·</span>
              <span style={{ color: brand.orange }}>Design</span>
              <span className="mx-2">·</span>
              <span className="text-white/50">Inspire — your design career starts here</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
