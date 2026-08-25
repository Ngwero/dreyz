import { createAdminClient } from "@/lib/supabase/admin";
import { feeTracks } from "@/lib/data";
import type { Learner, PaymentRecord } from "@/lib/types";

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function feeDueFor(course?: string, feeTrackId?: string, existing?: number) {
  if (existing && existing > 0) return existing;
  if (feeTrackId) {
    const track = feeTracks.find((t) => t.id === feeTrackId);
    if (track?.total) return track.total;
  }
  if ((course ?? "").toLowerCase().includes("6-month")) return 4_400_000;
  return 3_350_000;
}

function paymentMethod(value: unknown): PaymentRecord["method"] {
  if (value === "mobile_money" || value === "bank" || value === "cash" || value === "card") {
    return value;
  }
  return "cash";
}

function paymentStatus(value: unknown): PaymentRecord["status"] {
  if (value === "confirmed" || value === "pending" || value === "failed") return value;
  return "pending";
}

function mapDbPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id),
    learnerName: String(row.learner_name ?? row.learnerName ?? ""),
    learnerEmail: String(row.learner_email ?? row.learnerEmail ?? "").toLowerCase(),
    phone: String(row.phone ?? ""),
    feeTrackId: String(row.fee_track_id ?? row.feeTrackId ?? "4-month"),
    classOptionId: String(row.class_option_id ?? row.classOptionId ?? "weekday"),
    amount: asNumber(row.amount),
    method: paymentMethod(row.method),
    reference: String(row.reference ?? ""),
    date: String(row.date ?? ""),
    status: paymentStatus(row.status),
    credentialsSent: Boolean(row.credentials_sent ?? row.credentialsSent),
    studentUserId: row.student_user_id ? String(row.student_user_id) : undefined,
    rukaPayTxnId: row.rukapay_txn_id ? String(row.rukapay_txn_id) : undefined,
    rukaPayProvider: row.rukapay_provider ? String(row.rukapay_provider) : undefined,
  };
}

function mapSnapshotPayment(row: Record<string, unknown>): PaymentRecord | null {
  if (!row?.id) return null;
  const email = String(row.learnerEmail ?? row.learner_email ?? "").toLowerCase();
  if (!email) return null;
  return {
    id: String(row.id),
    learnerName: String(row.learnerName ?? ""),
    learnerEmail: email,
    phone: String(row.phone ?? ""),
    feeTrackId: String(row.feeTrackId ?? "4-month"),
    classOptionId: String(row.classOptionId ?? "weekday"),
    amount: asNumber(row.amount),
    method: paymentMethod(row.method),
    reference: String(row.reference ?? ""),
    date: String(row.date ?? ""),
    status: paymentStatus(row.status),
    credentialsSent: Boolean(row.credentialsSent),
    studentUserId: row.studentUserId ? String(row.studentUserId) : undefined,
  };
}

function mapLearner(
  row: Record<string, unknown>,
  paid: number,
  feeDue: number
): Learner {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? "").toLowerCase(),
    phone: String(row.phone ?? ""),
    course: String(row.course ?? "Professional Interior Design Programme"),
    enrollmentDate: String(row.enrollmentDate ?? row.enrollment_date ?? ""),
    progress: asNumber(row.progress),
    status: (row.status as Learner["status"]) || "active",
    avatar: row.avatar ? String(row.avatar) : undefined,
    paidAmount: paid,
    feeDue,
  };
}

export async function mergeLiveSchoolData(snapshot: Record<string, unknown>) {
  const admin = createAdminClient();
  const [{ data: dbLearners }, { data: dbPayments }, { data: profiles }] = await Promise.all([
    admin.from("learners").select("*"),
    admin.from("payments").select("*"),
    admin.from("profiles").select("email, name, phone, learner_id, fee_track_id, class_option_id, role"),
  ]);

  const paymentsById = new Map<string, PaymentRecord>();
  for (const row of (snapshot.dreyz_payments as Record<string, unknown>[] | undefined) ?? []) {
    const mapped = mapSnapshotPayment(row);
    if (mapped) paymentsById.set(mapped.id, mapped);
  }
  for (const row of (dbPayments ?? []) as Record<string, unknown>[]) {
    const mapped = mapDbPayment(row);
    paymentsById.set(mapped.id, mapped);
  }
  const payments = [...paymentsById.values()];

  const paidByEmail = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== "confirmed") continue;
    const email = payment.learnerEmail.toLowerCase();
    paidByEmail.set(email, (paidByEmail.get(email) ?? 0) + payment.amount);
  }

  const trackByEmail = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (profile.role !== "student") continue;
    if (profile.email && profile.fee_track_id) {
      trackByEmail.set(String(profile.email).toLowerCase(), String(profile.fee_track_id));
    }
  }

  const learnersByEmail = new Map<string, Learner>();
  const take = (row: Record<string, unknown>) => {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email || !row.id) return;
    const paid = paidByEmail.get(email) ?? asNumber(row.paidAmount ?? row.paid_amount);
    const due = feeDueFor(
      String(row.course ?? ""),
      trackByEmail.get(email),
      asNumber(row.feeDue ?? row.fee_due)
    );
    const next = mapLearner(row, paid, due);
    const prev = learnersByEmail.get(email);
    if (!prev) {
      learnersByEmail.set(email, next);
      return;
    }
    const newer = (next.enrollmentDate || "") >= (prev.enrollmentDate || "");
    const chosen = newer ? { ...prev, ...next } : { ...next, ...prev };
    learnersByEmail.set(email, { ...chosen, paidAmount: paid, feeDue: due });
  };

  for (const row of (snapshot.dreyz_learners as Record<string, unknown>[] | undefined) ?? []) {
    take(row);
  }
  for (const row of (dbLearners ?? []) as Record<string, unknown>[]) {
    take(row);
  }

  const learners = [...learnersByEmail.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const learner of learners) {
    await admin
      .from("learners")
      .update({
        paid_amount: learner.paidAmount ?? 0,
        fee_due: learner.feeDue ?? 0,
      })
      .eq("id", learner.id);
  }

  return {
    ...snapshot,
    dreyz_learners: learners,
    dreyz_payments: payments,
  };
}

export async function persistSnapshotRecords(snapshot: Record<string, unknown>) {
  const admin = createAdminClient();
  const learners = (snapshot.dreyz_learners as Record<string, unknown>[] | undefined) ?? [];
  const payments = (snapshot.dreyz_payments as Record<string, unknown>[] | undefined) ?? [];

  for (const row of learners) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!row.id || !email) continue;
    await admin.from("learners").upsert(
      {
        id: String(row.id),
        name: String(row.name ?? email),
        email,
        phone: String(row.phone ?? "") || null,
        course: String(row.course ?? "") || null,
        enrollment_date: String(row.enrollmentDate ?? row.enrollment_date ?? "") || null,
        progress: asNumber(row.progress),
        status: String(row.status ?? "active"),
        paid_amount: asNumber(row.paidAmount ?? row.paid_amount),
        fee_due: asNumber(row.feeDue ?? row.fee_due) || feeDueFor(String(row.course ?? "")),
      },
      { onConflict: "id" }
    );
  }

  for (const row of payments) {
    const mapped = mapSnapshotPayment(row);
    if (!mapped) continue;
    await admin.from("payments").upsert(
      {
        id: mapped.id,
        learner_name: mapped.learnerName,
        learner_email: mapped.learnerEmail,
        phone: mapped.phone || null,
        fee_track_id: mapped.feeTrackId,
        class_option_id: mapped.classOptionId,
        amount: mapped.amount,
        method: mapped.method,
        reference: mapped.reference,
        date: mapped.date,
        status: mapped.status,
        credentials_sent: mapped.credentialsSent,
        student_user_id: mapped.studentUserId ?? null,
      },
      { onConflict: "id" }
    );
  }
}
