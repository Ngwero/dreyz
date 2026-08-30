import { NextResponse } from "next/server";
import { mergeLiveSchoolData, persistSnapshotRecords } from "@/lib/school-merge";
import {
  applyTombstones,
  mergeTombstones,
  readTombstones,
  TOMBSTONE_KEY,
} from "@/lib/school-snapshot";
import { requireSuperAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Hard-delete a student identity across Supabase tables + auth.
 * Body: { learnerId?: string; email?: string }
 */
export async function POST(request: Request) {
  try {
    const gated = await requireSuperAdmin();
    if (!gated.ok) return gated.response;

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

    const admin = gated.admin;

    if (!learnerId && email) {
      const { data } = await admin.from("learners").select("id").eq("email", email).maybeSingle();
      learnerId = data?.id ? String(data.id) : undefined;
    }

    const { data: settingsRow } = await admin
      .from("school_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const existing = (settingsRow?.data ?? {}) as Record<string, unknown>;
    const tombs = mergeTombstones(readTombstones(existing), {
      learnerIds: learnerId ? [learnerId] : [],
      emails: email ? [email] : [],
    });
    const combined = applyTombstones({
      ...existing,
      [TOMBSTONE_KEY]: tombs,
    });

    await persistSnapshotRecords(combined);
    const merged = await mergeLiveSchoolData(combined);
    await admin.from("school_settings").upsert({
      id: "default",
      data: merged,
      updated_at: new Date().toISOString(),
    });

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
      await admin.from("learners").delete().eq("email", email);
    }

    const profileIds = new Set<string>();
    if (email) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("email", email);
      for (const row of data ?? []) if (row?.id) profileIds.add(String(row.id));
    }
    if (learnerId) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("learner_id", learnerId);
      for (const row of data ?? []) if (row?.id) profileIds.add(String(row.id));
    }

    for (const id of profileIds) {
      await admin.from("profiles").delete().eq("id", id);
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        try {
          await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
        } catch {
          /* best-effort */
        }
      }
    }

    return NextResponse.json({ ok: true, learnerId, email: email || undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
