"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export type ChartDetailRow = {
  label: string;
  value: string;
  color?: string;
};

export function ExpandableChart({
  title,
  hint,
  className,
  children,
  details,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
  details?: ChartDetailRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card title={title} className={className}>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl text-left outline-none transition hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-expanded={open}
      >
        {children}
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-medium text-muted">
          {open ? "Hide details" : "Click for details"}
          <ChevronDown size={12} className={cn("transition", open && "rotate-180")} />
        </p>
      </button>
      {open && details && details.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {details.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {row.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: row.color }}
                  />
                )}
                <span className="truncate text-foreground">{row.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
