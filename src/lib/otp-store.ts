import { createHash, randomInt } from "crypto";

export const OTP_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "login" | "reset";

type Entry = {
  hash: string;
  expiresAt: number;
  attempts: number;
};

const globalStore = globalThis as typeof globalThis & {
  __dreyzOtpStore?: Map<string, Entry>;
};

function store() {
  if (!globalStore.__dreyzOtpStore) {
    globalStore.__dreyzOtpStore = new Map();
  }
  return globalStore.__dreyzOtpStore;
}

function key(purpose: OtpPurpose, email: string) {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

/** Always returns a 6-digit numeric string (000000–999999). */
export function createSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function saveOtp(purpose: OtpPurpose, email: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== OTP_LENGTH) {
    throw new Error(`OTP must be ${OTP_LENGTH} digits.`);
  }
  store().set(key(purpose, email), {
    hash: createHash("sha256").update(normalized).digest("hex"),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
}

export function checkStoredOtp(
  purpose: OtpPurpose,
  email: string,
  code: string
): { ok: true } | { ok: false; error: string } {
  const k = key(purpose, email);
  const entry = store().get(k);
  if (!entry) {
    return { ok: false, error: "No code found. Request a new one." };
  }
  if (Date.now() > entry.expiresAt) {
    store().delete(k);
    return { ok: false, error: "Code expired. Request a new one." };
  }

  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }

  const hash = createHash("sha256").update(normalized).digest("hex");
  if (hash !== entry.hash) {
    return { ok: false, error: "Invalid code. Try again." };
  }

  return { ok: true };
}

export function verifyStoredOtp(
  purpose: OtpPurpose,
  email: string,
  code: string
): { ok: true } | { ok: false; error: string } {
  const k = key(purpose, email);
  const entry = store().get(k);
  if (!entry) {
    return { ok: false, error: "No code found. Request a new one." };
  }
  if (Date.now() > entry.expiresAt) {
    store().delete(k);
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store().delete(k);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  entry.attempts += 1;

  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }

  const hash = createHash("sha256").update(normalized).digest("hex");
  if (hash !== entry.hash) {
    return { ok: false, error: "Invalid code. Try again." };
  }

  store().delete(k);
  return { ok: true };
}
