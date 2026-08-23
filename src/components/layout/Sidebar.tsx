"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  FolderOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  Bell,
  Palette,
  CreditCard,
  ClipboardList,
  ChevronDown,
  Settings,
  LogOut,
  UserCog,
  Wallet,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { useAuth } from "@/components/auth/AuthProvider";
import { startTour } from "@/components/tour/GuidedTour";
import { portalTourKey } from "@/components/tour/PortalTour";
import type { UserRole } from "@/lib/types";

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const P = "/portal";

function navForRole(role: UserRole): NavSection[] {
  const overview: NavSection = {
    title: "Overview",
    items: [{ label: "Dashboard", href: P, icon: <LayoutDashboard size={17} /> }],
  };

  if (role === "super_admin") {
    return [
      overview,
      {
        title: "Academics",
        items: [
          { label: "Admissions", href: `${P}/admissions`, icon: <ClipboardList size={17} /> },
          { label: "Courses", href: `${P}/courses`, icon: <BookOpen size={17} /> },
          { label: "Modules", href: `${P}/modules`, icon: <Layers size={17} /> },
          { label: "Schedule", href: `${P}/schedule`, icon: <Calendar size={17} /> },
          { label: "Attendance", href: `${P}/attendance`, icon: <ClipboardCheck size={17} /> },
          {
            label: "Assessments",
            icon: <FileText size={17} />,
            children: [
              { label: "All Assessments", href: `${P}/assessments` },
              { label: "Projects", href: `${P}/projects` },
            ],
          },
          { label: "Portfolio", href: `${P}/projects`, icon: <Palette size={17} /> },
        ],
      },
      {
        title: "People",
        items: [
          {
            label: "Learners",
            icon: <Users size={17} />,
            children: [
              { label: "All Learners", href: `${P}/learners` },
              { label: "Enrollments", href: `${P}/enrollments` },
            ],
          },
          {
            label: "Tutors",
            icon: <GraduationCap size={17} />,
            children: [{ label: "All Tutors", href: `${P}/instructors` }],
          },
          { label: "Accounts", href: `${P}/accounts`, icon: <UserCog size={17} /> },
        ],
      },
      {
        title: "Operations",
        items: [
          { label: "Payments", href: `${P}/payments`, icon: <Wallet size={17} /> },
          { label: "Resources", href: `${P}/resources`, icon: <FolderOpen size={17} /> },
          { label: "Notices", href: `${P}/notices`, icon: <Bell size={17} /> },
          {
            label: "Account",
            icon: <CreditCard size={17} />,
            children: [
              { label: "Billing", href: `${P}/enrollments` },
              { label: "My profile", href: `${P}/account` },
              { label: "Settings", href: `${P}/settings` },
            ],
          },
        ],
      },
    ];
  }

  if (role === "accountant") {
    return [
      overview,
      {
        title: "Finance",
        items: [
          { label: "Payments", href: `${P}/payments`, icon: <Wallet size={17} /> },
          { label: "Enrollments", href: `${P}/enrollments`, icon: <CreditCard size={17} /> },
          { label: "Admissions fees", href: `${P}/admissions`, icon: <ClipboardList size={17} /> },
          { label: "Learners", href: `${P}/learners`, icon: <Users size={17} /> },
        ],
      },
      {
        title: "Management",
        items: [
          { label: "Accounts", href: `${P}/accounts`, icon: <UserCog size={17} /> },
          { label: "Notices", href: `${P}/notices`, icon: <Bell size={17} /> },
          { label: "My profile", href: `${P}/account`, icon: <UserRound size={17} /> },
          { label: "Settings", href: `${P}/settings`, icon: <Settings size={17} /> },
        ],
      },
    ];
  }

  if (role === "tutor") {
    return [
      overview,
      {
        title: "Teaching",
        items: [
          { label: "Schedule", href: `${P}/schedule`, icon: <Calendar size={17} /> },
          { label: "Attendance", href: `${P}/attendance`, icon: <ClipboardCheck size={17} /> },
          { label: "Assessments", href: `${P}/assessments`, icon: <FileText size={17} /> },
          { label: "Projects", href: `${P}/projects`, icon: <Palette size={17} /> },
          { label: "Learners", href: `${P}/learners`, icon: <Users size={17} /> },
        ],
      },
      {
        title: "Content",
        items: [
          { label: "Courses", href: `${P}/courses`, icon: <BookOpen size={17} /> },
          { label: "Modules", href: `${P}/modules`, icon: <Layers size={17} /> },
          { label: "Resources", href: `${P}/resources`, icon: <FolderOpen size={17} /> },
          { label: "Notices", href: `${P}/notices`, icon: <Bell size={17} /> },
          { label: "My profile", href: `${P}/account`, icon: <UserRound size={17} /> },
        ],
      },
    ];
  }

  // student
  return [
    overview,
    {
      title: "My course",
      items: [
        { label: "Schedule", href: `${P}/schedule`, icon: <Calendar size={17} /> },
        { label: "Attendance", href: `${P}/attendance`, icon: <ClipboardCheck size={17} /> },
        { label: "Assessments", href: `${P}/assessments`, icon: <FileText size={17} /> },
        { label: "My projects", href: `${P}/projects`, icon: <Palette size={17} /> },
        { label: "Resources", href: `${P}/resources`, icon: <FolderOpen size={17} /> },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Fees & billing", href: `${P}/enrollments`, icon: <CreditCard size={17} /> },
        { label: "Notices", href: `${P}/notices`, icon: <Bell size={17} /> },
        { label: "My profile", href: `${P}/account`, icon: <UserRound size={17} /> },
      ],
    },
  ];
}

export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<string[]>(["Learners", "Assessments", "Account"]);

  const navSections = useMemo(
    () => (user ? navForRole(user.role) : []),
    [user]
  );

  const toggle = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) =>
    href === P ? pathname === P : pathname.startsWith(href);

  const tourFor = (href?: string) => {
    if (href === `${P}/accounts`) return "nav-accounts";
    if (href === `${P}/payments`) return "nav-payments";
    if (href === `${P}/attendance`) return "nav-attendance";
    return undefined;
  };

  const onLogout = () => {
    void (async () => {
      await logout();
      router.replace("/login");
    })();
  };

  const closeIfMobile = () => onClose?.();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(280px,88vw)] flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-out lg:w-[260px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <Link href={P} className="block min-w-0 flex-1" onClick={closeIfMobile}>
          <BrandLogo
            width={220}
            height={208}
            className="mx-auto h-auto w-full max-w-[168px] sm:max-w-[180px]"
            priority
          />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav
        data-tour="nav-sidebar"
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      >
        {navSections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const hasChildren = !!item.children?.length;
                const isExpanded = expanded.includes(item.label);
                const active = item.href
                  ? isActive(item.href)
                  : item.children?.some((c) => isActive(c.href));

                if (hasChildren) {
                  return (
                    <li key={item.label}>
                      <button
                        onClick={() => toggle(item.label)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors sm:py-2",
                          active
                            ? "bg-accent/10 font-semibold text-accent"
                            : "text-muted hover:bg-surface-hover hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          {item.icon}
                          {item.label}
                        </span>
                        <ChevronDown
                          size={14}
                          className={cn(
                            "transition-transform",
                            isExpanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                      {isExpanded && (
                        <ul className="mt-0.5 space-y-0.5 pl-3">
                          {item.children!.map((child) => (
                            <li key={child.href + child.label}>
                              <Link
                                href={child.href}
                                data-tour={tourFor(child.href)}
                                onClick={closeIfMobile}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-[13px] transition-colors sm:py-1.5",
                                  isActive(child.href)
                                    ? "font-semibold text-accent"
                                    : "text-muted hover:text-foreground"
                                )}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href!}
                      data-tour={tourFor(item.href)}
                      onClick={closeIfMobile}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors sm:py-2",
                        active
                          ? "bg-accent/10 font-semibold text-accent"
                          : "text-muted hover:bg-surface-hover hover:text-foreground"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {(user?.role === "super_admin" || user?.role === "accountant") && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              Record a payment
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
              Confirm fees &amp; email student login
            </p>
            <Link
              href={`${P}/payments`}
              onClick={closeIfMobile}
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-accent py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Open payments
            </Link>
          </div>
        )}
        {user?.role === "student" && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              Your portal
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
              Track classes, fees, and projects
            </p>
            <Link
              href={`${P}/account`}
              onClick={closeIfMobile}
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-accent py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              My profile
            </Link>
          </div>
        )}
        {user?.role === "tutor" && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              Teaching
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
              Mark attendance and review work
            </p>
            <Link
              href={`${P}/attendance`}
              onClick={closeIfMobile}
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-accent py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Attendance
            </Link>
          </div>
        )}
        <Link
          href={`${P}/account`}
          onClick={closeIfMobile}
          className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface-hover hover:text-foreground sm:py-2"
        >
          <UserRound size={17} />
          My profile
        </Link>
        {(user?.role === "super_admin" || user?.role === "accountant") && (
          <Link
            href={`${P}/settings`}
            onClick={closeIfMobile}
            className="mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface-hover hover:text-foreground sm:py-2"
          >
            <Settings size={17} />
            Settings
          </Link>
        )}
        <button
          type="button"
          onClick={() => user && startTour(portalTourKey(user.id))}
          className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface-hover hover:text-foreground sm:py-2"
        >
          Replay tour
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface-hover hover:text-foreground sm:py-2"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
