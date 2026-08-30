"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SessionUser } from "@/lib/types";
import {
  authenticate,
  changePasswordByEmail,
  clearSession,
  getSession,
  setSession,
} from "@/lib/auth";
import { requestLoginOtp, requestPasswordResetOtp } from "@/lib/auth-client";
import { recordPortalActivity } from "@/lib/activity";
import {
  supabaseGetSessionUser,
  supabaseSignIn,
  supabaseSignOut,
  supabaseUpdatePassword,
  supabaseVerifyOtp,
  supabaseVerifyOtpHash,
} from "@/lib/supabase/auth";

type LoginResult = { ok: true } | { ok: false; error: string };
type OtpSendResult = { ok: true; message: string } | { ok: false; error: string };

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  sendOtp: (email: string) => Promise<OtpSendResult>;
  loginWithOtp: (
    email: string,
    code: string,
    hashedToken?: string
  ) => Promise<LoginResult>;
  sendPasswordResetOtp: (email: string) => Promise<OtpSendResult>;
  verifyPasswordResetOtp: (email: string, code: string) => Promise<LoginResult>;
  completePasswordReset: (
    email: string,
    newPassword: string
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  usingSupabase: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const loggingOutRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loggingOutRef.current) {
      setUser(null);
      setUsingSupabase(false);
      return;
    }
    try {
      const remote = await supabaseGetSessionUser();
      if (loggingOutRef.current) {
        setUser(null);
        setUsingSupabase(false);
        return;
      }
      if (remote) {
        setSession(remote);
        setUser(remote);
        setUsingSupabase(true);
        return;
      }
    } catch {
      // Fall back to local session
    }
    if (loggingOutRef.current) {
      setUser(null);
      setUsingSupabase(false);
      return;
    }
    setUser(getSession());
    setUsingSupabase(false);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    const onStore = () => {
      void refresh();
    };
    const onAuth = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "logout") {
        setUser(null);
        setUsingSupabase(false);
        return;
      }
      void refresh();
    };
    window.addEventListener("dreyz-store", onStore);
    window.addEventListener("dreyz-auth", onAuth);
    return () => {
      window.removeEventListener("dreyz-store", onStore);
      window.removeEventListener("dreyz-auth", onAuth);
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    loggingOutRef.current = false;
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    try {
      const remote = await supabaseSignIn(cleanEmail, cleanPassword);
      if (remote.ok) {
        setSession(remote.session);
        setUser(remote.session);
        setUsingSupabase(true);
        return { ok: true };
      }
      const local = authenticate(cleanEmail, cleanPassword);
      if (local) {
        setSession(local);
        setUser(local);
        setUsingSupabase(false);
        return { ok: true };
      }
      return { ok: false, error: remote.error };
    } catch {
      const local = authenticate(cleanEmail, cleanPassword);
      if (!local) {
        return { ok: false, error: "Invalid email or password." };
      }
      setSession(local);
      setUser(local);
      setUsingSupabase(false);
      return { ok: true };
    }
  }, []);

  const sendOtp = useCallback(async (email: string): Promise<OtpSendResult> => {
    const result = await requestLoginOtp(email);
    if (!result.ok) return result;
    return { ok: true, message: result.message ?? "Code sent." };
  }, []);

  const loginWithOtp = useCallback(
    async (email: string, code: string, hashedToken?: string): Promise<LoginResult> => {
      loggingOutRef.current = false;
      try {
        const remote = hashedToken
          ? await supabaseVerifyOtpHash(hashedToken)
          : await supabaseVerifyOtp(email, code, "email");
        if (!remote.ok) {
          return { ok: false, error: remote.error };
        }
        setSession(remote.session);
        setUser(remote.session);
        setUsingSupabase(true);
        recordPortalActivity({
          title: `${remote.session.name} signed in`,
          detail: `${remote.session.email} · OTP`,
          category: "login",
          tone: "success",
          href: "/portal/accounts",
          emails: [remote.session.email],
          learnerIds: remote.session.learnerId ? [remote.session.learnerId] : [],
          actorName: remote.session.name,
          actorEmail: remote.session.email,
          actorRole: remote.session.role,
        });
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not verify code." };
      }
    },
    []
  );

  const sendPasswordResetOtp = useCallback(async (email: string): Promise<OtpSendResult> => {
    const result = await requestPasswordResetOtp(email);
    if (!result.ok) return result;
    return { ok: true, message: result.message ?? "Reset code sent." };
  }, []);

  const verifyPasswordResetOtp = useCallback(
    async (email: string, code: string): Promise<LoginResult> => {
      try {
        const remote = await supabaseVerifyOtp(email, code, "recovery");
        if (!remote.ok) {
          return { ok: false, error: remote.error };
        }
        setSession(remote.session);
        setUser(remote.session);
        setUsingSupabase(true);
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not verify reset code." };
      }
    },
    []
  );

  const completePasswordReset = useCallback(
    async (email: string, newPassword: string): Promise<LoginResult> => {
      try {
        const remote = await supabaseUpdatePassword(newPassword.trim());
        if (!remote.ok) {
          return { ok: false, error: remote.error };
        }
        changePasswordByEmail(email, newPassword.trim());
        await supabaseSignOut();
        clearSession();
        setUser(null);
        setUsingSupabase(false);
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not update password." };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    setUser(null);
    setUsingSupabase(false);
    clearSession();
    try {
      await supabaseSignOut();
    } catch {
      // ignore — local session already cleared
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      sendOtp,
      loginWithOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      completePasswordReset,
      logout,
      refresh,
      usingSupabase,
    }),
    [
      user,
      loading,
      login,
      sendOtp,
      loginWithOtp,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      completePasswordReset,
      logout,
      refresh,
      usingSupabase,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
