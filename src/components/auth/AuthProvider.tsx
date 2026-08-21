"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser } from "@/lib/types";
import {
  authenticate,
  clearSession,
  getSession,
  setSession,
} from "@/lib/auth";
import {
  supabaseGetSessionUser,
  supabaseSignIn,
  supabaseSignOut,
  supabaseVerifyOtp,
} from "@/lib/supabase/auth";

type LoginResult = { ok: true } | { ok: false; error: string };
type OtpSendResult = { ok: true; message: string } | { ok: false; error: string };

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  sendOtp: (email: string) => Promise<OtpSendResult>;
  loginWithOtp: (email: string, code: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  usingSupabase: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const remote = await supabaseGetSessionUser();
      if (remote) {
        setSession(remote);
        setUser(remote);
        setUsingSupabase(true);
        return;
      }
    } catch {
      // Fall back to local session
    }
    setUser(getSession());
    setUsingSupabase(false);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    const onStore = () => {
      void refresh();
    };
    window.addEventListener("dreyz-store", onStore);
    return () => window.removeEventListener("dreyz-store", onStore);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const remote = await supabaseSignIn(email, password);
      if (remote.ok) {
        setSession(remote.session);
        setUser(remote.session);
        setUsingSupabase(true);
        return { ok: true };
      }
      const local = authenticate(email, password);
      if (local) {
        setSession(local);
        setUser(local);
        setUsingSupabase(false);
        return { ok: true };
      }
      return { ok: false, error: remote.error };
    } catch {
      const local = authenticate(email, password);
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
  }, []);

  const loginWithOtp = useCallback(async (email: string, code: string): Promise<LoginResult> => {
    try {
      const remote = await supabaseVerifyOtp(email, code);
      if (!remote.ok) {
        return { ok: false, error: remote.error };
      }
      setSession(remote.session);
      setUser(remote.session);
      setUsingSupabase(true);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not verify code." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabaseSignOut();
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
    setUsingSupabase(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      sendOtp,
      loginWithOtp,
      logout,
      refresh,
      usingSupabase,
    }),
    [user, loading, login, sendOtp, loginWithOtp, logout, refresh, usingSupabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
