import { createClient } from "@/lib/supabase/client";
import type { Learner, PaymentRecord, CredentialEmail } from "@/lib/types";

type PaymentRow = {
  id: string;
  learner_name: string;
  learner_email: string;
  phone: string | null;
  fee_track_id: string | null;
  class_option_id: string | null;
  amount: number | string;
  method: PaymentRecord["method"];
  reference: string | null;
  date: string | null;
  status: PaymentRecord["status"];
  credentials_sent: boolean | null;
  student_user_id: string | null;
  rukapay_txn_id: string | null;
  rukapay_provider: string | null;
};

type LearnerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  course: string | null;
  enrollment_date: string | null;
  progress: number | null;
  status: Learner["status"];
  avatar: string | null;
  paid_amount?: number | string | null;
  fee_due?: number | string | null;
};

export async function fetchPayments(): Promise<PaymentRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as PaymentRow[]).map((row) => ({
    id: row.id,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    phone: row.phone ?? "",
    feeTrackId: row.fee_track_id ?? "",
    classOptionId: row.class_option_id ?? "",
    amount: Number(row.amount),
    method: row.method,
    reference: row.reference ?? "",
    date: row.date ?? "",
    status: row.status,
    credentialsSent: !!row.credentials_sent,
    studentUserId: row.student_user_id ?? undefined,
    rukaPayTxnId: row.rukapay_txn_id ?? undefined,
    rukaPayProvider: row.rukapay_provider ?? undefined,
  }));
}

export async function upsertPayment(payment: PaymentRecord) {
  const supabase = createClient();
  const { error } = await supabase.from("payments").upsert({
    id: payment.id,
    learner_name: payment.learnerName,
    learner_email: payment.learnerEmail,
    phone: payment.phone,
    fee_track_id: payment.feeTrackId,
    class_option_id: payment.classOptionId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    date: payment.date,
    status: payment.status,
    credentials_sent: payment.credentialsSent,
    student_user_id: payment.studentUserId ?? null,
    rukapay_txn_id: payment.rukaPayTxnId ?? null,
    rukapay_provider: payment.rukaPayProvider ?? null,
  });
  return !error;
}

export async function fetchLearners(): Promise<Learner[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("learners").select("*").order("name");
  if (error || !data) return [];
  return (data as LearnerRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    course: row.course ?? "",
    enrollmentDate: row.enrollment_date ?? "",
    progress: row.progress ?? 0,
    status: row.status,
    paidAmount: row.paid_amount != null ? Number(row.paid_amount) : undefined,
    feeDue: row.fee_due != null ? Number(row.fee_due) : undefined,
  }));
}

export async function upsertLearner(learner: Learner) {
  const supabase = createClient();
  const { error } = await supabase.from("learners").upsert({
    id: learner.id,
    name: learner.name,
    email: learner.email,
    phone: learner.phone,
    course: learner.course,
    enrollment_date: learner.enrollmentDate,
    progress: learner.progress,
    status: learner.status,
    avatar: learner.avatar ?? null,
    paid_amount: learner.paidAmount ?? 0,
    fee_due: learner.feeDue ?? 0,
  });
  return !error;
}

export async function insertEmailOutbox(email: CredentialEmail) {
  const supabase = createClient();
  await supabase.from("email_outbox").upsert({
    id: email.id,
    to: email.to,
    subject: email.subject,
    body: email.body,
    sent_at: email.sentAt,
    payment_id: email.paymentId ?? null,
    user_id: email.userId ?? null,
  });
}

export async function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
