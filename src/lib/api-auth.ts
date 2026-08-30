import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export type AuthedStaff = {
  ok: true;
  userId: string;
  email: string;
  role: UserRole;
  admin: ReturnType<typeof createAdminClient>;
};

export type AuthFailure = {
  ok: false;
  response: NextResponse;
};

/** Any signed-in Supabase user (students included — for school-data hydrate). */
export async function requireSignedIn(): Promise<
  AuthedStaff | AuthFailure
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("role, email, status")
    .eq("id", user.id)
    .maybeSingle();

  const role = (me?.role as UserRole | undefined) ?? "student";
  if (me?.status === "inactive") {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Account is inactive." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    email: String(me?.email ?? user.email ?? ""),
    role,
    admin,
  };
}

const STAFF: UserRole[] = ["super_admin", "accountant", "tutor"];
const FINANCE: UserRole[] = ["super_admin", "accountant"];
const ADMIN: UserRole[] = ["super_admin"];

export async function requireRoles(
  allowed: UserRole[],
  deniedMessage = "Not allowed."
): Promise<AuthedStaff | AuthFailure> {
  const gated = await requireSignedIn();
  if (!gated.ok) return gated;
  if (!allowed.includes(gated.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: deniedMessage },
        { status: 403 }
      ),
    };
  }
  return gated;
}

export function requireStaff() {
  return requireRoles(STAFF, "Staff access required.");
}

export function requireFinance() {
  return requireRoles(FINANCE, "Accountant or Super Admin required.");
}

export function requireSuperAdmin() {
  return requireRoles(ADMIN, "Super Admin required.");
}
