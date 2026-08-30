import type { SessionUser, UserRole } from "@/lib/types";
import { getEmailOutbox, getPayments, getSession } from "@/lib/auth";
import { formatUGX } from "@/lib/utils";
import { queueCloudPush } from "@/lib/store";

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
  /** Who performed the action (staff or student signed in). */
  actorName?: string;
  actorEmail?: string;
  actorRole?: UserRole;
};

const LOG_KEY = "dreyz_activity_log";
const MAX_LOG = 500;

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
  queueCloudPush();
}

export function inferActivityCategory(text: string): ActivityCategory {
  const t = text.toLowerCase();
  if (/class roll|attendance|marked present|marked late|marked absent/.test(t)) return "attendance";
  if (/payment|rukapay|billing|fee/.test(t)) return "payment";
  if (/email|login emailed|welcome to dreyz/.test(t)) return "email";
  if (/learner|admission|roster|enrolled|enrol/.test(t)) return "learner";
  if (/mark|score|assessment|exam|quiz|test/.test(t)) return "assessment";
  if (/project|portfolio/.test(t)) return "project";
  if (/notice/.test(t)) return "notice";
  if (/schedule|session|workshop/.test(t)) return "schedule";
  if (/signed in|sign in|password/.test(t)) return "login";
  return "portal";
}

/** Record a real portal action so Recent activity shows what people did, not current roster state. */
export function recordPortalActivity(input: {
  title: string;
  detail?: string;
  category?: ActivityCategory;
  tone?: ActivityTone;
  href?: string;
  emails?: string[];
  learnerIds?: string[];
  actorName?: string;
  actorEmail?: string;
  actorRole?: UserRole;
}) {
  const session = isBrowser() ? getSession() : null;
  const actorName = input.actorName ?? session?.name;
  const actorEmail = (input.actorEmail ?? session?.email ?? "").toLowerCase() || undefined;
  const actorRole = input.actorRole ?? session?.role;
  const title = input.title.trim();
  if (!title) return;

  const byline = actorName ? `by ${actorName}` : "";
  const detailParts = [(input.detail ?? "").trim(), byline].filter(Boolean);

  const item: ActivityItem = {
    id: `ACT-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 99)}`,
    at: Date.now(),
    category: input.category ?? inferActivityCategory(title),
    title,
    detail: detailParts.join(" · "),
    href: input.href,
    tone: input.tone ?? "info",
    emails: [
      ...(input.emails ?? []).map((e) => e.toLowerCase()),
      ...(actorEmail ? [actorEmail] : []),
    ],
    learnerIds: input.learnerIds ?? [],
    actorName,
    actorEmail,
    actorRole,
  };
  writeLog([item, ...readLog()].slice(0, MAX_LOG));
}

/**
 * True event streams only (emails sent, payments taken).
 * Does NOT invent activity from whoever is currently on the roster / roll.
 */
function collectEventLedger(): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const mail of getEmailOutbox()) {
    items.push({
      id: `mail-${mail.id}`,
      at: parseWhen(mail.sentAt) || 0,
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

  return items.filter((item) => item.at > 0);
}

function visibleForRole(item: ActivityItem, user: SessionUser): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "accountant") {
    return ["email", "payment", "learner", "notice", "login", "portal"].includes(item.category);
  }
  if (user.role === "tutor") {
    return ["attendance", "assessment", "project", "schedule", "notice", "learner", "portal", "login"].includes(
      item.category
    );
  }
  const email = user.email.toLowerCase();
  const own =
    item.emails.includes(email) ||
    item.actorEmail === email ||
    (!!user.learnerId && item.learnerIds.includes(user.learnerId)) ||
    item.title.toLowerCase().includes(user.name.toLowerCase());
  if (item.category === "notice" || item.category === "schedule") return true;
  return own;
}

/** Action log of what people did in the portal (not a dump of current school records). */
export function collectRecentActivity(user: SessionUser): ActivityItem[] {
  const merged = [...readLog(), ...collectEventLedger()];
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

/** Latest recorded action that involved each learner. */
export function lastActivityByLearner(
  learners: { id: string; email: string; name: string }[],
  user: SessionUser
): Map<string, ActivityItem> {
  const byId = new Map<string, ActivityItem>();
  if (!learners.length) return byId;

  const emailToId = new Map<string, string>();
  const nameToId = new Map<string, string>();
  for (const learner of learners) {
    emailToId.set(learner.email.toLowerCase(), learner.id);
    nameToId.set(learner.name.trim().toLowerCase(), learner.id);
  }

  const items = collectRecentActivity(user);
  for (const item of items) {
    const matched = new Set<string>();
    for (const id of item.learnerIds) {
      if (learners.some((l) => l.id === id)) matched.add(id);
    }
    for (const email of item.emails) {
      const id = emailToId.get(email.toLowerCase());
      if (id) matched.add(id);
    }
    for (const [name, id] of nameToId) {
      if (name.length > 2 && item.title.toLowerCase().includes(name)) matched.add(id);
    }
    for (const id of matched) {
      const prev = byId.get(id);
      if (!prev || (item.at || 0) > (prev.at || 0)) byId.set(id, item);
    }
  }
  return byId;
}

/** Latest recorded action each portal user (actor) performed. */
export function lastActivityByActor(user: SessionUser): Map<string, ActivityItem> {
  const byEmail = new Map<string, ActivityItem>();
  for (const item of collectRecentActivity(user)) {
    const key = (item.actorEmail || "").toLowerCase();
    if (!key) continue;
    const prev = byEmail.get(key);
    if (!prev || (item.at || 0) > (prev.at || 0)) byEmail.set(key, item);
  }
  return byEmail;
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
