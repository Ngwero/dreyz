import { getFeeTracks } from "./fee-catalog";
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
  const feeTracks = getFeeTracks();
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
  return getFeeTracks().some(
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

function courseTitleMatches(recordCourse: string, course: Pick<Course, "id" | "title">) {
  const a = recordCourse.trim().toLowerCase();
  const b = course.title.trim().toLowerCase();
  if (!a || !b) return false;
  return (
    a === b ||
    a === course.id.toLowerCase() ||
    a.includes(b) ||
    b.includes(a)
  );
}

function catalogueUnitsForLearner(
  learner: Pick<Learner, "course">,
  courses: Course[]
): Course[] {
  const normalized = courses.map(normalizeCourse);
  const matched = courseForLearner(learner, normalized);
  if (matched && !isProgrammeCourseLabel(learner.course)) {
    return [matched];
  }

  const active = normalized.filter((c) => c.status === "active");
  const label = learner.course.toLowerCase();
  const includeInternship =
    label.includes("6-month") ||
    label.includes("internship") ||
    !isProgrammeCourseLabel(learner.course);
  const pool = active.filter((c) =>
    includeInternship ? true : c.category !== "Internship"
  );
  return pool.length ? pool : active;
}

type ProgressTargets = {
  title: string;
  durationWeeks: number;
  classCount: number;
  testCount: number;
  examCount: number;
  hasFinalExam: boolean;
};

/** Sum Super Admin targets from the learner’s catalogue course(s). */
function progressTargetsForLearner(
  learner: Pick<Learner, "course">,
  courses: Course[]
): ProgressTargets {
  const units = catalogueUnitsForLearner(learner, courses);
  if (!units.length) {
    return {
      title: learner.course || "Professional Interior Design Programme",
      durationWeeks: 0,
      classCount: 0,
      testCount: 0,
      examCount: 0,
      hasFinalExam: false,
    };
  }
  return {
    title:
      units.length === 1
        ? units[0].title
        : learner.course || "Professional Interior Design Programme",
    durationWeeks: units.reduce((s, c) => s + (c.durationWeeks ?? 0), 0),
    classCount: units.reduce((s, c) => s + (c.classCount ?? 0), 0),
    testCount: units.reduce((s, c) => s + (c.testCount ?? 0), 0),
    examCount: units.reduce((s, c) => s + (c.examCount ?? 0), 0),
    hasFinalExam: units.some((c) => c.hasFinalExam),
  };
}

/**
 * Class attendance progress depends on each course’s classCount.
 * Only marks saved against that course title count toward its target.
 */
function classAttendanceProgress(
  learner: Pick<Learner, "id" | "course" | "enrollmentDate">,
  courses: Course[],
  records: AttendanceRecord[]
) {
  const units = catalogueUnitsForLearner(learner, courses).filter(
    (c) => (c.classCount ?? 0) > 0
  );
  const awarded = awardedAttendance(records, learner.enrollmentDate);

  if (!units.length) {
    const { present, late } = attendanceSummary(awarded);
    return { done: present + late, required: 0, part: 0 };
  }

  let required = 0;
  let done = 0;
  let rawDone = 0;
  for (const course of units) {
    const need = course.classCount ?? 0;
    const forCourse = awarded.filter((r) => courseTitleMatches(r.course, course));
    const { present, late } = attendanceSummary(forCourse);
    const attended = present + late;
    required += need;
    rawDone += attended;
    done += Math.min(need, attended);
  }

  return {
    done: rawDone,
    required,
    part: required > 0 ? Math.min(1, done / required) : 0,
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
 * classes attended (per course classCount), tests, exams, and the final exam when required.
 * Assessment parts use score quality (score/max), so mark changes move the bar.
 */
export function learnerProgressBreakdown(
  learner: Pick<Learner, "id" | "progress" | "course" | "enrollmentDate">,
  courses = coursesStore.getAll()
): ProgressBreakdown {
  const targets = progressTargetsForLearner(learner, courses);
  const testRequired = targets.testCount;
  const examRequired = targets.examCount;
  const finalRequired = targets.hasFinalExam ? 1 : 0;

  const attendanceRecords = attendanceStore
    .getAll()
    .filter((r) => r.learnerId === learner.id);
  const classes = classAttendanceProgress(learner, courses, attendanceRecords);

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
  if (classes.required > 0) parts.push(classes.part);
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
    classes: { done: classes.done, required: classes.required },
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

/** Class sessions Super Admin set for a catalogue course title (0 if unknown). */
export function classCountForCourseTitle(
  title: string,
  courses = coursesStore.getAll()
): number {
  const needle = title.trim().toLowerCase();
  if (!needle) return 0;
  const match = courses
    .map(normalizeCourse)
    .find(
      (c) =>
        c.title.toLowerCase() === needle ||
        c.id.toLowerCase() === needle ||
        needle.includes(c.title.toLowerCase()) ||
        c.title.toLowerCase().includes(needle)
    );
  return match?.classCount ?? 0;
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
