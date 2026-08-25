import { feeTracks } from "./data";
import { getPayments } from "./auth";
import { attendanceStore, coursesStore, gradesStore } from "./store";
import { normalizeCourse } from "./course-structure";
import type { Assessment, AttendanceRecord, Course, Grade, Learner } from "./types";

/** Registration + first tuition installment — activates learner roster access. */
export const LEARNER_ACTIVATION_UGX = 1_000_000;

export type FeeSnapshot = {
  total: number;
  paid: number;
  balance: number;
  isLearner: boolean;
};

export function feesForStudent(
  email: string,
  feeTrackId?: string,
  learnerPaid?: number,
  learnerDue?: number
): FeeSnapshot {
  const track = feeTracks.find((t) => t.id === feeTrackId);
  const total = learnerDue && learnerDue > 0 ? learnerDue : track?.total ?? feeTracks[0]?.total ?? 3_350_000;
  const fromPayments = getPayments()
    .filter(
      (p) =>
        p.learnerEmail.toLowerCase() === email.toLowerCase() &&
        p.status === "confirmed"
    )
    .reduce((sum, p) => sum + p.amount, 0);
  /** Ledger is source of truth; roster paidAmount is a fallback before the first payment is stored. */
  const paid = fromPayments > 0 ? fromPayments : learnerPaid ?? 0;
  return {
    total,
    paid,
    balance: Math.max(0, total - paid),
    isLearner: paid >= LEARNER_ACTIVATION_UGX,
  };
}

export function schoolFeeTotals(learners: { email: string; paidAmount?: number; feeDue?: number }[]) {
  return learners.reduce(
    (acc, learner) => {
      const snap = feesForStudent(learner.email, undefined, learner.paidAmount, learner.feeDue);
      acc.expected += snap.total;
      acc.paid += snap.paid;
      acc.balance += snap.balance;
      return acc;
    },
    { expected: 0, paid: 0, balance: 0 }
  );
}

/** Programme attendance that counts toward class progress (4 months + 2-month internship). */
export const ATTENDANCE_AWARD_MONTHS = 6;

export function addCalendarMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const lastDay = new Date(year, month - 1 + months + 1, 0).getDate();
  const out = new Date(year, month - 1 + months, Math.min(day, lastDay));
  const y = out.getFullYear();
  const m = String(out.getMonth() + 1).padStart(2, "0");
  const d = String(out.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function attendanceAwardWindow(enrollmentDate?: string) {
  const from =
    enrollmentDate && /^\d{4}-\d{2}-\d{2}$/.test(enrollmentDate)
      ? enrollmentDate
      : "";
  return { from, to: from ? addCalendarMonths(from, ATTENDANCE_AWARD_MONTHS) : "" };
}

/** Inclusive of enrolment day, exclusive of the same calendar day six months later. */
export function attendanceCountsForAward(date: string, enrollmentDate?: string) {
  if (!enrollmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(enrollmentDate)) return true;
  const { from, to } = attendanceAwardWindow(enrollmentDate);
  return date >= from && date < to;
}

export function awardedAttendance(
  records: AttendanceRecord[],
  enrollmentDate?: string
) {
  return records.filter((r) => attendanceCountsForAward(r.date, enrollmentDate));
}

export function attendanceSummary(records: AttendanceRecord[]) {
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const total = records.length;
  const strikes = absent + Math.floor(late / 2);
  return { present, late, absent, total, strikes };
}

function isTestType(type: Assessment["type"] | Grade["type"]) {
  return type === "test" || type === "quiz";
}

function uniqueAssessmentCount(grades: Grade[], match: (type: Grade["type"]) => boolean) {
  return new Set(grades.filter((g) => match(g.type)).map((g) => g.assessmentId || g.id)).size;
}

function courseForLearner(learner: Pick<Learner, "course">, courses: Course[]) {
  const name = learner.course.toLowerCase();
  return courses
    .map(normalizeCourse)
    .find(
      (c) =>
        c.title.toLowerCase() === name ||
        c.id.toLowerCase() === name ||
        name.includes(c.title.toLowerCase())
    );
}

export type ProgressBreakdown = {
  percent: number;
  durationWeeks: number;
  classes: { done: number; required: number };
  tests: { done: number; required: number };
  exams: { done: number; required: number };
  final: { done: number; required: number };
};

/**
 * Progress is driven by Super Admin course targets:
 * classes attended, tests, exams, and the final exam when required.
 */
export function learnerProgressBreakdown(
  learner: Pick<Learner, "id" | "progress" | "course" | "enrollmentDate">,
  courses = coursesStore.getAll()
): ProgressBreakdown {
  const course = courseForLearner(learner, courses);
  const classRequired = course?.classCount ?? 0;
  const testRequired = course?.testCount ?? 0;
  const examRequired = course?.examCount ?? 0;
  const finalRequired = course?.hasFinalExam ? 1 : 0;

  const attendance = awardedAttendance(
    attendanceStore.getAll().filter((r) => r.learnerId === learner.id),
    learner.enrollmentDate
  );
  const { present, late } = attendanceSummary(attendance);
  const classesDone = present + late;

  const grades = gradesStore.getAll().filter((g) => g.learnerId === learner.id);
  const testsDone = uniqueAssessmentCount(grades, isTestType);
  const examsDone = uniqueAssessmentCount(grades, (t) => t === "exam");
  const finalDone = uniqueAssessmentCount(grades, (t) => t === "final") > 0 ? 1 : 0;

  const parts: number[] = [];
  if (classRequired > 0) parts.push(Math.min(1, classesDone / classRequired));
  if (testRequired > 0) parts.push(Math.min(1, testsDone / testRequired));
  if (examRequired > 0) parts.push(Math.min(1, examsDone / examRequired));
  if (finalRequired > 0) parts.push(finalDone);

  const percent =
    parts.length === 0
      ? learner.progress ?? 0
      : Math.min(100, Math.round((parts.reduce((s, n) => s + n, 0) / parts.length) * 100));

  return {
    percent,
    durationWeeks: course?.durationWeeks ?? 0,
    classes: { done: classesDone, required: classRequired },
    tests: { done: testsDone, required: testRequired },
    exams: { done: examsDone, required: examRequired },
    final: { done: finalDone, required: finalRequired },
  };
}

export function computeLearnerProgress(
  learner: Pick<Learner, "id" | "progress" | "course" | "enrollmentDate">
): number {
  return learnerProgressBreakdown(learner).percent;
}

export function livePerformanceByLevel(
  courses: { category: string; level: string }[],
  grades: { course: string; score: number; maxScore: number }[]
) {
  const buckets: Record<string, number[]> = {
    Beginner: [],
    Intermediate: [],
    Advanced: [],
  };
  for (const g of grades) {
    const course = courses.find((c) => c.category === g.course || c.level === g.course);
    const level = course?.level ?? "Intermediate";
    const pct = (g.score / Math.max(g.maxScore, 1)) * 100;
    (buckets[level] ?? buckets.Intermediate).push(pct);
  }
  return (["Beginner", "Intermediate", "Advanced"] as const).map((level) => {
    const vals = buckets[level];
    const score =
      vals.length === 0 ? 0 : Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
    return { level, score };
  });
}

export function liveCourseMix(courses: { category: string }[]) {
  const colors = ["#061a4a", "#082878", "#1F429A", "#1b7eef", "#d8ff59", "#ff8c00"];
  const counts = new Map<string, number>();
  for (const c of courses) {
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value], i) => ({
    name,
    value,
    color: colors[i % colors.length],
  }));
}
