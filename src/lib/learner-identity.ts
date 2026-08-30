import {
  attendanceStore,
  enrollmentsStore,
  gradesStore,
  learnersStore,
  projectsStore,
  recordSchoolTombstone,
} from "./store";
import type { Learner, PaymentRecord, PortalUser } from "./types";
import { formatAdmissionNumber, parseAdmissionNumber } from "./admission-number";

export { formatAdmissionNumber, parseAdmissionNumber } from "./admission-number";

const USERS_KEY = "dreyz_users";
const PAYMENTS_KEY = "dreyz_payments";

function isBrowser() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key } }));
  void import("./store").then((mod) => mod.queueCloudPush());
}

function readUsers(): PortalUser[] {
  return readJson<PortalUser[]>(USERS_KEY, []);
}

function readPayments(): PaymentRecord[] {
  return readJson<PaymentRecord[]>(PAYMENTS_KEY, []);
}

/** Next free DRY### from every known learner / portal learnerId. */
export function allocateAdmissionNumber(extraIds: string[] = []): string {
  const ids = new Set<string>(extraIds);
  for (const l of learnersStore.getAll()) ids.add(l.id);
  for (const u of readUsers()) {
    if (u.learnerId) ids.add(u.learnerId);
  }
  let max = 0;
  for (const id of ids) max = Math.max(max, parseAdmissionNumber(id));
  return formatAdmissionNumber(max + 1);
}

/** Prefer existing roster / account link for this email so we never mint a second ID. */
export function findExistingStudentIdentity(email: string): {
  learnerId?: string;
  learner?: Learner;
  userId?: string;
} {
  const e = email.trim().toLowerCase();
  if (!e) return {};
  const learner =
    learnersStore.getAll().find((l) => l.email.toLowerCase() === e) ?? undefined;
  const user = readUsers().find(
    (u) => u.role === "student" && u.email.toLowerCase() === e
  );
  return {
    learnerId: learner?.id ?? user?.learnerId ?? undefined,
    learner,
    userId: user?.id,
  };
}

/**
 * Resolve the single admission number for a new or returning student.
 * Reuses existing learner/account IDs when the email already exists.
 */
export function resolveStudentAdmissionId(opts: {
  email: string;
  preferredId?: string;
}): string {
  const existing = findExistingStudentIdentity(opts.email);
  if (existing.learnerId) return existing.learnerId;
  const preferred = opts.preferredId?.trim();
  if (preferred && parseAdmissionNumber(preferred) > 0) {
    return preferred.toUpperCase().startsWith("DRY")
      ? preferred.toUpperCase()
      : formatAdmissionNumber(parseAdmissionNumber(preferred));
  }
  return allocateAdmissionNumber(preferred ? [preferred] : []);
}

export type PurgeStudentResult = {
  learnerId?: string;
  email?: string;
  removedLearner: boolean;
  removedAccount: boolean;
  removedEnrollments: number;
  removedAttendance: number;
  removedGrades: number;
  removedProjects: number;
  removedPayments: number;
};

/**
 * One student identity across Accounts, Learners, Enrolments, and academics.
 * Deleting from any surface should call this so nothing is left orphaned.
 */
export async function purgeStudentIdentity(opts: {
  learnerId?: string;
  email?: string;
  /** Keep confirmed payment history for audit (default true). */
  keepPayments?: boolean;
}): Promise<PurgeStudentResult> {
  const keepPayments = opts.keepPayments !== false;
  const byId = opts.learnerId
    ? learnersStore.getAll().find((l) => l.id === opts.learnerId)
    : undefined;
  const email = (opts.email || byId?.email || "").trim().toLowerCase();
  const learnerId =
    opts.learnerId ||
    byId?.id ||
    (email
      ? learnersStore.getAll().find((l) => l.email.toLowerCase() === email)?.id
      : undefined);

  recordSchoolTombstone({ learnerId, email });

  const result: PurgeStudentResult = {
    learnerId,
    email: email || undefined,
    removedLearner: false,
    removedAccount: false,
    removedEnrollments: 0,
    removedAttendance: 0,
    removedGrades: 0,
    removedProjects: 0,
    removedPayments: 0,
  };

  if (learnerId) {
    const beforeAtt = attendanceStore.getAll().length;
    attendanceStore.replaceAll(
      attendanceStore.getAll().filter((r) => r.learnerId !== learnerId)
    );
    result.removedAttendance = beforeAtt - attendanceStore.getAll().length;

    const beforeGrades = gradesStore.getAll().length;
    gradesStore.replaceAll(gradesStore.getAll().filter((g) => g.learnerId !== learnerId));
    result.removedGrades = beforeGrades - gradesStore.getAll().length;

    const beforePrj = projectsStore.getAll().length;
    projectsStore.replaceAll(projectsStore.getAll().filter((p) => p.learnerId !== learnerId));
    result.removedProjects = beforePrj - projectsStore.getAll().length;

    if (learnersStore.getAll().some((l) => l.id === learnerId)) {
      learnersStore.remove(learnerId);
      result.removedLearner = true;
    }
  }

  if (email) {
    const beforeEnr = enrollmentsStore.getAll().length;
    enrollmentsStore.replaceAll(
      enrollmentsStore.getAll().filter((e) => {
        const eMail = (e.learnerEmail || "").toLowerCase();
        const eName = (e.learnerName || "").toLowerCase();
        const learnerName = (byId?.name || "").toLowerCase();
        if (eMail && eMail === email) return false;
        if (!eMail && learnerName && eName === learnerName) return false;
        return true;
      })
    );
    result.removedEnrollments = beforeEnr - enrollmentsStore.getAll().length;

    if (!keepPayments) {
      const nextPays = readPayments().filter((p) => {
        if (p.learnerEmail.toLowerCase() === email) {
          result.removedPayments += 1;
          return false;
        }
        return true;
      });
      writeJson(PAYMENTS_KEY, nextPays);
    }

    const nextUsers = readUsers().filter((u) => {
      const hit =
        u.role === "student" &&
        (u.email.toLowerCase() === email || (learnerId && u.learnerId === learnerId));
      if (hit) result.removedAccount = true;
      return !hit;
    });
    writeJson(USERS_KEY, nextUsers);
  } else if (learnerId) {
    const nextUsers = readUsers().filter((u) => {
      const hit = u.role === "student" && u.learnerId === learnerId;
      if (hit) result.removedAccount = true;
      return !hit;
    });
    writeJson(USERS_KEY, nextUsers);
  }

  if (isBrowser() && (learnerId || email)) {
    try {
      await fetch("/api/learners/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId, email }),
      });
    } catch {
      /* local tombstone still blocks resurrection on the next sync */
    }
    void import("./store").then((mod) => mod.queueCloudPush());
  }

  return result;
}
