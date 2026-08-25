"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  ClipboardCheck,
  FileText,
  History,
  LogIn,
  Mail,
  Palette,
  UserPlus,
  Wallet,
  Zap,
} from "lucide-react";
import { PageHeader, SearchInput } from "@/components/ui/PageElements";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLiveTick } from "@/lib/store";
import {
  ACTIVITY_CATEGORIES,
  collectRecentActivity,
  formatActivityTime,
  type ActivityCategory,
  type ActivityItem,
} from "@/lib/activity";

function iconFor(category: ActivityCategory) {
  switch (category) {
    case "email":
      return Mail;
    case "payment":
      return Wallet;
    case "learner":
      return UserPlus;
    case "attendance":
      return ClipboardCheck;
    case "assessment":
      return FileText;
    case "notice":
      return Bell;
    case "schedule":
      return Calendar;
    case "login":
      return LogIn;
    case "project":
      return Palette;
    default:
      return Zap;
  }
}

function toneBadge(item: ActivityItem) {
  if (item.tone === "success") return "success" as const;
  if (item.tone === "error") return "danger" as const;
  return "info" as const;
}

export default function RecentActivityPage() {
  const { user } = useAuth();
  const tick = useLiveTick();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActivityCategory | "all">("all");

  const items = useMemo(() => {
    void tick;
    if (!user) return [];
    return collectRecentActivity(user);
  }, [user, tick]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);

  if (!user) return null;
  if (user.role !== "super_admin") return null;

  return (
    <div>
      <PageHeader
        title="Recent activity"
        description="Emails, payments, attendance, marks, notices, and other school actions in one timeline."
      />

      <div className="mb-4">
        <SearchInput
          placeholder="Search activity..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {ACTIVITY_CATEGORIES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setCategory(opt.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              category === opt.id
                ? "bg-accent text-white"
                : "border border-border bg-card text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <History className="mx-auto mb-3 text-muted" size={28} />
          <p className="text-sm font-medium text-foreground">No matching activity yet</p>
          <p className="mt-1 text-sm text-muted">
            New emails, payments, and portal saves will show up here.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {visible.slice(0, 120).map((item) => {
            const Icon = iconFor(item.category);
            const inner = (
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition hover:border-accent/30 hover:bg-surface/60">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <Badge variant={toneBadge(item)}>{item.category}</Badge>
                  </div>
                  {item.detail && (
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
                  )}
                </div>
                <p className="shrink-0 text-[11px] font-medium text-muted">
                  {formatActivityTime(item.at)}
                </p>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? <Link href={item.href}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
