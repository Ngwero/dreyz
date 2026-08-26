import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Hard-delete a student identity across Supabase tables + deactivate auth.
 * Body: { learnerId?: string; email?: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      learnerId?: string;
      email?: string;
    };
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    let learnerId = String(body.learnerId ?? "").trim() || undefined;

    if (!email && !learnerId) {
      return NextResponse.json(
        { ok: false, error: "Provide learnerId or email." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    if (!learnerId && email) {
      const { data } = await admin
        .from("learners")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      learnerId = data?.id ? String(data.id) : undefined;
    }

    if (learnerId) {
      await Promise.all([
        admin.from("attendance").delete().eq("learner_id", learnerId),
        admin.from("grades").delete().eq("learner_id", learnerId),
        admin.from("projects").delete().eq("learner_id", learnerId),
        admin.from("learners").delete().eq("id", learnerId),
      ]);
    }

    if (email) {
      await admin.from("enrollments").delete().eq("learner_email", email);
      // Keep payment history for audit — mark profiles inactive and ban auth login
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, learner_id")
        .eq("email", email)
        .eq("role", "student");

      for (const profile of profiles ?? []) {
        await admin
          .from("profiles")
          .update({ status: "inactive", learner_id: null })
          .eq("id", profile.id);
        try {
          await admin.auth.admin.updateUserById(profile.id, {
            ban_duration: "876000h",
          });
        } catch {
          /* best-effort */
        }
      }
    } else if (learnerId) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id")
        .eq("learner_id", learnerId)
        .eq("role", "student");
      for (const profile of profiles ?? []) {
        await admin
          .from("profiles")
          .update({ status: "inactive", learner_id: null })
          .eq("id", profile.id);
      }
    }

    return NextResponse.json({ ok: true, learnerId, email: email || undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
