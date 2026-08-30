import { createAdminClient } from "@/lib/supabase/admin";
import { feeTracks } from "@/lib/data";
import { normalizeCourse } from "@/lib/course-structure";
import {
  applyTombstones,
  combineSchoolSnapshots,
  isTombstoned,
  readTombstones,
} from "@/lib/school-snapshot";
import type {
  Assessment,
  AttendanceRecord,
  Course,
  Enrollment,
  Grade,
  Instructor,
  Learner,
  Module,
  Notice,
  PaymentRecord,
  Project,
  Resource,
  ScheduleItem,
} from "@/lib/types";

export { combineSchoolSnapshots } from "@/lib/school-snapshot";

type Admin = ReturnType<typeof createAdminClient>;

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
  const c = (course ?? "").toLowerCase();
  if (c.includes("previous") && c.includes("6")) return 3_920_000;
  if (c.includes("previous") && c.includes("4")) return 3_050_000;
  if (c.includes("6-month") || c.includes("internship")) return 4_400_000;
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

async function upsertBatch(
  admin: Admin,
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 100
) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from(table).upsert(chunk, { onConflict: "id" });
    if (error) {
      console.warn(`[school-merge] upsert ${table}:`, error.message);
    }
  }
}

function mergeById<T extends { id: string }>(
  snapshotRows: T[],
  dbRows: T[],
  preferDb = true
): T[] {
  const map = new Map<string, T>();
  const first = preferDb ? snapshotRows : dbRows;
  const second = preferDb ? dbRows : snapshotRows;
  for (const row of first) if (row?.id) map.set(row.id, row);
  for (const row of second) if (row?.id) map.set(row.id, { ...map.get(row.id), ...row } as T);
  return [...map.values()];
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

function mapLearner(row: Record<string, unknown>, paid: number, feeDue: number): Learner {
  const feeTrackId = String(row.feeTrackId ?? row.fee_track_id ?? "").trim() || undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? "").toLowerCase(),
    phone: String(row.phone ?? ""),
    course: String(row.course ?? "Professional Interior Design Programme"),
    enrollmentDate: String(row.enrollmentDate ?? row.enrollment_date ?? ""),
    intake: String(row.intake ?? "").trim() || undefined,
    progress: asNumber(row.progress),
    status: (row.status as Learner["status"]) || "active",
    avatar: row.avatar ? String(row.avatar) : undefined,
    feeTrackId,
    paidAmount: paid,
    feeDue,
  };
}

function mapAttendance(row: Record<string, unknown>): AttendanceRecord | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    learnerId: String(row.learnerId ?? row.learner_id ?? ""),
    learnerName: String(row.learnerName ?? row.learner_name ?? ""),
    course: String(row.course ?? ""),
    date: String(row.date ?? ""),
    status: (row.status as AttendanceRecord["status"]) || "present",
    recordedAt: row.recordedAt
      ? String(row.recordedAt)
      : row.recorded_at
        ? String(row.recorded_at)
        : undefined,
  };
}

function mapAssessment(row: Record<string, unknown>): Assessment | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    course: String(row.course ?? ""),
    type: (row.type as Assessment["type"]) || "test",
    date: String(row.date ?? ""),
    maxScore: asNumber(row.maxScore ?? row.max_score, 100),
    submissions: asNumber(row.submissions),
  };
}

function mapGrade(row: Record<string, unknown>): Grade | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    assessmentId: String(row.assessmentId ?? row.assessment_id ?? ""),
    learnerId: String(row.learnerId ?? row.learner_id ?? ""),
    learnerName: String(row.learnerName ?? row.learner_name ?? ""),
    title: String(row.title ?? ""),
    course: String(row.course ?? ""),
    type: (row.type as Grade["type"]) || "test",
    score: asNumber(row.score),
    maxScore: asNumber(row.maxScore ?? row.max_score, 100),
    date: String(row.date ?? ""),
  };
}

function mapProject(row: Record<string, unknown>): Project | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    learnerId: String(row.learnerId ?? row.learner_id ?? ""),
    learnerName: String(row.learnerName ?? row.learner_name ?? ""),
    title: String(row.title),
    course: String(row.course ?? ""),
    score: asNumber(row.score),
    status: (row.status as Project["status"]) || "submitted",
    thumbnail: row.thumbnail ? String(row.thumbnail) : undefined,
  };
}

function mapEnrollment(row: Record<string, unknown>): Enrollment | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    learnerName: String(row.learnerName ?? row.learner_name ?? ""),
    learnerEmail: String(row.learnerEmail ?? row.learner_email ?? "").toLowerCase() || undefined,
    course: String(row.course ?? ""),
    date: String(row.date ?? ""),
    amount: asNumber(row.amount),
    status: (row.status as Enrollment["status"]) || "paid",
  };
}

function mapInstructor(row: Record<string, unknown>): Instructor | null {
  if (!row?.id || !row.name) return null;
  const assigned = row.assignedCourseIds ?? row.assigned_course_ids;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email ?? ""),
    phone: row.phone ? String(row.phone) : undefined,
    specialty: String(row.specialty ?? ""),
    courses: asNumber(row.courses),
    rating: asNumber(row.rating),
    status: (row.status as Instructor["status"]) || "active",
    assignedCourseIds: Array.isArray(assigned) ? assigned.map(String) : undefined,
  };
}

function mapModule(row: Record<string, unknown>): Module | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    courseId: String(row.courseId ?? row.course_id ?? ""),
    title: String(row.title),
    lessons: asNumber(row.lessons),
    duration: String(row.duration ?? ""),
    order: asNumber(row.order),
    classCount: asNumber(row.classCount ?? row.class_count),
    quizzes: asNumber(row.quizzes),
    projects: asNumber(row.projects),
  };
}

function mapSchedule(row: Record<string, unknown>): ScheduleItem | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    course: String(row.course ?? ""),
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    type: (row.type as ScheduleItem["type"]) || "live",
    instructor: String(row.instructor ?? ""),
  };
}

function mapResource(row: Record<string, unknown>): Resource | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category ?? ""),
    type: (row.type as Resource["type"]) || "PDF",
    files: asNumber(row.files),
    downloads: asNumber(row.downloads),
    fileUrl: row.fileUrl ? String(row.fileUrl) : row.file_url ? String(row.file_url) : undefined,
    paid: Boolean(row.paid),
    price: asNumber(row.price),
  };
}

function mapNotice(row: Record<string, unknown>): Notice | null {
  if (!row?.id || !row.title) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content ?? ""),
    date: String(row.date ?? ""),
    priority: (row.priority as Notice["priority"]) || "medium",
    category: String(row.category ?? "General"),
  };
}

function snapshotList(snapshot: Record<string, unknown>, key: string) {
  return (snapshot[key] as Record<string, unknown>[] | undefined) ?? [];
}

export async function mergeLiveSchoolData(snapshot: Record<string, unknown>) {
  const admin = createAdminClient();
  const [
    { data: dbLearners },
    { data: dbPayments },
    { data: profiles },
    { data: dbNotices },
    { data: dbCourses },
    { data: dbAttendance },
    { data: dbAssessments },
    { data: dbGrades },
    { data: dbProjects },
    { data: dbEnrollments },
    { data: dbInstructors },
    { data: dbModules },
    { data: dbSchedule },
    { data: dbResources },
  ] = await Promise.all([
    admin.from("learners").select("*"),
    admin.from("payments").select("*"),
    admin.from("profiles").select("email, name, phone, learner_id, fee_track_id, class_option_id, role"),
    admin.from("notices").select("*"),
    admin.from("courses").select("*"),
    admin.from("attendance").select("*"),
    admin.from("assessments").select("*"),
    admin.from("grades").select("*"),
    admin.from("projects").select("*"),
    admin.from("enrollments").select("*"),
    admin.from("instructors").select("*"),
    admin.from("modules").select("*"),
    admin.from("schedule_items").select("*"),
    admin.from("resources").select("*"),
  ]);

  const paymentsById = new Map<string, PaymentRecord>();
  for (const row of snapshotList(snapshot, "dreyz_payments")) {
    const mapped = mapSnapshotPayment(row);
    if (mapped) paymentsById.set(mapped.id, mapped);
  }
  for (const row of (dbPayments ?? []) as Record<string, unknown>[]) {
    paymentsById.set(String(row.id), mapDbPayment(row));
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

  const tombs = readTombstones(snapshot);

  const learnersByEmail = new Map<string, Learner>();
  const take = (row: Record<string, unknown>) => {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email || !row.id) return;
    if (isTombstoned(tombs, { id: String(row.id), email })) return;
    const paid = paidByEmail.get(email) ?? asNumber(row.paidAmount ?? row.paid_amount);
    const due = feeDueFor(
      String(row.course ?? ""),
      String(row.feeTrackId ?? row.fee_track_id ?? "").trim() || trackByEmail.get(email),
      asNumber(row.feeDue ?? row.fee_due)
    );
    const next = mapLearner(row, paid, due);
    const prev = learnersByEmail.get(email);
    if (!prev) {
      learnersByEmail.set(email, {
        ...next,
        feeTrackId:
          next.feeTrackId || trackByEmail.get(email) || undefined,
      });
      return;
    }
    const newer = (next.enrollmentDate || "") >= (prev.enrollmentDate || "");
    const chosen = newer ? { ...prev, ...next } : { ...next, ...prev };
    learnersByEmail.set(email, {
      ...chosen,
      intake: chosen.intake || prev.intake || next.intake,
      feeTrackId:
        chosen.feeTrackId ||
        prev.feeTrackId ||
        next.feeTrackId ||
        trackByEmail.get(email),
      paidAmount: paid,
      feeDue: due,
    });
  };

  for (const row of snapshotList(snapshot, "dreyz_learners")) take(row);
  for (const row of (dbLearners ?? []) as Record<string, unknown>[]) take(row);

  const learners = [...learnersByEmail.values()].sort((a, b) => a.name.localeCompare(b.name));

  const coursesById = new Map<string, Course>();
  const takeCourse = (row: Record<string, unknown>) => {
    if (!row?.id) return;
    const id = String(row.id);
    const mapped = normalizeCourse({
      id,
      title: String(row.title ?? ""),
      category: String(row.category ?? "Foundations"),
      level: (row.level as Course["level"]) || "Beginner",
      duration: String(row.duration ?? ""),
      durationWeeks: asNumber(row.durationWeeks ?? row.duration_weeks),
      classCount: asNumber(row.classCount ?? row.class_count),
      testCount: asNumber(row.testCount ?? row.test_count),
      examCount: asNumber(row.examCount ?? row.exam_count),
      hasFinalExam: Boolean(row.hasFinalExam ?? row.has_final_exam),
      enrolled: asNumber(row.enrolled),
      capacity: asNumber(row.capacity, 100),
      instructor: String(row.instructor ?? "Staff"),
      status: (row.status as Course["status"]) || "draft",
      price: asNumber(row.price),
    });
    const prev = coursesById.get(id);
    coursesById.set(id, prev ? { ...prev, ...mapped } : mapped);
  };
  for (const row of (dbCourses ?? []) as Record<string, unknown>[]) takeCourse(row);
  for (const row of snapshotList(snapshot, "dreyz_courses")) takeCourse(row);

  const mapSnap = <T extends { id: string }>(
    key: string,
    dbRows: Record<string, unknown>[] | null | undefined,
    mapFn: (row: Record<string, unknown>) => T | null
  ) => {
    const fromSnap = snapshotList(snapshot, key)
      .map(mapFn)
      .filter((x): x is T => !!x);
    const fromDb = ((dbRows ?? []) as Record<string, unknown>[])
      .map(mapFn)
      .filter((x): x is T => !!x);
    return mergeById(fromSnap, fromDb, true);
  };

  return applyTombstones({
    ...snapshot,
    dreyz_learners: learners,
    dreyz_payments: payments,
    dreyz_courses: [...coursesById.values()].sort((a, b) => a.title.localeCompare(b.title)),
    dreyz_notices: mapSnap("dreyz_notices", dbNotices as Record<string, unknown>[], mapNotice).sort(
      (a, b) => (b.date || "").localeCompare(a.date || "")
    ),
    dreyz_attendance: mapSnap(
      "dreyz_attendance",
      dbAttendance as Record<string, unknown>[],
      mapAttendance
    ),
    dreyz_assessments: mapSnap(
      "dreyz_assessments",
      dbAssessments as Record<string, unknown>[],
      mapAssessment
    ),
    dreyz_grades: mapSnap("dreyz_grades", dbGrades as Record<string, unknown>[], mapGrade),
    dreyz_projects: mapSnap("dreyz_projects", dbProjects as Record<string, unknown>[], mapProject),
    dreyz_enrollments: mapSnap(
      "dreyz_enrollments",
      dbEnrollments as Record<string, unknown>[],
      mapEnrollment
    ),
    dreyz_instructors: mapSnap(
      "dreyz_instructors",
      dbInstructors as Record<string, unknown>[],
      mapInstructor
    ),
    dreyz_modules: mapSnap("dreyz_modules", dbModules as Record<string, unknown>[], mapModule),
    dreyz_schedule: mapSnap(
      "dreyz_schedule",
      dbSchedule as Record<string, unknown>[],
      mapSchedule
    ),
    dreyz_resources: mapSnap(
      "dreyz_resources",
      dbResources as Record<string, unknown>[],
      mapResource
    ),
  });
}

async function persistTombstoneDeletes(admin: Admin, snapshot: Record<string, unknown>) {
  const tombs = readTombstones(snapshot);
  for (const id of tombs.learnerIds) {
    await Promise.all([
      admin.from("attendance").delete().eq("learner_id", id),
      admin.from("grades").delete().eq("learner_id", id),
      admin.from("projects").delete().eq("learner_id", id),
      admin.from("learners").delete().eq("id", id),
    ]);
  }
  for (const email of tombs.emails) {
    await admin.from("enrollments").delete().eq("learner_email", email);
    await admin.from("learners").delete().eq("email", email);
  }
}

/** Persist every portal list into relational Supabase tables. */
export async function persistSnapshotRecords(snapshot: Record<string, unknown>) {
  const admin = createAdminClient();
  await persistTombstoneDeletes(admin, snapshot);

  const learners = snapshotList(snapshot, "dreyz_learners")
    .filter((row) => row.id && String(row.email ?? "").trim())
    .map((row) => {
      const email = String(row.email ?? "").trim().toLowerCase();
      return {
        id: String(row.id),
        name: String(row.name ?? email),
        email,
        phone: String(row.phone ?? "") || null,
        course: String(row.course ?? "") || null,
        enrollment_date: String(row.enrollmentDate ?? row.enrollment_date ?? "") || null,
        intake: String(row.intake ?? "").trim() || null,
        progress: asNumber(row.progress),
        status: String(row.status ?? "active"),
        paid_amount: asNumber(row.paidAmount ?? row.paid_amount),
        fee_due: asNumber(row.feeDue ?? row.fee_due) || feeDueFor(String(row.course ?? ""), String(row.feeTrackId ?? row.fee_track_id ?? "") || undefined),
        fee_track_id: String(row.feeTrackId ?? row.fee_track_id ?? "").trim() || null,
      };
    });
  await upsertBatch(admin, "learners", learners);

  const payments = snapshotList(snapshot, "dreyz_payments")
    .map(mapSnapshotPayment)
    .filter((p): p is PaymentRecord => !!p)
    .map((mapped) => ({
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
    }));
  await upsertBatch(admin, "payments", payments);

  const courses = snapshotList(snapshot, "dreyz_courses")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category ?? "") || null,
      level: String(row.level ?? "Beginner"),
      duration: String(row.duration ?? "") || null,
      duration_weeks: asNumber(row.durationWeeks ?? row.duration_weeks),
      class_count: asNumber(row.classCount ?? row.class_count),
      test_count: asNumber(row.testCount ?? row.test_count),
      exam_count: asNumber(row.examCount ?? row.exam_count),
      has_final_exam: Boolean(row.hasFinalExam ?? row.has_final_exam),
      enrolled: asNumber(row.enrolled),
      capacity: asNumber(row.capacity, 100),
      instructor: String(row.instructor ?? "") || null,
      status: String(row.status ?? "draft"),
      price: asNumber(row.price),
    }));
  await upsertBatch(admin, "courses", courses);

  const notices = snapshotList(snapshot, "dreyz_notices")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content ?? "") || null,
      date: String(row.date ?? "") || null,
      priority: String(row.priority ?? "medium"),
      category: String(row.category ?? "General"),
    }));
  await upsertBatch(admin, "notices", notices);

  const attendance = snapshotList(snapshot, "dreyz_attendance")
    .filter((row) => row.id)
    .map((row) => ({
      id: String(row.id),
      learner_id: String(row.learnerId ?? row.learner_id ?? "") || null,
      learner_name: String(row.learnerName ?? row.learner_name ?? "") || null,
      course: String(row.course ?? "") || null,
      date: String(row.date ?? "") || null,
      status: String(row.status ?? "present"),
    }));
  await upsertBatch(admin, "attendance", attendance);

  const assessments = snapshotList(snapshot, "dreyz_assessments")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      course: String(row.course ?? "") || null,
      type: String(row.type ?? "test"),
      date: String(row.date ?? "") || null,
      max_score: asNumber(row.maxScore ?? row.max_score, 100),
      submissions: asNumber(row.submissions),
    }));
  await upsertBatch(admin, "assessments", assessments);

  const grades = snapshotList(snapshot, "dreyz_grades")
    .filter((row) => row.id)
    .map((row) => ({
      id: String(row.id),
      assessment_id: String(row.assessmentId ?? row.assessment_id ?? ""),
      learner_id: String(row.learnerId ?? row.learner_id ?? ""),
      learner_name: String(row.learnerName ?? row.learner_name ?? "") || null,
      title: String(row.title ?? "") || null,
      course: String(row.course ?? "") || null,
      type: String(row.type ?? "test"),
      score: asNumber(row.score),
      max_score: asNumber(row.maxScore ?? row.max_score, 100),
      date: String(row.date ?? "") || null,
    }));
  await upsertBatch(admin, "grades", grades);

  const projects = snapshotList(snapshot, "dreyz_projects")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      learner_id: String(row.learnerId ?? row.learner_id ?? "") || null,
      learner_name: String(row.learnerName ?? row.learner_name ?? "") || null,
      title: String(row.title),
      course: String(row.course ?? "") || null,
      score: asNumber(row.score),
      status: String(row.status ?? "submitted"),
      thumbnail: row.thumbnail ? String(row.thumbnail) : null,
    }));
  await upsertBatch(admin, "projects", projects);

  const enrollments = snapshotList(snapshot, "dreyz_enrollments")
    .filter((row) => row.id)
    .map((row) => ({
      id: String(row.id),
      learner_name: String(row.learnerName ?? row.learner_name ?? ""),
      learner_email: String(row.learnerEmail ?? row.learner_email ?? "").toLowerCase() || null,
      course: String(row.course ?? "") || null,
      fee_track_id: String(row.feeTrackId ?? row.fee_track_id ?? "") || null,
      date: String(row.date ?? "") || null,
      amount: asNumber(row.amount),
      status: String(row.status ?? "paid"),
    }));
  await upsertBatch(admin, "enrollments", enrollments);

  const instructors = snapshotList(snapshot, "dreyz_instructors")
    .filter((row) => row.id && row.name)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email ?? ""),
      phone: row.phone ? String(row.phone) : null,
      specialty: String(row.specialty ?? "") || null,
      courses: asNumber(row.courses),
      rating: asNumber(row.rating),
      status: String(row.status ?? "active"),
      assigned_course_ids: Array.isArray(row.assignedCourseIds)
        ? row.assignedCourseIds
        : Array.isArray(row.assigned_course_ids)
          ? row.assigned_course_ids
          : [],
    }));
  await upsertBatch(admin, "instructors", instructors);

  const modules = snapshotList(snapshot, "dreyz_modules")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      course_id: String(row.courseId ?? row.course_id ?? "") || null,
      title: String(row.title),
      lessons: asNumber(row.lessons),
      duration: String(row.duration ?? "") || null,
      order: asNumber(row.order),
      class_count: asNumber(row.classCount ?? row.class_count),
      quizzes: asNumber(row.quizzes),
      projects: asNumber(row.projects),
    }));
  await upsertBatch(admin, "modules", modules);

  const schedule = snapshotList(snapshot, "dreyz_schedule")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      course: String(row.course ?? "") || null,
      date: String(row.date ?? "") || null,
      time: String(row.time ?? "") || null,
      type: String(row.type ?? "live"),
      instructor: String(row.instructor ?? "") || null,
    }));
  await upsertBatch(admin, "schedule_items", schedule);

  const resources = snapshotList(snapshot, "dreyz_resources")
    .filter((row) => row.id && row.title)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category ?? "") || null,
      type: String(row.type ?? "PDF"),
      files: asNumber(row.files),
      downloads: asNumber(row.downloads),
      file_url: row.fileUrl ? String(row.fileUrl) : row.file_url ? String(row.file_url) : null,
      paid: Boolean(row.paid),
      price: asNumber(row.price),
    }));
  await upsertBatch(admin, "resources", resources);

  // Keep fee_tracks catalog in sync with code defaults (idempotent).
  await upsertBatch(
    admin,
    "fee_tracks",
    feeTracks.map((t) => ({
      id: t.id,
      name: t.name,
      duration_months: t.durationMonths,
      total: t.total,
      includes_internship: t.includesInternship,
      legacy: Boolean(t.legacy),
      breakdown: t.breakdown,
    }))
  );
}
