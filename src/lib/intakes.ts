import { schoolInfo } from "./data";

export type IntakeStatus = "open" | "closed" | "upcoming";

export type IntakeOption = {
  id: string;
  label: string;
  status: IntakeStatus;
};

/** Named intakes the school runs (registration / cohort labels). */
export const INTAKE_OPTIONS: IntakeOption[] = [
  { id: "may-2025", label: "May 2025", status: "closed" },
  { id: "sep-2025", label: "September 2025", status: "closed" },
  { id: "jan-2026", label: "January 2026", status: "closed" },
  { id: "may-2026", label: "May 2026", status: "closed" },
  { id: "sep-2026", label: "September 2026", status: "closed" },
  { id: "jan-2027", label: "January 2027", status: "open" },
];

export function currentOpenIntake(): string {
  return (
    INTAKE_OPTIONS.find((i) => i.status === "open")?.label ??
    schoolInfo.intake ??
    "January 2027"
  );
}

/** Map an enrollment date to a cohort label (May / Sep / Jan intakes). */
export function intakeFromEnrollmentDate(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}/.test(isoDate)) return currentOpenIntake();
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  if (!year || !month) return currentOpenIntake();
  // Jan–Apr → January; May–Aug → May; Sep–Dec → September
  if (month >= 9) return `September ${year}`;
  if (month >= 5) return `May ${year}`;
  return `January ${year}`;
}

export function resolveLearnerIntake(learner: {
  intake?: string;
  enrollmentDate?: string;
}): string {
  const explicit = learner.intake?.trim();
  if (explicit) return explicit;
  return intakeFromEnrollmentDate(learner.enrollmentDate);
}

/** Sort intakes newest first. */
export function compareIntakeLabels(a: string, b: string): number {
  const parse = (label: string) => {
    const m = label.match(/(january|may|september)\s+(\d{4})/i);
    if (!m) return { year: 0, half: 0 };
    const year = Number(m[2]);
    const name = m[1].toLowerCase();
    const half = name === "january" ? 1 : name === "may" ? 2 : 3;
    return { year, half };
  };
  const A = parse(a);
  const B = parse(b);
  if (A.year !== B.year) return B.year - A.year;
  return B.half - A.half;
}

export function intakeStatus(label: string): IntakeStatus {
  const known = INTAKE_OPTIONS.find((i) => i.label === label);
  if (known) return known.status;
  if (label === schoolInfo.intake) return "open";
  return "closed";
}

/** Unique intake labels from known options plus any live roster values. */
export function collectIntakeLabels(extra: string[] = []): string[] {
  const set = new Set<string>();
  for (const opt of INTAKE_OPTIONS) set.add(opt.label);
  for (const label of extra) {
    const t = label.trim();
    if (t) set.add(t);
  }
  return [...set].sort(compareIntakeLabels);
}
