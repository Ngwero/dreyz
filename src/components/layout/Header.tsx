"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, MessageSquare, Search, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { initials, getAllUsers } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import {
  learnersStore,
  coursesStore,
  noticesStore,
  projectsStore,
} from "@/lib/store";

type Hit = { label: string; href: string; meta: string };

export function Header() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Hit[];
    const out: Hit[] = [];
    for (const l of learnersStore.getAll()) {
      if (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      ) {
        out.push({
          label: l.name,
          href: "/portal/learners",
          meta: `Learner · ${l.id}`,
        });
      }
    }
    for (const c of coursesStore.getAll()) {
      if (c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) {
        out.push({
          label: c.title,
          href: "/portal/courses",
          meta: `Course · ${c.category}`,
        });
      }
    }
    for (const n of noticesStore.getAll()) {
      if (n.title.toLowerCase().includes(q)) {
        out.push({
          label: n.title,
          href: "/portal/notices",
          meta: `Notice · ${n.priority}`,
        });
      }
    }
    for (const p of projectsStore.getAll()) {
      if (p.title.toLowerCase().includes(q) || p.learnerName.toLowerCase().includes(q)) {
        out.push({
          label: p.title,
          href: "/portal/projects",
          meta: `Project · ${p.learnerName}`,
        });
      }
    }
    if (
      user?.role === "super_admin" ||
      user?.role === "accountant"
    ) {
      for (const u of getAllUsers()) {
        if (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.includes(q)
        ) {
          out.push({
            label: u.name,
            href: "/portal/accounts",
            meta: `Account · ${ROLE_LABELS[u.role]}`,
          });
        }
      }
    }
    return out.slice(0, 8);
  }, [query, user]);

  const notices = noticesStore.getAll().slice(0, 4);

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-border bg-card/90 px-7 backdrop-blur-md">
      <div className="relative w-full max-w-sm" data-tour="header-search">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search learners, courses, accounts…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent/40 focus:bg-card focus:ring-2 focus:ring-accent/15"
        />
        {open && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {hits.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No matches</p>
            ) : (
              <ul>
                {hits.map((hit) => (
                  <li key={hit.href + hit.label}>
                    <Link
                      href={hit.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="block px-4 py-2.5 transition hover:bg-surface"
                    >
                      <p className="text-sm font-medium text-foreground">{hit.label}</p>
                      <p className="text-xs text-muted">{hit.meta}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setBellOpen((v) => !v);
              setOpen(false);
            }}
            className="relative rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground"
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-sm font-semibold">Notices</p>
                <button type="button" onClick={() => setBellOpen(false)} className="text-muted">
                  <X size={14} />
                </button>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {notices.map((n) => (
                  <li key={n.id} className="border-b border-border px-4 py-3 last:border-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.content}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/portal/notices"
                onClick={() => setBellOpen(false)}
                className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-accent"
              >
                View all notices
              </Link>
            </div>
          )}
        </div>
        <Link
          href="/portal/notices"
          aria-label="Messages"
          className="rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground"
        >
          <MessageSquare size={18} />
        </Link>

        <Link
          href="/portal/account"
          data-tour="header-profile"
          className="ml-2 flex items-center gap-2.5 rounded-lg border border-border bg-card py-1 pl-1 pr-2.5 transition hover:border-accent/30"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-[11px] font-bold text-white">
            {user ? initials(user.name) : "—"}
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold leading-tight text-foreground">
              {user?.name ?? "Guest"}
            </p>
            <p className="text-[11px] text-muted">
              {user ? ROLE_LABELS[user.role] : "—"}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
