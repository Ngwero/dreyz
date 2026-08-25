import type { SessionUser } from "@/lib/types";
import { getAllUsers, getEmailOutbox, getPayments } from "@/lib/auth";
import { formatUGX } from "@/lib/utils";
import {
  assessmentsStore,
  attendanceStore,
  enrollmentsStore,
  gradesStore,
  learnersStore,
  noticesStore,
  projectsStore,
  scheduleStore,
} from "@/lib/store";

export type ActivityCategory =
  | "email"
  | "payment"
  | "learner"
  | "attendance"
  | "assessment"
  | "notice"
  | "schedule"
  | "login"
  | "project"
  | "portal";

export type ActivityTone = "success" | "error" | "info";

export type ActivityItem = {
  id: string;
  at: number;
  category: ActivityCategory;
  title: string;
  detail: string;
  href?: string;
  tone: ActivityTone;
  emails: string[];
  learnerIds: string[];
};

const LOG_KEY = "dreyz_activity_log";
const MAX_LOG = 250;

function isBrowser() {
  return typeof window !== "undefined";
}

function parseWhen(value: string | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Date.parse(`${trimmed}T12:00:00`);
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : 0;
}

function readLog(): ActivityItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(items: ActivityItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(LOG_KEY, JSON.stringify(items.slice(0, MAX_LOG)));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: LOG_KEY } }));
}

/** Record a portal action (emails, saves, errors) so Recent activity stays current. */
export function recordPortalActivity(input: {
  title: string;
  detail?: string;
  category?: ActivityCategory;
  tone?: ActivityTone;
  href?: string;
  emails?: string[];
  learnerIds?: string[];
}) {
  const item: ActivityItem = {
    id: `ACT-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 99)}`,
    at: Date.now(),
    category: input.category ?? "portal",
    title: input.title.trim(),
    detail: (input.detail ?? "").trim(),
    href: input.href,
    tone: input.tone ?? "info",
    emails: (input.emails ?? []).map((e) => e.toLowerCase()),
    learnerIds: input.learnerIds ?? [],
  };
  if (!item.title) return;
  writeLog([item, ...readLog()].slice(0, MAX_LOG));
}

function collectSchoolActivity(): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const mail of getEmailOutbox()) {
    items.push({
      id: `mail-${mail.id}`,
      at: parseWhen(mail.sentAt) || Date.now(),
      category: "email",
      title: mail.subject || "Login email sent",
      detail: `Sent to ${mail.to}`,
      href: "/portal/accounts",
      tone: "success",
      emails: [mail.to.toLowerCase()],
      learnerIds: [],
    });
  }

  for (const pay of getPayments()) {
    items.push({
      id: `pay-${pay.id}`,
      at: parseWhen(pay.date),
      category: "payment",
      title: `${pay.status === "confirmed" ? "Payment confirmed" : pay.status === "failed" ? "Payment failed" : "Payment pending"} · ${formatUGX(pay.amount)}`,
      detail: `${pay.learnerName} · ${pay.method.replace("_", " ")} · ${pay.reference || "no reference"}`,
      href: "/portal/payments",
      tone: pay.status === "failed" ? "error" : pay.status === "confirmed" ? "success" : "info",
      emails: [pay.learnerEmail.toLowerCase()],
      learnerIds: [],
    });
  }

  for (const row of enrollmentsStore.getAll()) {
    items.push({
      id: `enr-${row.id}`,
      at: parseWhen(row.date),
      category: "payment",
      title: `Billing ${row.status} · ${formatUGX(row.amount)}`,
      detail: `${row.learnerName} · ${row.course}`,
      href: "/portal/enrollments",
      tone: row.status === "paid" ? "success" : row.status === "refunded" ? "error" : "info",
      emails: row.learnerEmail ? [row.learnerEmail.toLowerCase()] : [],
      learnerIds: [],
    });
  }

  for (const learner of learnersStore.getAll()) {
    items.push({
      id: `lrn-${learner.id}`,
      at: parseWhen(learner.enrollmentDate),
      category: "learner",
      title: `${learner.name} enrolled`,
      detail: `${learner.course} · ${learner.status}`,
      href: "/portal/learners",
      tone: "info",
      emails: [learner.email.toLowerCase()],
      learnerIds: [learner.id],
    });
  }

  for (const rec of attendanceStore.getAll()) {
    items.push({
      id: `att-${rec.id}`,
      at: parseWhen(rec.date),
      category: "attendance",
      title: `${rec.learnerName} marked ${rec.status}`,
      detail: rec.course,
      href: "/portal/attendance",
      tone: rec.status === "absent" ? "error" : rec.status === "late" ? "info" : "success",
      emails: [],
      learnerIds: [rec.learnerId],
    });
  }

  for (const grade of gradesStore.getAll()) {
    items.push({
      id: `grd-${grade.id}`,
      at: parseWhen(grade.date),
      category: "assessment",
      title: `${grade.learnerName} scored ${grade.score}/${grade.maxScore} on ${grade.title}`,
      detail: `${grade.course} · ${grade.type}`,
      href: "/portal/assessments",
      tone: "success",
      emails: [],
      learnerIds: [grade.learnerId],
    });
  }

  for (const assessment of assessmentsStore.getAll()) {
    items.push({
      id: `asm-${assessment.id}`,
      at: parseWhen(assessment.date),
      category: "assessment",
      title: `${assessment.title} scheduled`,
      detail: `${assessment.course} · ${assessment.type}`,
      href: "/portal/assessments",
      tone: "info",
      emails: [],
      learnerIds: [],
    });
  }

  for (const project of projectsStore.getAll()) {
    items.push({
      id: `prj-${project.id}`,
      at: 0,
      category: "project",
      title: `${project.learnerName} · ${project.title}`,
      detail: `${project.status} · ${project.course}`,
      href: "/portal/projects",
      tone: project.status === "featured" ? "success" : "info",
      emails: [],
      learnerIds: [project.learnerId],
    });
  }

  for (const notice of noticesStore.getAll()) {
    items.push({
      id: `ntc-${notice.id}`,
      at: parseWhen(notice.date),
      category: "notice",
      title: notice.title,
      detail: notice.content.slice(0, 140),
      href: "/portal/notices",
      tone: notice.priority === "high" ? "error" : "info",
      emails: [],
      learnerIds: [],
    });
  }

  for (const session of scheduleStore.getAll()) {
    items.push({
      id: `sch-${session.id}`,
      at: parseWhen(session.date),
      category: "schedule",
      title: session.title,
      detail: `${session.course} · ${session.time} · ${session.instructor}`,
      href: "/portal/schedule",
      tone: "info",
      emails: [],
      learnerIds: [],
    });
  }

  for (const user of getAllUsers()) {
    if (!user.lastLoginAt) continue;
    items.push({
      id: `login-${user.id}-${user.lastLoginAt}`,
      at: parseWhen(user.lastLoginAt),
      category: "login",
      title: `${user.name} signed in`,
      detail: user.email,
      href: "/portal/accounts",
      tone: "success",
      emails: [user.email.toLowerCase()],
      learnerIds: user.learnerId ? [user.learnerId] : [],
    });
  }

  return items;
}

function visibleForRole(item: ActivityItem, user: SessionUser): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "accountant") {
    return ["email", "payment", "learner", "notice", "login", "portal"].includes(item.category);
  }
  if (user.role === "tutor") {
    return ["attendance", "assessment", "project", "schedule", "notice", "learner", "portal"].includes(
      item.category
    );
  }
  const email = user.email.toLowerCase();
  const own =
    item.emails.includes(email) ||
    (!!user.learnerId && item.learnerIds.includes(user.learnerId)) ||
    item.title.toLowerCase().includes(user.name.toLowerCase());
  if (item.category === "notice" || item.category === "schedule") return true;
  return own;
}

export function collectRecentActivity(user: SessionUser): ActivityItem[] {
  const merged = [...readLog(), ...collectSchoolActivity()];
  const seen = new Set<string>();
  const unique: ActivityItem[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique
    .filter((item) => visibleForRole(item, user))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function formatActivityTime(at: number): string {
  if (!at) return "Date not set";
  const delta = Date.now() - at;
  const mins = Math.round(delta / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleString();
}

export const ACTIVITY_CATEGORIES: { id: ActivityCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "email", label: "Emails" },
  { id: "payment", label: "Payments" },
  { id: "learner", label: "Learners" },
  { id: "attendance", label: "Attendance" },
  { id: "assessment", label: "Marks" },
  { id: "project", label: "Projects" },
  { id: "notice", label: "Notices" },
  { id: "schedule", label: "Schedule" },
  { id: "login", label: "Logins" },
  { id: "portal", label: "Portal actions" },
];
