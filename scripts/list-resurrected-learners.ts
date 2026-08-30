import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const [{ data: learners }, { data: profiles }, { data: settings }] = await Promise.all([
    admin.from("learners").select("id, name, email, status").order("name"),
    admin.from("profiles").select("id, email, name, status, learner_id, role").eq("role", "student"),
    admin.from("school_settings").select("data").eq("id", "default").maybeSingle(),
  ]);

  const snapshot = (settings?.data ?? {}) as Record<string, unknown>;
  const tombs = (snapshot.dreyz_tombstones ?? {}) as {
    learnerIds?: string[];
    emails?: string[];
  };
  const snapLearners = (snapshot.dreyz_learners as { id: string; name: string; email: string }[]) ?? [];

  const inactive = (profiles ?? []).filter((p) => p.status === "inactive");
  const inactiveEmails = new Set(inactive.map((p) => String(p.email).toLowerCase()));
  const stillOnRoster = (learners ?? []).filter((l) =>
    inactiveEmails.has(String(l.email).toLowerCase())
  );
  const stillInSnapshot = snapLearners.filter((l) =>
    inactiveEmails.has(String(l.email).toLowerCase())
  );

  console.log(
    JSON.stringify(
      {
        learnersInTable: learners?.length ?? 0,
        learnersInSnapshot: snapLearners.length,
        studentProfiles: profiles?.length ?? 0,
        inactiveStudentProfiles: inactive.map((p) => ({
          email: p.email,
          name: p.name,
          learner_id: p.learner_id,
        })),
        inactiveStillInLearnersTable: stillOnRoster,
        inactiveStillInSnapshot: stillInSnapshot,
        existingTombstones: tombs,
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
