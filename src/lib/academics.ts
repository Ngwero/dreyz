import { feeTracks } from "./data";
import { getPayments } from "./auth";
import { attendanceStore, coursesStore, gradesStore, learnersStore } from "./store";
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

export function schoolFeeTotals(
  learners: { email: string; paidAmount?: number; feeDue?: number; feeTrackId?: string }[]
) {
  return learners.reduce(
    (acc, learner) => {
      const snap = feesForStudent(
        learner.email,
        learner.feeTrackId,
        learner.paidAmount,
        learner.feeDue
      );
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

function uniqueGradesByAssessment(grades: Grade[], match: (type: Grade["type"]) => boolean) {
  const byAsm = new Map<string, Grade>();
  for (const g of grades) {
    if (!match(g.type)) continue;
    const key = g.assessmentId || g.id;
    const prev = byAsm.get(key);
    if (!prev || g.score >= prev.score) byAsm.set(key, g);
  }
  return [...byAsm.values()];
}

/** Count of marked assessments; quality is average score ratio across required slots (unmarked = 0). */
function assessmentProgress(grades: Grade[], match: (type: Grade["type"]) => boolean, required: number) {
  const list = uniqueGradesByAssessment(grades, match);
  const done = list.length;
  if (required <= 0) return { done, part: 0 };
  const qualitySum = list.reduce(
    (sum, g) => sum + Math.min(1, Math.max(0, g.score / Math.max(g.maxScore, 1))),
    0
  );
  return { done, part: Math.min(1, qualitySum / required) };
}

function isProgrammeCourseLabel(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (
    n.includes("programme") ||
    n.includes("program") ||
    n.includes("main course") ||
    /\d[\s-]*month/.test(n)
  ) {
    return true;
  }
  return feeTracks.some(
    (t) => t.id.toLowerCase() === n || t.name.toLowerCase() === n
  );
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

type ProgressTargets = {
  title: string;
  durationWeeks: number;
  classCount: number;
  testCount: number;
  examCount: number;
  hasFinalExam: boolean;
};

/** Resolve Super Admin unit targets, or the full active programme when the learner holds a fee-track label. */
function progressTargetsForLearner(
  learner: Pick<Learner, "course">,
  courses: Course[]
): ProgressTargets {
  const matched = courseForLearner(learner, courses);
  if (
    matched &&
    ((matched.classCount ?? 0) > 0 ||
      (matched.testCount ?? 0) > 0 ||
      (matched.examCount ?? 0) > 0 ||
      matched.hasFinalExam)
  ) {
    return {
      title: matched.title,
      durationWeeks: matched.durationWeeks ?? 0,
      classCount: matched.classCount ?? 0,
      testCount: matched.testCount ?? 0,
      examCount: matched.examCount ?? 0,
      hasFinalExam: !!matched.hasFinalExam,
    };
  }

  const active = courses
    .map(normalizeCourse)
    .filter((c) => c.status === "active");
  const label = learner.course.toLowerCase();
  const includeInternship =
    label.includes("6-month") ||
    label.includes("internship") ||
    !isProgrammeCourseLabel(learner.course);
  const pool = active.filter((c) =>
    includeInternship ? true : c.category !== "Internship"
  );
  const units = pool.length ? pool : active;

  return {
    title: learner.course || "Professional Interior Design Programme",
    durationWeeks: units.reduce((s, c) => s + (c.durationWeeks ?? 0), 0),
    classCount: units.reduce((s, c) => s + (c.classCount ?? 0), 0),
    testCount: units.reduce((s, c) => s + (c.testCount ?? 0), 0),
    examCount: units.reduce((s, c) => s + (c.examCount ?? 0), 0),
    hasFinalExam: units.some((c) => c.hasFinalExam),
  };
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
 * Assessment parts use score quality (score/max), so mark changes move the bar.
 */
export function learnerProgressBreakdown(
  learner: Pick<Learner, "id" | "progress" | "course" | "enrollmentDate">,
  courses = coursesStore.getAll()
): ProgressBreakdown {
  const targets = progressTargetsForLearner(learner, courses);
  const classRequired = targets.classCount;
  const testRequired = targets.testCount;
  const examRequired = targets.examCount;
  const finalRequired = targets.hasFinalExam ? 1 : 0;

  const attendance = awardedAttendance(
    attendanceStore.getAll().filter((r) => r.learnerId === learner.id),
    learner.enrollmentDate
  );
  const { present, late } = attendanceSummary(attendance);
  const classesDone = present + late;

  const grades = gradesStore.getAll().filter((g) => g.learnerId === learner.id);
  const tests = assessmentProgress(grades, isTestType, testRequired);
  const exams = assessmentProgress(grades, (t) => t === "exam", examRequired);
  const finals = uniqueGradesByAssessment(grades, (t) => t === "final");
  const finalDone = finals.length > 0 ? 1 : 0;
  const finalPart =
    finalRequired > 0 && finals[0]
      ? Math.min(1, Math.max(0, finals[0].score / Math.max(finals[0].maxScore, 1)))
      : 0;

  const parts: number[] = [];
  if (classRequired > 0) parts.push(Math.min(1, classesDone / classRequired));
  if (testRequired > 0) parts.push(tests.part);
  if (examRequired > 0) parts.push(exams.part);
  if (finalRequired > 0) parts.push(finalPart);

  const percent =
    parts.length === 0
      ? learner.progress ?? 0
      : Math.min(100, Math.round((parts.reduce((s, n) => s + n, 0) / parts.length) * 100));

  return {
    percent,
    durationWeeks: targets.durationWeeks,
    classes: { done: classesDone, required: classRequired },
    tests: { done: tests.done, required: testRequired },
    exams: { done: exams.done, required: examRequired },
    final: { done: finalDone, required: finalRequired },
  };
}

export function computeLearnerProgress(
  learner: Pick<Learner, "id" | "progress" | "course" | "enrollmentDate">
): number {
  return learnerProgressBreakdown(learner).percent;
}

/** Persist live % onto the learner roster so exports and cloud sync stay in sync with attendance/marks. */
export function syncLearnerProgress(learnerIds?: string[]) {
  const idSet = learnerIds?.length ? new Set(learnerIds) : null;
  for (const learner of learnersStore.getAll()) {
    if (idSet && !idSet.has(learner.id)) continue;
    const percent = computeLearnerProgress(learner);
    if (learner.progress === percent) continue;
    learnersStore.upsert({ ...learner, progress: percent });
  }
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
