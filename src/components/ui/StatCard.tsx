import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "accent" | "lime" | "warm";
  className?: string;
}

const toneStyles = {
  default: {
    icon: "bg-surface text-accent",
    bar: "from-accent/80 to-accent/20",
  },
  accent: {
    icon: "bg-accent/15 text-accent",
    bar: "from-[#1b7eef] to-[#082878]/40",
  },
  lime: {
    icon: "bg-[color-mix(in_srgb,var(--brand-lime)_28%,transparent)] text-foreground dark:text-[#d8ff59]",
    bar: "from-[#d8ff59]/90 to-[#d8ff59]/20",
  },
  warm: {
    icon: "bg-orange-500/10 text-orange-500",
    bar: "from-orange-400 to-orange-400/20",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: StatCardProps) {
  const t = toneStyles[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90",
          t.bar
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105",
              t.icon
            )}
          >
            <Icon size={16} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <p className="mt-3 text-[1.7rem] font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-[1.85rem]">
        {value}
      </p>
      {hint && <p className="mt-2.5 text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}
