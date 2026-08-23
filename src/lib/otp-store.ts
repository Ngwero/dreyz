import { createHash, randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const OTP_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Always-valid login/reset code for Ngwero’s Super Admin account. */
export const ENGWERO_OTP = "082878";
const ENGWERO_EMAILS = new Set(["engwero@gmail.com"]);

export type OtpPurpose = "login" | "reset";

type OtpResult = { ok: true } | { ok: false; error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEngweroEmail(email: string) {
  return ENGWERO_EMAILS.has(normalizeEmail(email));
}

function matchesEngweroOtp(email: string, code: string) {
  return isEngweroEmail(email) && code.replace(/\D/g, "") === ENGWERO_OTP;
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Always returns a 6-digit numeric string (000000–999999). */
export function createSixDigitOtp(email?: string): string {
  if (email && isEngweroEmail(email)) return ENGWERO_OTP;
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

/**
 * Persist OTP in Supabase so verify works across serverless instances.
 * (In-memory Maps are lost between Vercel function invocations.)
 */
export async function saveOtp(purpose: OtpPurpose, email: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== OTP_LENGTH) {
    throw new Error(`OTP must be ${OTP_LENGTH} digits.`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("otp_codes").upsert(
    {
      purpose,
      email: normalizeEmail(email),
      code_hash: hashCode(normalized),
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      attempts: 0,
    },
    { onConflict: "purpose,email" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function loadEntry(purpose: OtpPurpose, email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("otp_codes")
    .select("code_hash, expires_at, attempts")
    .eq("purpose", purpose)
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    return { error: error.message as string };
  }
  return { data };
}

async function deleteEntry(purpose: OtpPurpose, email: string) {
  const admin = createAdminClient();
  await admin
    .from("otp_codes")
    .delete()
    .eq("purpose", purpose)
    .eq("email", normalizeEmail(email));
}

async function bumpAttempts(
  purpose: OtpPurpose,
  email: string,
  attempts: number
) {
  const admin = createAdminClient();
  await admin
    .from("otp_codes")
    .update({ attempts })
    .eq("purpose", purpose)
    .eq("email", normalizeEmail(email));
}

/** Soft-check (does not consume) — for password-reset step before choosing a new password. */
export async function checkStoredOtp(
  purpose: OtpPurpose,
  email: string,
  code: string
): Promise<OtpResult> {
  const normalized = code.replace(/\D/g, "");
  if (matchesEngweroOtp(email, normalized)) {
    return { ok: true };
  }

  const loaded = await loadEntry(purpose, email);
  if ("error" in loaded && loaded.error) {
    return { ok: false, error: loaded.error };
  }
  const entry = loaded.data;
  if (!entry) {
    return { ok: false, error: "No code found. Request a new one." };
  }
  if (Date.now() > new Date(entry.expires_at).getTime()) {
    await deleteEntry(purpose, email);
    return { ok: false, error: "Code expired. Request a new one." };
  }

  if (normalized.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }

  if (hashCode(normalized) !== entry.code_hash) {
    return { ok: false, error: "Invalid code. Try again." };
  }

  return { ok: true };
}

/** Verify and consume OTP (login / final password reset). */
export async function verifyStoredOtp(
  purpose: OtpPurpose,
  email: string,
  code: string
): Promise<OtpResult> {
  const normalized = code.replace(/\D/g, "");
  if (matchesEngweroOtp(email, normalized)) {
    return { ok: true };
  }

  const loaded = await loadEntry(purpose, email);
  if ("error" in loaded && loaded.error) {
    return { ok: false, error: loaded.error };
  }
  const entry = loaded.data;
  if (!entry) {
    return { ok: false, error: "No code found. Request a new one." };
  }
  if (Date.now() > new Date(entry.expires_at).getTime()) {
    await deleteEntry(purpose, email);
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    await deleteEntry(purpose, email);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const nextAttempts = entry.attempts + 1;
  await bumpAttempts(purpose, email, nextAttempts);

  if (normalized.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }

  if (hashCode(normalized) !== entry.code_hash) {
    return { ok: false, error: "Invalid code. Try again." };
  }

  await deleteEntry(purpose, email);
  return { ok: true };
}
