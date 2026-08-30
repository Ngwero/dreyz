import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeLiveSchoolData, persistSnapshotRecords } from "@/lib/school-merge";
import {
  applyTombstones,
  DEMO_LEARNER_EMAILS,
  DEMO_LEARNER_IDS,
  mergeTombstones,
  readTombstones,
  TOMBSTONE_KEY,
} from "@/lib/school-snapshot";

export const dynamic = "force-dynamic";

/**
 * Permanently remove the built-in demo learners (DRY001–DRY008) that were
 * often deleted and then resurrected from seed / snapshot data.
 */
export async function POST() {
  try {
    const admin = createAdminClient();
    const { data: settingsRow } = await admin
      .from("school_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const existing = (settingsRow?.data ?? {}) as Record<string, unknown>;
    const tombs = mergeTombstones(readTombstones(existing), {
      learnerIds: [...DEMO_LEARNER_IDS],
      emails: [...DEMO_LEARNER_EMAILS],
      userIds: ["USR-ST-001", "USR-ST-002"],
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

    for (const id of DEMO_LEARNER_IDS) {
      await Promise.all([
        admin.from("attendance").delete().eq("learner_id", id),
        admin.from("grades").delete().eq("learner_id", id),
        admin.from("projects").delete().eq("learner_id", id),
        admin.from("learners").delete().eq("id", id),
      ]);
    }
    for (const email of DEMO_LEARNER_EMAILS) {
      await admin.from("enrollments").delete().eq("learner_email", email);
      await admin.from("learners").delete().eq("email", email);
    }

    const profileIds = new Set<string>();
    for (const email of DEMO_LEARNER_EMAILS) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("email", email);
      for (const row of data ?? []) if (row?.id) profileIds.add(String(row.id));
    }
    for (const id of DEMO_LEARNER_IDS) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("learner_id", id);
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

    return NextResponse.json({
      ok: true,
      removedIds: DEMO_LEARNER_IDS,
      removedEmails: DEMO_LEARNER_EMAILS,
      profilesRemoved: profileIds.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
