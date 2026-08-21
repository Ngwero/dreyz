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
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrength";
import { isPasswordAcceptable } from "@/lib/password-strength";
import { classOptions, feeTracks } from "@/lib/data";

const OTP_LENGTH = 6;

const fieldClass =
  "mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/35 focus:border-[#d8ff59]/45 focus:bg-white/[0.1] focus:ring-4 focus:ring-[#d8ff59]/10 sm:py-3 sm:text-sm";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:text-[10px]";

const linkMuted =
  "text-xs font-medium text-white/50 transition hover:text-white";

type Step =
  | "password"
  | "otp"
  | "forgot-email"
  | "forgot-otp"
  | "forgot-new"
  | "create";

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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [feeTrackId, setFeeTrackId] = useState(feeTracks[0]?.id ?? "4-month");
  const [classOptionId, setClassOptionId] = useState(
    classOptions[0]?.id ?? "weekday"
  );
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
      case "create":
        return "Create your student portal account. We’ll email a welcome confirmation.";
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

    if (step === "create") {
      if (!isPasswordAcceptable(password)) {
        setError("Password is too weak. Use 6+ characters with mixed case, numbers, or symbols.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!fullName.trim()) {
        setError("Enter your full name.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/accounts/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            email,
            phone,
            password,
            feeTrackId,
            classOptionId,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Could not create account.");
          return;
        }
        setNotice(
          data.message ??
            "Welcome to Dreyz Interior — check your email for confirmation, then sign in."
        );
        setStep("password");
        setConfirmPassword("");
        setFullName("");
        setPhone("");
      } catch {
        setError("Network error while creating account.");
      } finally {
        setLoading(false);
      }
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
      if (!isPasswordAcceptable(newPassword)) {
        setError("Password is too weak. Use 6+ characters with mixed case, numbers, or symbols.");
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
      if (step === "create") return "Creating…";
      return "Verifying…";
    }
    if (step === "password") return "Continue";
    if (step === "forgot-email") return "Send reset code";
    if (step === "forgot-new") return "Save new password";
    if (step === "create") return "Create account";
    if (isForgotOtp) return "Verify code";
    return "Verify & login";
  })();

  const heading =
    step === "create"
      ? "Create account"
      : step.startsWith("forgot")
        ? "Reset password"
        : "Welcome back";

  return (
    <div className="relative flex min-h-[100svh] overflow-x-hidden bg-[#061a4a]">
      {/* Ambient mesh */}
      <div className="pointer-events-none absolute inset-0 landing-mesh opacity-80" />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#1b7eef]/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[#d8ff59]/12 blur-[110px]"
        aria-hidden
      />

      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        {/* Brand panel */}
        <aside className="relative flex min-h-[34svh] flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[100svh] lg:w-[48%] lg:px-12 lg:py-14 xl:w-[52%] xl:px-16">
          <Image
            src="/gallery/campus-01.jpg"
            alt=""
            fill
            quality={90}
            sizes="(max-width: 1024px) 100vw, 52vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#061a4a]/75 via-[#082878]/70 to-[#082878]/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#061a4a] via-transparent to-[#061a4a]/40 lg:bg-gradient-to-r lg:from-transparent lg:via-[#082878]/25 lg:to-[#061a4a]/90" />

          <div className="relative landing-fade-up">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo-dark.png"
                alt="Dreyz Interior Design School"
                width={160}
                height={152}
                className="h-16 w-auto object-contain drop-shadow-lg sm:h-20 lg:h-24"
                priority
              />
            </Link>
          </div>

          <div className="relative mt-8 max-w-md landing-fade-up landing-delay-1 lg:mt-0 lg:mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d8ff59]">
              School portal
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
              Learn. Design.
              <span className="block text-white/80">Inspire.</span>
            </h2>
            <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-white/65 sm:text-[15px]">
              Sign in to your Dreyz Interior Design School account — classes, fees, and studio work in one place.
            </p>
          </div>

          <p className="relative hidden text-xs text-white/40 lg:block landing-fade-in landing-delay-3">
            Kira Road · opposite Total Kyaliwajjala
          </p>
        </aside>

        {/* Form panel */}
        <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <div className="w-full max-w-[420px] landing-fade-up landing-delay-2">
            <div className="mb-6 lg:mb-8">
              <div className="mb-5 flex justify-center lg:hidden">
                <Image
                  src="/logo-dark.png"
                  alt=""
                  width={120}
                  height={114}
                  className="h-14 w-auto object-contain opacity-90"
                />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
                {heading}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{subtitle}</p>
            </div>

            <form
              onSubmit={onSubmit}
              className="landing-glass-strong rounded-[1.35rem] border border-white/12 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7"
            >
              <div className="space-y-4">
                {onOtpStep ? (
                  <div>
                    <label className={labelClass}>
                      {isForgotOtp ? "Reset code" : "Email code"}
                    </label>
                    <div
                      className="mt-3 flex justify-between gap-1.5 sm:gap-2.5"
                      role="group"
                      aria-label={`${OTP_LENGTH}-digit verification code`}
                    >
                      {otpDigits.map((digit, index) => {
                        const boxClass =
                          otpStatus === "ok"
                            ? "border-emerald-400/80 bg-emerald-400/15 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                            : otpStatus === "bad"
                              ? "border-[#ff8a6a]/70 bg-[#ff8a6a]/10 text-white"
                              : digit
                                ? "border-[#d8ff59]/40 bg-white/10 text-white"
                                : "border-white/15 bg-white/[0.06] text-white";
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
                            className={`h-12 w-9 flex-1 rounded-2xl border text-center text-lg font-semibold outline-none transition sm:h-14 sm:max-w-[3.15rem] sm:flex-none sm:text-xl ${boxClass} focus:border-[#d8ff59] focus:ring-4 focus:ring-[#d8ff59]/15 disabled:opacity-80`}
                          />
                        );
                      })}
                    </div>
                    {otpStatus === "ok" && (
                      <p className="mt-3 text-sm font-medium text-emerald-300" role="status">
                        Code verified
                      </p>
                    )}
                    <p className="mt-3 text-xs text-white/45">
                      Code sent to <span className="text-white/75">{email}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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
                        className={`${linkMuted} disabled:opacity-40`}
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
                        className={`${linkMuted} disabled:opacity-40`}
                      >
                        {isForgotOtp ? "Change email" : "Back to password"}
                      </button>
                    </div>
                  </div>
                ) : step === "forgot-email" ? (
                  <div>
                    <label htmlFor="forgot-email" className={labelClass}>
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
                      className={`mt-4 ${linkMuted} disabled:opacity-40`}
                    >
                      ← Back to sign in
                    </button>
                  </div>
                ) : step === "create" ? (
                  <>
                    <div>
                      <label htmlFor="full-name" className={labelClass}>
                        Full name
                      </label>
                      <input
                        id="full-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        autoFocus
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={fieldClass}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="signup-email" className={labelClass}>
                        Email
                      </label>
                      <input
                        id="signup-email"
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
                      <label htmlFor="signup-phone" className={labelClass}>
                        Phone
                      </label>
                      <input
                        id="signup-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={fieldClass}
                        placeholder="+256 …"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="fee-track" className={labelClass}>
                          Programme
                        </label>
                        <select
                          id="fee-track"
                          value={feeTrackId}
                          onChange={(e) => setFeeTrackId(e.target.value)}
                          className={fieldClass}
                        >
                          {feeTracks.map((t) => (
                            <option key={t.id} value={t.id} className="bg-[#082878] text-white">
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="class-option" className={labelClass}>
                          Class
                        </label>
                        <select
                          id="class-option"
                          value={classOptionId}
                          onChange={(e) => setClassOptionId(e.target.value)}
                          className={fieldClass}
                        >
                          {classOptions.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#082878] text-white">
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="signup-password" className={labelClass}>
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="signup-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${fieldClass} pr-12`}
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white/75"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <PasswordStrengthMeter
                        password={password}
                        confirm={confirmPassword}
                        variant="dark"
                      />
                    </div>
                    <div>
                      <label htmlFor="signup-confirm" className={labelClass}>
                        Confirm password
                      </label>
                      <input
                        id="signup-confirm"
                        name="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={fieldClass}
                        placeholder="Repeat password"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setStep("password");
                        setError("");
                        setConfirmPassword("");
                      }}
                      className={`${linkMuted} disabled:opacity-40`}
                    >
                      ← Back to sign in
                    </button>
                  </>
                ) : step === "forgot-new" ? (
                  <>
                    <div>
                      <label htmlFor="new-password" className={labelClass}>
                        New password
                      </label>
                      <div className="relative">
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
                          className={`${fieldClass} pr-12`}
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white/75"
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <PasswordStrengthMeter
                        password={newPassword}
                        confirm={confirmPassword}
                        variant="dark"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className={labelClass}>
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
                      <label htmlFor="email" className={labelClass}>
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
                        <label htmlFor="password" className={labelClass}>
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
                          className="text-xs font-semibold text-[#d8ff59] transition hover:text-[#e8ff8a]"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${fieldClass} pr-12`}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white/75 sm:h-9 sm:w-9"
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
                <p
                  className="mt-4 rounded-xl border border-[#ff8a6a]/25 bg-[#ff8a6a]/10 px-3 py-2.5 text-sm leading-snug text-[#ffb39a]"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {notice && !error && (
                <p
                  className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm leading-snug text-emerald-200"
                  role="status"
                >
                  <Mail size={14} className="mt-0.5 shrink-0" />
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || otpStatus === "ok"}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70 disabled:hover:brightness-100 sm:min-h-11"
                style={
                  otpStatus === "ok"
                    ? { background: "#10b981", boxShadow: "0 10px 32px rgba(16,185,129,0.3)" }
                    : {
                        background: "linear-gradient(135deg, #ffb020 0%, #ff8c00 45%, #ff6a00 100%)",
                        boxShadow: "0 12px 36px rgba(255, 140, 0, 0.35)",
                      }
                }
              >
                <span className="truncate">{submitLabel}</span>
                {!loading && otpStatus !== "ok" && (
                  <ArrowRight size={16} className="shrink-0" />
                )}
              </button>

              {step === "password" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep("create");
                    setError("");
                    setNotice("");
                    setPassword("");
                    setConfirmPassword("");
                    setShowPassword(false);
                  }}
                  className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-white transition hover:border-[#d8ff59]/35 hover:bg-white/[0.08] disabled:opacity-70 sm:min-h-11"
                >
                  Create account
                </button>
              )}
            </form>

            <p className="mt-6 pb-[env(safe-area-inset-bottom)] text-center text-sm text-white/40">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center font-medium text-white/60 transition hover:text-[#d8ff59]"
              >
                ← Back to website
              </Link>
            </p>
          </div>
        </main>
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
