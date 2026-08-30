import { createAdminClient } from "../src/lib/supabase/admin";
import { mergeLiveSchoolData, persistSnapshotRecords } from "../src/lib/school-merge";
import {
  applyTombstones,
  DEMO_LEARNER_EMAILS,
  DEMO_LEARNER_IDS,
  mergeTombstones,
  readTombstones,
  TOMBSTONE_KEY,
} from "../src/lib/school-snapshot";

async function main() {
  const admin = createAdminClient();
  const { data: settingsRow, error } = await admin
    .from("school_settings")
    .select("data")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;

  const existing = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const before = Array.isArray(existing.dreyz_learners) ? existing.dreyz_learners.length : 0;
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
  const { error: upErr } = await admin.from("school_settings").upsert({
    id: "default",
    data: merged,
    updated_at: new Date().toISOString(),
  });
  if (upErr) throw upErr;

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
      /* best-effort */
    }
  }

  const after = Array.isArray(merged.dreyz_learners) ? merged.dreyz_learners.length : 0;
  const { count } = await admin.from("learners").select("*", { count: "exact", head: true });
  console.log(
    JSON.stringify(
      {
        ok: true,
        snapshotLearnersBefore: before,
        snapshotLearnersAfter: after,
        learnersTableCount: count,
        profilesRemoved: profileIds.size,
        tombstoned: DEMO_LEARNER_IDS,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
