import type { Course } from "./types";

export function parseDurationWeeks(duration: string | undefined): number {
  if (!duration) return 0;
  const n = parseInt(duration, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (/month/i.test(duration)) return n * 4;
  return n;
}

export function durationLabel(weeks: number): string {
  if (weeks >= 8 && weeks % 4 === 0) return `${weeks / 4} months`;
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

export function normalizeCourse(course: Course): Course {
  const durationWeeks =
    course.durationWeeks && course.durationWeeks > 0
      ? course.durationWeeks
      : parseDurationWeeks(course.duration);
  const missingStructure = course.classCount === undefined;
  const fillDefaults = missingStructure && course.status === "active";
  const weeks = durationWeeks || (fillDefaults ? 2 : 0);
  return {
    ...course,
    durationWeeks: weeks,
    duration: course.duration || (weeks ? durationLabel(weeks) : course.duration),
    classCount: course.classCount ?? (fillDefaults ? Math.max(4, weeks * 3) : 0),
    testCount: course.testCount ?? (fillDefaults ? 1 : 0),
    examCount: course.examCount ?? (fillDefaults ? 1 : 0),
    hasFinalExam: course.hasFinalExam ?? fillDefaults,
  };
}

/** Super Admin must set these before a course can be marked active. */
export function isCourseReadyToActivate(course: Pick<
  Course,
  "durationWeeks" | "duration" | "classCount" | "testCount" | "examCount" | "hasFinalExam"
>): boolean {
  return (
    (course.classCount ?? 0) > 0 &&
    course.testCount !== undefined &&
    course.testCount >= 0 &&
    course.examCount !== undefined &&
    course.examCount >= 0 &&
    typeof course.hasFinalExam === "boolean"
  );
}

export function courseStructureSummary(course: Course): string {
  const c = normalizeCourse(course);
  const parts = [
    `${c.classCount} classes`,
    `${c.testCount} tests`,
    `${c.examCount} exams`,
    c.hasFinalExam ? "final exam" : "no final",
  ];
  return parts.join(" · ");
}
