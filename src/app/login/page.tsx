"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  checkPasswordResetOtp,
  requestLoginOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyLoginOtp,
} from "@/lib/auth-client";
import { changePasswordByEmail } from "@/lib/auth";

const OTP_LENGTH = 6;

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#1b7eef]/50 focus:ring-2 focus:ring-[#1b7eef]/20 sm:py-2.5 sm:text-sm";

type Step = "password" | "otp" | "forgot-email" | "forgot-otp" | "forgot-new";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, logout } = useAuth();
  const [step, setStep] = useState<Step>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill("")
  );
  const [otpStatus, setOtpStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyingRef = useRef(false);

  const otp = otpDigits.join("");
  const isForgotOtp = step === "forgot-otp";
  const isLoginOtp = step === "otp";
  const onOtpStep = isForgotOtp || isLoginOtp;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (onOtpStep) {
      otpRefs.current[0]?.focus();
    }
  }, [onOtpStep, step]);

  const goPortal = () => {
    const next = searchParams.get("next") || "/portal";
    router.push(next.startsWith("/portal") ? next : "/portal");
  };

  const resetOtp = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setOtpStatus("idle");
    verifyingRef.current = false;
  };

  const subtitle = (() => {
    switch (step) {
      case "password":
        return "Enter your email and password to continue.";
      case "otp":
        return "Enter the one-time code we sent to your email.";
      case "forgot-email":
        return "Enter your email and we’ll send a reset code.";
      case "forgot-otp":
        return "Enter the reset code we sent to your email.";
      case "forgot-new":
        return "Choose a new password for your account.";
    }
  })();

  const onSendLoginOtp = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email first.");
      return false;
    }
    const result = await requestLoginOtp(email);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setResendIn(60);
    setNotice(result.message ?? "Code sent.");
    return true;
  };

  const onSendResetOtp = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email first.");
      return false;
    }
    const result = await requestPasswordResetOtp(email);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setResendIn(60);
    setNotice(result.message ?? "Reset code sent.");
    return true;
  };

  const verifyOtpCode = async (code: string) => {
    if (verifyingRef.current || code.length !== OTP_LENGTH) return;
    verifyingRef.current = true;
    setError("");
    setNotice("");
    setLoading(true);
    setOtpStatus("idle");
    try {
      if (isForgotOtp) {
        const checked = await checkPasswordResetOtp(email, code);
        if (!checked.ok) {
          setOtpStatus("bad");
          setError(checked.error);
          verifyingRef.current = false;
          return;
        }
        setResetCode(code);
        setOtpStatus("ok");
        window.setTimeout(() => {
          setStep("forgot-new");
          resetOtp();
          setNewPassword("");
          setConfirmPassword("");
          setNotice("");
        }, 550);
        return;
      }

      const checked = await verifyLoginOtp(email, code);
      if (!checked.ok) {
        setOtpStatus("bad");
        setError(checked.error);
        verifyingRef.current = false;
        return;
      }

      const signedIn = await login(email, password);
      if (!signedIn.ok) {
        setOtpStatus("bad");
        setError(signedIn.error);
        verifyingRef.current = false;
        return;
      }

      setOtpStatus("ok");
      window.setTimeout(() => goPortal(), 650);
    } finally {
      setLoading(false);
    }
  };

  const applyOtpValue = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    const next = Array(OTP_LENGTH)
      .fill("")
      .map((_, i) => digits[i] ?? "");
    setOtpDigits(next);
    setOtpStatus("idle");
    setError("");
    const focusAt = Math.min(digits.length, OTP_LENGTH - 1);
    otpRefs.current[focusAt]?.focus();
    if (digits.length === OTP_LENGTH) {
      void verifyOtpCode(digits.join(""));
    }
  };

  const onOtpChange = (index: number, raw: string) => {
    if (otpStatus === "ok") return;
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length > 1) {
      applyOtpValue(otpDigits.slice(0, index).join("") + cleaned);
      return;
    }
    const digit = cleaned.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setOtpStatus("idle");
    setError("");
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    const code = next.join("");
    if (code.length === OTP_LENGTH && next.every(Boolean)) {
      void verifyOtpCode(code);
    }
  };

  const onOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const next = [...otpDigits];
      next[index - 1] = "";
      setOtpDigits(next);
      setOtpStatus("idle");
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
      e.preventDefault();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const backToPassword = async () => {
    await logout();
    setStep("password");
    resetOtp();
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (onOtpStep) {
      if (otp.length !== OTP_LENGTH) {
        setError(`Enter the ${OTP_LENGTH}-digit code.`);
        return;
      }
      await verifyOtpCode(otp);
      return;
    }

    if (step === "forgot-email") {
      setLoading(true);
      try {
        const sent = await onSendResetOtp();
        if (sent) {
          setStep("forgot-otp");
          resetOtp();
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === "forgot-new") {
      if (newPassword.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (resetCode.length !== OTP_LENGTH) {
        setError("Reset code missing. Request a new code.");
        setStep("forgot-email");
        return;
      }
      setLoading(true);
      try {
        const result = await resetPasswordWithOtp({
          email,
          code: resetCode,
          password: newPassword,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        changePasswordByEmail(email, newPassword);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setResetCode("");
        setStep("password");
        setNotice("Password updated. Sign in with your new password.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await logout();
      const sent = await onSendLoginOtp();
      if (sent) {
        setStep("otp");
        resetOtp();
      }
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = (() => {
    if (otpStatus === "ok") return isForgotOtp ? "Code verified" : "Verified";
    if (loading) {
      if (step === "password") return "Checking…";
      if (step === "forgot-email") return "Sending…";
      if (step === "forgot-new") return "Saving…";
      return "Verifying…";
    }
    if (step === "password") return "Continue";
    if (step === "forgot-email") return "Send reset code";
    if (step === "forgot-new") return "Save new password";
    if (isForgotOtp) return "Verify code";
    return "Verify & login";
  })();

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
              width={200}
              height={190}
              className="mx-auto h-32 w-auto object-contain sm:h-40 md:h-44"
              priority
            />
          </Link>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:mt-5 sm:text-2xl">
            {step.startsWith("forgot") ? "Reset password" : "Welcome back"}
          </h1>
          <p className="mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-white/55 sm:max-w-none">
            {subtitle}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-md sm:p-8"
        >
          <div className="space-y-4">
            {onOtpStep ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs">
                  {isForgotOtp ? "Reset code" : "Email code"}
                </label>
                <div
                  className="mt-2 flex justify-between gap-1.5 sm:gap-2"
                  role="group"
                  aria-label={`${OTP_LENGTH}-digit verification code`}
                >
                  {otpDigits.map((digit, index) => {
                    const boxClass =
                      otpStatus === "ok"
                        ? "border-emerald-400 bg-emerald-400/20 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.45)]"
                        : otpStatus === "bad"
                          ? "border-[#ff8a6a]/80 bg-[#ff8a6a]/10 text-white"
                          : digit
                            ? "border-[#1b7eef]/50 bg-white/10 text-white"
                            : "border-white/15 bg-white/5 text-white";
                    return (
                      <input
                        key={index}
                        ref={(el) => {
                          otpRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={digit}
                        disabled={loading && otpStatus !== "ok"}
                        aria-label={`Digit ${index + 1}`}
                        onChange={(e) => onOtpChange(index, e.target.value)}
                        onKeyDown={(e) => onOtpKeyDown(index, e)}
                        onPaste={(e) => {
                          e.preventDefault();
                          applyOtpValue(e.clipboardData.getData("text"));
                        }}
                        onFocus={(e) => e.target.select()}
                        className={`h-11 w-9 flex-1 rounded-xl border text-center text-base font-semibold outline-none transition xs:h-12 sm:h-14 sm:max-w-12 sm:flex-none sm:text-xl ${boxClass} focus:border-[#1b7eef] focus:ring-2 focus:ring-[#1b7eef]/25 disabled:opacity-80`}
                      />
                    );
                  })}
                </div>
                {otpStatus === "ok" && (
                  <p className="mt-2 text-sm font-medium text-emerald-300" role="status">
                    Code verified
                  </p>
                )}
                <p className="mt-2 text-xs text-white/45">
                  Code sent to <span className="text-white/70">{email}</span>
                </p>
                <button
                  type="button"
                  disabled={loading || resendIn > 0 || otpStatus === "ok"}
                  onClick={() => {
                    void (async () => {
                      setLoading(true);
                      try {
                        resetOtp();
                        if (isForgotOtp) await onSendResetOtp();
                        else await onSendLoginOtp();
                        otpRefs.current[0]?.focus();
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
                  disabled={loading || otpStatus === "ok"}
                  onClick={() => {
                    void (isForgotOtp
                      ? (async () => {
                          setStep("forgot-email");
                          resetOtp();
                          setError("");
                          setNotice("");
                        })()
                      : backToPassword());
                  }}
                  className="mt-2 block text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-40"
                >
                  {isForgotOtp ? "← Change email" : "← Back to password"}
                </button>
              </div>
            ) : step === "forgot-email" ? (
              <div>
                <label
                  htmlFor="forgot-email"
                  className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void backToPassword()}
                  className="mt-3 text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-40"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : step === "forgot-new" ? (
              <>
                <div>
                  <label
                    htmlFor="new-password"
                    className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                  >
                    New password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="new-password"
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      autoFocus
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${fieldClass} mt-0 pr-12`}
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 sm:right-1.5 sm:h-9 sm:w-9"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={fieldClass}
                    placeholder="Repeat new password"
                  />
                </div>
              </>
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
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:text-xs"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("forgot-email");
                        setError("");
                        setNotice("");
                        setPassword("");
                        resetOtp();
                      }}
                      className="text-xs font-medium text-[#d8ff59] transition hover:text-[#e8ff8a]"
                    >
                      Forgot password?
                    </button>
                  </div>
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
            disabled={loading || otpStatus === "ok"}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100 sm:mt-6 sm:min-h-11 sm:py-3"
            style={
              otpStatus === "ok"
                ? { background: "#10b981", boxShadow: "0 8px 28px rgba(16,185,129,0.35)" }
                : {
                    background: "linear-gradient(135deg, #ffb020 0%, #ff8c00 45%, #ff6a00 100%)",
                    boxShadow: "0 8px 28px rgba(255, 140, 0, 0.45)",
                  }
            }
          >
            <span className="truncate">{submitLabel}</span>
            {!loading && otpStatus !== "ok" && (
              <ArrowRight size={16} className="shrink-0" />
            )}
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
