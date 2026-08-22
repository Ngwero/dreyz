"use client";

import { scorePassword, type PasswordStrengthLevel } from "@/lib/password-strength";

const SEGMENTS = 4;

const LEVEL_COLOR: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
  weak: "#ff8a6a",
  fair: "#ffb020",
  good: "#1b7eef",
  strong: "#34d399",
};

const CHECK_ITEMS: { key: keyof ReturnType<typeof scorePassword>["checks"]; label: string }[] = [
  { key: "minLength", label: "6+ characters" },
  { key: "hasLower", label: "Lowercase" },
  { key: "hasUpper", label: "Uppercase" },
  { key: "hasNumber", label: "Number" },
  { key: "hasSpecial", label: "Symbol" },
];

type Props = {
  password: string;
  /** Confirm field value — shows match status when both are non-empty. */
  confirm?: string;
  variant?: "dark" | "light";
  className?: string;
};

export function PasswordStrengthMeter({
  password,
  confirm,
  variant = "dark",
  className = "",
}: Props) {
  const strength = scorePassword(password);
  const dark = variant === "dark";
  const filled = strength.level === "empty" ? 0 : Math.max(1, Math.min(strength.score, SEGMENTS));
  const barColor =
    strength.level === "empty" ? "transparent" : LEVEL_COLOR[strength.level];

  const showMatch = typeof confirm === "string" && password.length > 0 && confirm.length > 0;
  const matched = showMatch && password === confirm;

  if (!password) return null;

  return (
    <div className={`mt-3 space-y-2.5 ${className}`} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={filled} aria-label="Password strength">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                dark ? "bg-white/10" : "bg-border"
              }`}
              style={i < filled ? { backgroundColor: barColor } : undefined}
            />
          ))}
        </div>
        {strength.label && (
          <span
            className="shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: barColor }}
          >
            {strength.label}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        {CHECK_ITEMS.map(({ key, label }) => {
          const ok = strength.checks[key];
          return (
            <li
              key={key}
              className={`flex items-center gap-1.5 text-[11px] ${
                ok
                  ? dark
                    ? "text-emerald-300/90"
                    : "text-emerald-600"
                  : dark
                    ? "text-white/80"
                    : "text-muted"
              }`}
            >
              <span
                className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  ok
                    ? dark
                      ? "bg-emerald-400/20 text-emerald-300"
                      : "bg-emerald-500/15 text-emerald-600"
                    : dark
                      ? "bg-white/15 text-white/80"
                      : "bg-border text-muted"
                }`}
                aria-hidden
              >
                {ok ? "✓" : "·"}
              </span>
              {label}
            </li>
          );
        })}
      </ul>

      {showMatch && (
        <p
          className={`text-xs font-medium ${
            matched
              ? dark
                ? "text-emerald-300"
                : "text-emerald-600"
              : dark
                ? "text-[#ff8a6a]"
                : "text-red-500"
          }`}
        >
          {matched ? "Passwords match" : "Passwords do not match"}
        </p>
      )}
    </div>
  );
}
