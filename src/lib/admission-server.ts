import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAdmissionNumber,
  parseAdmissionNumber,
} from "@/lib/admission-number";

/** Next DRY### from Supabase learners + profiles (server-side). */
export async function allocateAdmissionNumberServer(
  admin: SupabaseClient,
  preferred?: string | null
): Promise<string> {
  const preferredTrim = preferred?.trim();
  if (preferredTrim) {
    const { data: byId } = await admin
      .from("learners")
      .select("id")
      .eq("id", preferredTrim)
      .maybeSingle();
    if (byId?.id) return byId.id;
  }

  const [{ data: learners }, { data: profiles }] = await Promise.all([
    admin.from("learners").select("id"),
    admin.from("profiles").select("learner_id").not("learner_id", "is", null),
  ]);

  let max = 0;
  for (const row of learners ?? []) {
    max = Math.max(max, parseAdmissionNumber(row.id));
  }
  for (const row of profiles ?? []) {
    max = Math.max(max, parseAdmissionNumber(row.learner_id as string));
  }
  return formatAdmissionNumber(max + 1);
}

/** Reuse learner id for an existing email, else allocate. */
export async function resolveAdmissionIdServer(
  admin: SupabaseClient,
  email: string,
  preferred?: string | null
): Promise<string> {
  const e = email.trim().toLowerCase();
  const { data: learner } = await admin
    .from("learners")
    .select("id")
    .eq("email", e)
    .maybeSingle();
  if (learner?.id) return learner.id;

  const { data: profile } = await admin
    .from("profiles")
    .select("learner_id")
    .eq("email", e)
    .maybeSingle();
  if (profile?.learner_id) return String(profile.learner_id);

  return allocateAdmissionNumberServer(admin, preferred);
}
