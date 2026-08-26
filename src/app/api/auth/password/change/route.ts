import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBrowserStyleClient } from "@supabase/supabase-js";

/**
 * Change the signed-in user's live password.
 * Accepts a Bearer access token (preferred) or the cookie session.
 * Uses the admin API so the update always hits auth.users.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body.password ?? "").trim();
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    let userId: string | null = null;

    if (bearer) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) {
        return NextResponse.json(
          { ok: false, error: "Auth is not configured." },
          { status: 500 }
        );
      }
      const client = createBrowserStyleClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser(bearer);
      if (error || !data.user) {
        return NextResponse.json(
          { ok: false, error: "Your session expired. Sign in again, then change your password." },
          { status: 401 }
        );
      }
      userId = data.user.id;
    } else {
      const server = await createServerClient();
      const { data, error } = await server.auth.getUser();
      if (error || !data.user) {
        return NextResponse.json(
          { ok: false, error: "Your session expired. Sign in again, then change your password." },
          { status: 401 }
        );
      }
      userId = data.user.id;
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { ok: false, error: "Account not found." },
        { status: 404 }
      );
    }
    if (profile.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "This account is inactive. Contact admin." },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[password change]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
