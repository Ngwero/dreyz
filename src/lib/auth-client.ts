/** Client-side auth API helpers (usable outside AuthProvider). */

export type AuthOk = { ok: true; message?: string };
export type AuthErr = { ok: false; error: string };
export type AuthResult = AuthOk | AuthErr;

export async function requestLoginOtp(email: string): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Could not send code." };
    }
    return { ok: true, message: data.message ?? "Code sent." };
  } catch {
    return { ok: false, error: "Network error while sending code." };
  }
}

export async function verifyLoginOtp(
  email: string,
  code: string
): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Invalid code." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error while verifying code." };
  }
}

export async function requestPasswordResetOtp(email: string): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Could not send reset code." };
    }
    return { ok: true, message: data.message ?? "Reset code sent." };
  } catch {
    return { ok: false, error: "Network error while sending reset code." };
  }
}

export async function checkPasswordResetOtp(
  email: string,
  code: string
): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/password/check-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Invalid code." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error while verifying code." };
  }
}

export async function resetPasswordWithOtp(opts: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const res = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Could not reset password." };
    }
    return { ok: true, message: data.message ?? "Password updated." };
  } catch {
    return { ok: false, error: "Network error while resetting password." };
  }
}
