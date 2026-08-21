import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  profileToPortalUser,
  type ProfileRow,
} from "@/lib/supabase/auth";

/** List every portal profile for Super Admin / Accountant. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (meError || !me) {
      return NextResponse.json(
        { ok: false, error: "Profile not found." },
        { status: 403 }
      );
    }

    if (me.role !== "super_admin" && me.role !== "accountant") {
      return NextResponse.json(
        { ok: false, error: "Not allowed to list accounts." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const users = ((data ?? []) as ProfileRow[]).map(profileToPortalUser);

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[accounts list]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
