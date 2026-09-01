"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Menu, MessageSquare, Search, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { initials, getAllUsers } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import {
  learnersStore,
  coursesStore,
  noticesStore,
  projectsStore,
  useLiveTick,
} from "@/lib/store";
import {
  markAllNoticesRead,
  markNoticeRead,
  unreadNoticeCount,
} from "@/lib/notice-reads";

type Hit = { label: string; href: string; meta: string };

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();
  const tick = useLiveTick();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Hit[];
    const out: Hit[] = [];
    const isStaff =
      user?.role === "super_admin" ||
      user?.role === "accountant" ||
      user?.role === "tutor";
    const isFinance = user?.role === "super_admin" || user?.role === "accountant";

    if (isStaff) {
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
    } else if (user?.learnerId || user?.email) {
      for (const l of learnersStore.getAll()) {
        if (
          l.id === user.learnerId ||
          l.email.toLowerCase() === user.email.toLowerCase()
        ) {
          if (l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) {
            out.push({
              label: l.name,
              href: "/portal/account",
              meta: `My profile · ${l.id}`,
            });
          }
        }
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
    if (isStaff) {
      for (const p of projectsStore.getAll()) {
        if (p.title.toLowerCase().includes(q) || p.learnerName.toLowerCase().includes(q)) {
          out.push({
            label: p.title,
            href: "/portal/projects",
            meta: `Project · ${p.learnerName}`,
          });
        }
      }
    } else if (user?.learnerId) {
      for (const p of projectsStore.getAll()) {
        if (p.learnerId === user.learnerId && p.title.toLowerCase().includes(q)) {
          out.push({
            label: p.title,
            href: "/portal/projects",
            meta: "My project",
          });
        }
      }
    }
    if (isFinance) {
      for (const u of getAllUsers()) {
        if (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.includes(q)
        ) {
          out.push({
            label: u.name,
            href: "/portal/accounts",
            meta: `Account · ${ROLE_LABELS[u.role] ?? u.role}`,
          });
        }
      }
    }
    return out.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after store hydrate
  }, [query, user, tick]);

  const allNotices = noticesStore.getAll();
  const notices = allNotices.slice(0, 4);
  const unread = unreadNoticeCount(allNotices.map((n) => n.id));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-card/75 px-3 backdrop-blur-xl sm:h-[60px] sm:gap-3 sm:px-5 lg:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div
          className={`relative min-w-0 flex-1 ${searchOpen ? "block" : "hidden sm:block"} max-w-sm`}
          data-tour="header-search"
        >
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
            placeholder="Search…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent/40 focus:bg-card focus:ring-2 focus:ring-accent/15"
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[60vh] overflow-hidden overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
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
                          setSearchOpen(false);
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
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            setBellOpen(false);
          }}
          className="rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground sm:hidden"
          aria-label="Search"
        >
          {searchOpen ? <X size={18} /> : <Search size={18} />}
        </button>
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
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-sm font-semibold">Notices</p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-accent"
                      onClick={() => markAllNoticesRead(allNotices.map((n) => n.id))}
                    >
                      Mark all read
                    </button>
                  )}
                  <button type="button" onClick={() => setBellOpen(false)} className="text-muted">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {notices.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">No notices yet</li>
                ) : (
                  notices.map((n) => (
                    <li key={n.id} className="border-b border-border last:border-0">
                      <Link
                        href="/portal/notices"
                        onClick={() => {
                          markNoticeRead(n.id);
                          setBellOpen(false);
                        }}
                        className="block px-4 py-3 transition hover:bg-surface"
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.content}</p>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/portal/notices"
                onClick={() => {
                  markAllNoticesRead(allNotices.map((n) => n.id));
                  setBellOpen(false);
                }}
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
          className="hidden rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground sm:inline-flex"
        >
          <MessageSquare size={18} />
        </Link>

        <Link
          href="/portal/account"
          data-tour="header-profile"
          className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1 pr-1.5 transition hover:border-accent/30 sm:ml-2 sm:gap-2.5 sm:pr-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-[11px] font-bold text-white">
            {user ? initials(user.name) : "—"}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {user?.name ?? "Guest"}
            </p>
            <p className="truncate text-[11px] text-muted">
              {user ? ROLE_LABELS[user.role] : "—"}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
