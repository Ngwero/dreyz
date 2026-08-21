"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(DEMO_LOGINS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const next = searchParams.get("next") || "/portal";
      router.push(next.startsWith("/portal") ? next : "/portal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#082878] px-5 py-12">
      <Image
        src="/gallery/campus-01.jpg"
        alt=""
        fill
        quality={90}
        className="object-cover opacity-30"
        priority
      />
      <div className="absolute inset-0 bg-[#082878]/90" />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image
              src="/logo-dark.png"
              alt="Dreyz Interior Design School"
              width={88}
              height={84}
              className="mx-auto h-20 w-auto object-contain"
              priority
            />
          </Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Sign in with your school account — admin, finance, tutor, or student.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-md sm:p-8"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-white/50"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#1b7eef]/50 focus:ring-2 focus:ring-[#1b7eef]/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-white/50"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#1b7eef]/50 focus:ring-2 focus:ring-[#1b7eef]/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-[#ff8a6a]" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="landing-btn-blue mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? "Signing in…" : "Login to school portal"}
            {!loading && <ArrowRight size={16} />}
          </button>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Demo accounts · password {DEMO_PASSWORD}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_LOGINS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                    setError("");
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left text-[11px] text-white/70 transition hover:border-[#1b7eef]/40 hover:text-white"
                >
                  <span className="block font-semibold text-white/90">
                    {ROLE_LABELS[d.role]}
                  </span>
                  <span className="truncate opacity-70">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-white/45">
          <Link
            href="/"
            className="font-medium text-white/70 transition hover:text-[#ffc319]"
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
        <div className="flex min-h-[100svh] items-center justify-center bg-[#082878] text-white/60">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
