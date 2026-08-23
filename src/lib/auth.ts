import type {
  CredentialEmail,
  PaymentRecord,
  PortalUser,
  SessionUser,
  UserRole,
} from "./types";
import { feeTracks, classOptions, schoolInfo } from "./data";
import { portalLoginUrl } from "./portal-url";
import { upsertInstructorFromAccount, upsertLearnerFromPayment } from "./store";

export const SESSION_COOKIE = "dreyz_session";
export const USERS_KEY = "dreyz_users";
export const PAYMENTS_KEY = "dreyz_payments";
export const EMAIL_OUTBOX_KEY = "dreyz_email_outbox";

export const DEMO_PASSWORD = "dreyz2026";

/** Seed accounts — use these on the login screen */
export const SEED_USERS: PortalUser[] = [
  {
    id: "USR-SA-001",
    name: "Ngwero Emmanuel",
    email: "engwero@gmail.com",
    password: DEMO_PASSWORD,
    role: "super_admin",
    phone: schoolInfo.phones[0],
    status: "active",
    createdAt: "2025-01-01",
  },
  {
    id: "USR-AC-001",
    name: "Sarah Namukasa",
    email: "accounts@dreyzinteriorug.com",
    password: DEMO_PASSWORD,
    role: "accountant",
    phone: schoolInfo.phones[1],
    status: "active",
    createdAt: "2025-01-15",
  },
  {
    id: "USR-TU-001",
    name: "Elena Vasquez",
    email: "elena@dreyzinteriorug.com",
    password: DEMO_PASSWORD,
    role: "tutor",
    instructorId: "INS001",
    specialty: "Residential & colour theory",
    status: "active",
    createdAt: "2025-02-01",
  },
  {
    id: "USR-TU-002",
    name: "Marcus Webb",
    email: "marcus@dreyzinteriorug.com",
    password: DEMO_PASSWORD,
    role: "tutor",
    instructorId: "INS002",
    specialty: "Lighting & spatial planning",
    status: "active",
    createdAt: "2025-02-01",
  },
  {
    id: "USR-ST-001",
    name: "Grace Nakato",
    email: "grace.n@email.com",
    password: DEMO_PASSWORD,
    role: "student",
    learnerId: "DRY007",
    phone: "+256 712 345 678",
    feeTrackId: "4-month",
    classOptionId: "weekday",
    status: "active",
    createdAt: "2025-06-08",
  },
  {
    id: "USR-ST-002",
    name: "Amara Okafor",
    email: "amara.o@email.com",
    password: DEMO_PASSWORD,
    role: "student",
    learnerId: "DRY001",
    phone: "+234 801 234 5678",
    feeTrackId: "6-month",
    classOptionId: "weekday-pm",
    status: "active",
    createdAt: "2025-09-12",
  },
];

export const DEMO_LOGINS: { role: UserRole; email: string; label: string }[] = [
  { role: "super_admin", email: "engwero@gmail.com", label: "Super Admin" },
  { role: "accountant", email: "accounts@dreyzinteriorug.com", label: "Accountant" },
  { role: "tutor", email: "elena@dreyzinteriorug.com", label: "Tutor" },
  { role: "student", email: "grace.n@email.com", label: "Student" },
];

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
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key } }));
  void import("./store").then((mod) => mod.queueCloudPush());
}

export function getAllUsers(): PortalUser[] {
  const extras = readJson<PortalUser[]>(USERS_KEY, []);
  const byId = new Map<string, PortalUser>();
  for (const u of SEED_USERS) byId.set(u.id, u);
  for (const u of extras) {
    const duplicate = [...byId.values()].find(
      (x) => x.id !== u.id && x.email.toLowerCase() === u.email.toLowerCase()
    );
    if (duplicate) byId.delete(duplicate.id);
    byId.set(u.id, u);
  }
  return Array.from(byId.values());
}

export function saveExtraUser(user: PortalUser) {
  const extras = readJson<PortalUser[]>(USERS_KEY, []);
  const i = extras.findIndex(
    (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
  );
  if (i >= 0) extras[i] = user;
  else extras.push(user);
  writeJson(USERS_KEY, extras);
}

export function updateUserStatus(userId: string, status: "active" | "inactive") {
  return updateAccount(userId, { status });
}

export function getUserById(userId: string): PortalUser | undefined {
  return getAllUsers().find((u) => u.id === userId);
}

export function upsertUser(user: PortalUser) {
  saveExtraUser(user);
  const session = getSession();
  if (session?.id === user.id) {
    setSession(toSession(user));
  }
  return user;
}

export function deleteUser(userId: string) {
  const extras = readJson<PortalUser[]>(USERS_KEY, []);
  const next = extras.filter((u) => u.id !== userId);
  const seed = SEED_USERS.find((u) => u.id === userId);
  if (seed) {
    next.push({ ...seed, status: "inactive" });
  }
  writeJson(USERS_KEY, next);
}

export function authenticate(email: string, password: string): SessionUser | null {
  const user = getAllUsers().find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password &&
      u.status === "active"
  );
  if (!user) return null;
  upsertUser({ ...user, lastLoginAt: new Date().toISOString() });
  return toSession({ ...user, lastLoginAt: new Date().toISOString() });
}

export function toSession(user: PortalUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    learnerId: user.learnerId,
    instructorId: user.instructorId,
  };
}

export function setSession(user: SessionUser) {
  if (!isBrowser()) return;
  const payload = JSON.stringify(user);
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(payload)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  localStorage.setItem(SESSION_COOKIE, payload);
  window.dispatchEvent(new CustomEvent("dreyz-auth", { detail: { type: "login" } }));
}

export function clearSession() {
  if (!isBrowser()) return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  localStorage.removeItem(SESSION_COOKIE);
  sessionStorage.removeItem(SESSION_COOKIE);
  window.dispatchEvent(new CustomEvent("dreyz-auth", { detail: { type: "logout" } }));
}

export function getSession(): SessionUser | null {
  if (!isBrowser()) return null;
  try {
    const raw =
      localStorage.getItem(SESSION_COOKIE) ||
      document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
        ?.split("=")
        .slice(1)
        .join("=");
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}

export function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function queueLoginEmail(opts: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  feeTrackId?: string;
  classOptionId?: string;
}): CredentialEmail {
  const roleLabel =
    opts.role === "super_admin"
      ? "Super Admin"
      : opts.role === "accountant"
        ? "Accountant"
        : opts.role === "tutor"
          ? "Tutor"
          : "Student";
  const track = feeTracks.find((t) => t.id === opts.feeTrackId);
  const klass = classOptions.find((c) => c.id === opts.classOptionId);
  const subject = `Your Dreyz Interior ${roleLabel.toLowerCase()} login`;
  const extra =
    opts.role === "student"
      ? [
          ``,
          `Programme: ${track?.name ?? "Interior Design"}`,
          `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
        ]
      : [];
  const body = [
    `Dear ${opts.name},`,
    ``,
    `Your ${roleLabel} portal account is ready.`,
    ...extra,
    ``,
    `Login details`,
    `Portal: ${portalLoginUrl()}`,
    `Email: ${opts.email}`,
    `Temporary password: ${opts.password}`,
    ``,
    `Please sign in and change your password from My Account.`,
    ``,
    `Questions? ${schoolInfo.email} · ${schoolInfo.phones.join(" / ")}`,
    ``,
    `— ${schoolInfo.name}`,
    schoolInfo.tagline,
  ].join("\n");

  const email: CredentialEmail = {
    id: `MAIL-${Date.now().toString(36).toUpperCase()}`,
    to: opts.email,
    subject,
    body,
    sentAt: new Date().toISOString(),
    userId: opts.email,
  };
  pushEmail(email);
  if (isBrowser()) {
    console.info("[Dreyz email]", { to: email.to, subject: email.subject, body: email.body });
  }
  return email;
}

export type CreateAccountInput = {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  feeTrackId?: string;
  classOptionId?: string;
  specialty?: string;
  learnerId?: string;
  instructorId?: string;
};

export function createAccount(input: CreateAccountInput): {
  user: PortalUser;
  password: string;
  email: CredentialEmail;
} {
  const email = input.email.trim().toLowerCase();
  const existing = getAllUsers().find((u) => u.email.toLowerCase() === email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const password = generatePassword();
  const learnerId =
    input.role === "student"
      ? input.learnerId ?? `DRY${Date.now().toString(36).toUpperCase().slice(-5)}`
      : undefined;
  const instructorId =
    input.role === "tutor"
      ? input.instructorId ?? `INS${Date.now().toString(36).toUpperCase().slice(-5)}`
      : undefined;

  const user: PortalUser = {
    id: `USR-${input.role.slice(0, 2).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    name: input.name.trim(),
    email,
    password,
    role: input.role,
    phone: input.phone?.trim(),
    status: "active",
    learnerId,
    instructorId,
    feeTrackId: input.role === "student" ? input.feeTrackId : undefined,
    classOptionId: input.role === "student" ? input.classOptionId : undefined,
    specialty: input.role === "tutor" ? input.specialty?.trim() : undefined,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  upsertUser(user);
  syncLinkedRecords(user);

  const mail = queueLoginEmail({
    name: user.name,
    email: user.email,
    password,
    role: user.role,
    feeTrackId: user.feeTrackId,
    classOptionId: user.classOptionId,
  });

  return { user, password, email: mail };
}

export function updateAccount(
  userId: string,
  patch: Partial<Omit<PortalUser, "id" | "createdAt" | "password">>
): PortalUser {
  const current = getUserById(userId);
  if (!current) throw new Error("Account not found.");
  const next: PortalUser = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    email: patch.email ? patch.email.trim().toLowerCase() : current.email,
    name: patch.name ? patch.name.trim() : current.name,
  };
  if (next.role === "student" && !next.learnerId) {
    next.learnerId = `DRY${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }
  if (next.role === "tutor" && !next.instructorId) {
    next.instructorId = `INS${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }
  const clash = getAllUsers().find(
    (u) => u.id !== userId && u.email.toLowerCase() === next.email
  );
  if (clash) throw new Error("Another account already uses that email.");
  upsertUser(next);
  syncLinkedRecords(next);
  return next;
}

export function changePassword(userId: string, nextPassword: string): PortalUser {
  const current = getUserById(userId);
  if (!current) throw new Error("Account not found.");
  if (nextPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  return upsertUser({ ...current, password: nextPassword });
}

export function changePasswordByEmail(
  email: string,
  nextPassword: string
): boolean {
  if (nextPassword.length < 6) return false;
  const current = getAllUsers().find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!current) return false;
  upsertUser({ ...current, password: nextPassword });
  return true;
}

export function resendLoginEmail(userId: string): CredentialEmail {
  const current = getUserById(userId);
  if (!current) throw new Error("Account not found.");
  return queueLoginEmail({
    name: current.name,
    email: current.email,
    password: current.password,
    role: current.role,
    feeTrackId: current.feeTrackId,
    classOptionId: current.classOptionId,
  });
}

export function resetUserPassword(userId: string): { user: PortalUser; password: string; email: CredentialEmail } {
  const current = getUserById(userId);
  if (!current) throw new Error("Account not found.");
  const password = generatePassword();
  const user = upsertUser({ ...current, password });
  const email = queueLoginEmail({
    name: user.name,
    email: user.email,
    password,
    role: user.role,
    feeTrackId: user.feeTrackId,
    classOptionId: user.classOptionId,
  });
  return { user, password, email };
}

function syncLinkedRecords(user: PortalUser) {
  if (user.role === "student" && user.learnerId) {
    const track = feeTracks.find((t) => t.id === user.feeTrackId);
    upsertLearnerFromPayment({
      id: user.learnerId,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      course: track?.name ?? "Professional Interior Design Programme",
      status: user.status === "active" ? "active" : "paused",
    });
  }
  if (user.role === "tutor" && user.instructorId) {
    upsertInstructorFromAccount({
      id: user.instructorId,
      name: user.name,
      email: user.email,
      specialty: user.specialty ?? "Interior Design",
      status: user.status === "active" ? "active" : "on-leave",
    });
  }
}

export function getPayments(): PaymentRecord[] {
  return readJson<PaymentRecord[]>(PAYMENTS_KEY, []);
}

export function getEmailOutbox(): CredentialEmail[] {
  return readJson<CredentialEmail[]>(EMAIL_OUTBOX_KEY, []);
}

function pushEmail(email: CredentialEmail) {
  const box = getEmailOutbox();
  box.unshift(email);
  writeJson(EMAIL_OUTBOX_KEY, box);
}

function pushPayment(payment: PaymentRecord) {
  const list = getPayments();
  list.unshift(payment);
  writeJson(PAYMENTS_KEY, list);
}

export function buildCredentialEmail(opts: {
  name: string;
  email: string;
  password: string;
  feeTrackId: string;
  classOptionId: string;
}): { subject: string; body: string } {
  const track = feeTracks.find((t) => t.id === opts.feeTrackId);
  const klass = classOptions.find((c) => c.id === opts.classOptionId);
  const subject = `Your Dreyz Interior student login`;
  const body = [
    `Dear ${opts.name},`,
    ``,
    `Thank you for your payment. Your student account is ready.`,
    ``,
    `Programme: ${track?.name ?? "Interior Design"}`,
    `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
    ``,
    `Login details`,
    `Portal: ${portalLoginUrl()}`,
    `Email: ${opts.email}`,
    `Temporary password: ${opts.password}`,
    ``,
    `Please sign in and change your password from My Account.`,
    ``,
    `Questions? ${schoolInfo.email} · ${schoolInfo.phones.join(" / ")}`,
    ``,
    `— ${schoolInfo.name}`,
    schoolInfo.tagline,
  ].join("\n");
  return { subject, body };
}

export type ConfirmPaymentInput = {
  learnerName: string;
  learnerEmail: string;
  phone: string;
  feeTrackId: string;
  classOptionId: string;
  amount: number;
  method: PaymentRecord["method"];
  reference: string;
};

export type ConfirmPaymentResult = {
  payment: PaymentRecord;
  user: PortalUser;
  email: CredentialEmail;
};

/** Confirm payment → create student account → queue/send login email */
export function confirmPaymentAndProvision(
  input: ConfirmPaymentInput
): ConfirmPaymentResult {
  const existing = getAllUsers().find(
    (u) => u.email.toLowerCase() === input.learnerEmail.trim().toLowerCase()
  );

  const password = existing?.role === "student" ? existing.password : generatePassword();
  const learnerId =
    existing?.learnerId ??
    `DRY${String(Math.floor(100 + Math.random() * 900))}`;
  const userId = existing?.id ?? `USR-ST-${Date.now().toString(36).toUpperCase()}`;

  const user: PortalUser = {
    id: userId,
    name: input.learnerName.trim(),
    email: input.learnerEmail.trim().toLowerCase(),
    password,
    role: "student",
    phone: input.phone.trim(),
    status: "active",
    learnerId,
    feeTrackId: input.feeTrackId,
    classOptionId: input.classOptionId,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  saveExtraUser(user);

  const track = feeTracks.find((t) => t.id === input.feeTrackId);
  upsertLearnerFromPayment({
    id: learnerId,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    course: track?.name ?? "Professional Interior Design Programme",
  });

  const { subject, body } = buildCredentialEmail({
    name: user.name,
    email: user.email,
    password,
    feeTrackId: input.feeTrackId,
    classOptionId: input.classOptionId,
  });

  const payment: PaymentRecord = {
    id: `PAY-${Date.now().toString(36).toUpperCase()}`,
    learnerName: user.name,
    learnerEmail: user.email,
    phone: user.phone ?? "",
    feeTrackId: input.feeTrackId,
    classOptionId: input.classOptionId,
    amount: input.amount,
    method: input.method,
    reference: input.reference.trim() || `REF-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    status: "confirmed",
    credentialsSent: true,
    studentUserId: user.id,
  };
  pushPayment(payment);

  const paidTotal = getPayments()
    .filter(
      (p) =>
        p.learnerEmail.toLowerCase() === user.email &&
        p.status === "confirmed"
    )
    .reduce((s, p) => s + p.amount, 0);
  upsertLearnerFromPayment({
    id: learnerId,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    course: track?.name ?? "Professional Interior Design Programme",
    status: paidTotal >= 1_000_000 ? "active" : "paused",
  });

  const email: CredentialEmail = {
    id: `MAIL-${Date.now().toString(36).toUpperCase()}`,
    to: user.email,
    subject,
    body,
    sentAt: new Date().toISOString(),
    paymentId: payment.id,
    userId: user.id,
  };
  pushEmail(email);

  // Ready for a real mailer (Resend/Nodemailer) — logged for demo
  if (isBrowser()) {
    console.info("[Dreyz email]", { to: email.to, subject: email.subject, body: email.body });
    // Sync payment + learner to Supabase (best-effort)
    void import("@/lib/supabase/data").then(({ upsertPayment, upsertLearner, insertEmailOutbox }) => {
      void upsertPayment(payment);
      void upsertLearner({
        id: learnerId,
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        course: track?.name ?? "Professional Interior Design Programme",
        enrollmentDate: payment.date,
        progress: 0,
        status: "active",
      });
      void insertEmailOutbox(email);
    });
  }

  return { payment, user, email };
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
