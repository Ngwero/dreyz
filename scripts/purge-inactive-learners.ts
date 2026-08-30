import { createAdminClient } from "../src/lib/supabase/admin";
import { mergeLiveSchoolData, persistSnapshotRecords } from "../src/lib/school-merge";
import {
  applyTombstones,
  mergeTombstones,
  readTombstones,
  TOMBSTONE_KEY,
} from "../src/lib/school-snapshot";

/** Remove learners whose portal account was already marked inactive (deleted earlier). */
async function main() {
  const admin = createAdminClient();
  const [{ data: learners }, { data: profiles }, { data: settingsRow }] = await Promise.all([
    admin.from("learners").select("id, name, email"),
    admin.from("profiles").select("id, email, name, status, learner_id").eq("role", "student"),
    admin.from("school_settings").select("data").eq("id", "default").maybeSingle(),
  ]);

  const inactive = (profiles ?? []).filter((p) => p.status === "inactive");
  const emails = [
    ...new Set(inactive.map((p) => String(p.email ?? "").trim().toLowerCase()).filter(Boolean)),
  ];
  const learnerIds = [
    ...new Set(
      (learners ?? [])
        .filter((l) => emails.includes(String(l.email ?? "").trim().toLowerCase()))
        .map((l) => String(l.id))
    ),
  ];
  // Also include learner_ids left on inactive profiles
  for (const p of inactive) {
    if (p.learner_id) learnerIds.push(String(p.learner_id));
  }
  const uniqueLearnerIds = [...new Set(learnerIds)];

  if (!emails.length && !uniqueLearnerIds.length) {
    console.log(JSON.stringify({ ok: true, message: "Nothing to purge." }));
    return;
  }

  const existing = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const tombs = mergeTombstones(readTombstones(existing), {
    learnerIds: uniqueLearnerIds,
    emails,
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

  for (const id of uniqueLearnerIds) {
    await Promise.all([
      admin.from("attendance").delete().eq("learner_id", id),
      admin.from("grades").delete().eq("learner_id", id),
      admin.from("projects").delete().eq("learner_id", id),
      admin.from("learners").delete().eq("id", id),
    ]);
  }
  for (const email of emails) {
    await admin.from("enrollments").delete().eq("learner_email", email);
    await admin.from("learners").delete().eq("email", email);
  }

  const profileIds = inactive.map((p) => String(p.id));
  for (const id of profileIds) {
    await admin.from("profiles").delete().eq("id", id);
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      /* best-effort */
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        removedEmails: emails,
        removedLearnerIds: uniqueLearnerIds,
        removedNames: inactive.map((p) => p.name),
        profilesDeleted: profileIds.length,
        snapshotLearnersAfter: Array.isArray(merged.dreyz_learners)
          ? merged.dreyz_learners.length
          : 0,
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
