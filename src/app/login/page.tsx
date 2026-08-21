"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#1b7eef]/50 focus:ring-2 focus:ring-[#1b7eef]/20 sm:py-2.5 sm:text-sm";

type Step = "password" | "otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout, sendOtp, loginWithOtp } = useAuth();
  const [step, setStep] = useState<Step>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const goPortal = () => {
    const next = searchParams.get("next") || "/portal";
    router.push(next.startsWith("/portal") ? next : "/portal");
  };

  const onSendOtp = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email first.");
      return false;
    }
    const result = await sendOtp(email);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setResendIn(60);
    setNotice(result.message);
    return true;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (step === "password") {
        const result = await login(email, password);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Password OK — clear that session and require email OTP next
        await logout();
        const sent = await onSendOtp();
        if (sent) {
          setStep("otp");
          setOtp("");
        }
        return;
      }

      const result = await loginWithOtp(email, otp);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goPortal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-x-hidden bg-[#082878] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Image
        src="/gallery/campus-01.jpg"
        alt=""
        fill
        quality={90}
        sizes="100vw"
        className="object-cover opacity-30"
        priority
      />
      <div className="absolute inset-0 bg-[#082878]/90" />

      <div className="relative z-10 w-full max-w-[400px] sm:max-w-[440px]">
        <div className="mb-6 text-center sm:mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/logo-dark.png"
              alt="Dreyz Interior Design School"
              width={88}
              height={84}
              className="mx-auto h-14 w-auto object-contain sm:h-20"
              priority
            />
          </Link>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:mt-5 sm:text-2xl">
            Welcome back
          </h1>
          <p className="mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-white/55 sm:max-w-none">
            {step === "password"
              ? "Enter your email and password to continue."
              : "Enter the one-time code we sent to your email."}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-md sm:p-8"
        >
          <div className="space-y-4">
            {step === "otp" ? (
              <div>
                <label
                  htmlFor="otp"
                  className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                >
                  Email code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\s/g, ""))}
                  className={`${fieldClass} tracking-[0.35em]`}
                  placeholder="••••••"
                />
                <p className="mt-2 text-xs text-white/45">
                  Code sent to <span className="text-white/70">{email}</span>
                </p>
                <button
                  type="button"
                  disabled={loading || resendIn > 0}
                  onClick={() => {
                    void (async () => {
                      setLoading(true);
                      try {
                        await onSendOtp();
                      } finally {
                        setLoading(false);
                      }
                    })();
                  }}
                  className="mt-2 text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-40"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep("password");
                    setOtp("");
                    setError("");
                    setNotice("");
                  }}
                  className="mt-2 block text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-40"
                >
                  ← Back to password
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="email"
                    className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                  >
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${fieldClass} mt-0 pr-12`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 sm:right-1.5 sm:h-9 sm:w-9"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm leading-snug text-[#ff8a6a]" role="alert">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="mt-3 flex items-start gap-2 text-sm leading-snug text-emerald-300" role="status">
              <Mail size={14} className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="landing-btn-blue mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100 sm:mt-6 sm:min-h-11 sm:py-3"
          >
            <span className="truncate">
              {loading
                ? step === "password"
                  ? "Checking…"
                  : "Verifying…"
                : step === "password"
                  ? "Continue"
                  : "Verify & login"}
            </span>
            {!loading && <ArrowRight size={16} className="shrink-0" />}
          </button>
        </form>

        <p className="mt-5 pb-[env(safe-area-inset-bottom)] text-center text-sm text-white/45 sm:mt-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-medium text-white/70 transition hover:text-[#ffc319]"
          >
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-[#082878] px-4 text-sm text-white/60">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
