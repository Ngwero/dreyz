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
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { PageHeader, SearchInput } from "@/components/ui/PageElements";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAllUsers } from "@/lib/auth";
import { useLiveTick } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_CATEGORIES,
  collectRecentActivity,
  formatActivityTime,
  lastActivityByActor,
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
  const [view, setView] = useState<"timeline" | "people">("timeline");

  const items = useMemo(() => {
    void tick;
    if (!user) return [];
    return collectRecentActivity(user);
  }, [user, tick]);

  const byActor = useMemo(() => {
    void tick;
    if (!user) return new Map();
    return lastActivityByActor(user);
  }, [user, tick]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return getAllUsers()
      .map((u) => ({
        user: u,
        activity: byActor.get(u.email.toLowerCase()) ?? null,
      }))
      .filter(({ user: u, activity }) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (activity?.title.toLowerCase().includes(q) ?? false) ||
          (activity?.detail.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => (b.activity?.at ?? 0) - (a.activity?.at ?? 0));
  }, [byActor, query]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        (item.actorName?.toLowerCase().includes(q) ?? false) ||
        (item.actorEmail?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query, category]);

  if (!user) return null;
  if (user.role !== "super_admin") return null;

  return (
    <div>
      <PageHeader
        title="Recent activity"
        description="What people did in the portal — sign-ins, attendance marks, payments, edits — not a list of who is currently on the roster."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            { id: "timeline" as const, label: "Action timeline" },
            { id: "people" as const, label: "By person" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              view === tab.id
                ? "bg-accent text-white"
                : "border border-border bg-card text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput
          placeholder={
            view === "people"
              ? "Search by person or what they did…"
              : "Search actions, people, or details…"
          }
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {view === "timeline" && (
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
      )}

      {view === "people" ? (
        people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <Users className="mx-auto mb-3 text-muted" size={28} />
            <p className="text-sm font-medium text-foreground">No matching people</p>
            <p className="mt-1 text-sm text-muted">
              Actions appear here after someone signs in or saves work in the portal.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {people.map(({ user: person, activity }) => (
              <li key={person.id}>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                    <Users size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{person.name}</p>
                      <Badge variant="default">{person.role.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{person.email}</p>
                    {activity ? (
                      <p className="mt-2 text-sm text-foreground">
                        {activity.title}
                        {activity.detail ? (
                          <span className="text-muted"> · {activity.detail}</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">No recorded actions yet</p>
                    )}
                  </div>
                  <p className="shrink-0 text-[11px] font-medium text-muted">
                    {activity?.at ? formatActivityTime(activity.at) : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <History className="mx-auto mb-3 text-muted" size={28} />
          <p className="text-sm font-medium text-foreground">No matching activity yet</p>
          <p className="mt-1 text-sm text-muted">
            New sign-ins, attendance saves, payments, and portal edits will show up here as they
            happen.
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
                  {item.actorName && (
                    <p className="mt-1 text-[11px] font-medium text-muted">
                      Done by {item.actorName}
                      {item.actorRole ? ` · ${item.actorRole.replace("_", " ")}` : ""}
                    </p>
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
