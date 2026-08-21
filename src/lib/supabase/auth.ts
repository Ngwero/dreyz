import type { PortalUser, SessionUser, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { DEMO_PASSWORD } from "@/lib/auth";

export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string | null;
  status: "active" | "inactive";
  learner_id: string | null;
  instructor_id: string | null;
  fee_track_id: string | null;
  class_option_id: string | null;
  specialty: string | null;
  last_login_at: string | null;
  created_at: string;
};

export function profileToSession(p: ProfileRow): SessionUser {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    learnerId: p.learner_id ?? undefined,
    instructorId: p.instructor_id ?? undefined,
  };
}

export function profileToPortalUser(p: ProfileRow): PortalUser {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    password: DEMO_PASSWORD,
    role: p.role,
    phone: p.phone ?? undefined,
    status: p.status,
    learnerId: p.learner_id ?? undefined,
    instructorId: p.instructor_id ?? undefined,
    feeTrackId: p.fee_track_id ?? undefined,
    classOptionId: p.class_option_id ?? undefined,
    specialty: p.specialty ?? undefined,
    lastLoginAt: p.last_login_at ?? undefined,
    createdAt: p.created_at.slice(0, 10),
  };
}

export async function supabaseSignIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    return { ok: false as const, error: error?.message ?? "Invalid email or password." };
  }

  return loadSessionForUser(data.user.id);
}

export async function supabaseVerifyOtp(
  email: string,
  token: string,
  type: "email" | "recovery" = "email"
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type,
  });
  if (error || !data.user) {
    return {
      ok: false as const,
      error: error?.message ?? "Invalid or expired code.",
    };
  }
  return loadSessionForUser(data.user.id);
}

export async function supabaseUpdatePassword(password: string) {
  const supabase = createClient();
  if (password.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

async function loadSessionForUser(userId: string) {
  const supabase = createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { ok: false as const, error: "Profile not found. Contact admin." };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return { ok: false as const, error: "Account is inactive." };
  }

  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);

  return {
    ok: true as const,
    session: profileToSession(profile as ProfileRow),
  };
}

export async function supabaseSignOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    // Still clear local auth storage even if the network call fails
    await supabase.auth.signOut({ scope: "local" });
  }
}

export async function supabaseGetSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;
  return profileToSession(profile as ProfileRow);
}

export async function supabaseListProfiles(): Promise<PortalUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error || !data) return [];
  return (data as ProfileRow[]).map(profileToPortalUser);
}
