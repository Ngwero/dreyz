"use client";

import {
  INTAKE_OPTIONS,
  resolveLearnerIntake,
  collectIntakeLabels,
  intakeStatus,
} from "@/lib/intakes";
import type { Learner } from "@/lib/types";

type Props = {
  learners: Learner[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
};

/** Shared intake tabs for Learners, Attendance, Assessments, Portfolio. */
export function IntakeFilterTabs({ learners, value, onChange, className = "" }: Props) {
  const counts = new Map<string, number>();
  for (const l of learners) {
    const intake = resolveLearnerIntake(l);
    counts.set(intake, (counts.get(intake) ?? 0) + 1);
  }
  const known = new Set(INTAKE_OPTIONS.map((o) => o.label));
  const tabs = collectIntakeLabels([...counts.keys()]).filter(
    (label) => known.has(label) || (counts.get(label) ?? 0) > 0
  );

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          value === "all" ? "bg-[#082878] text-white" : "bg-surface text-muted"
        }`}
      >
        All intakes ({learners.length})
      </button>
      {tabs.map((label) => {
        const count = counts.get(label) ?? 0;
        const status = intakeStatus(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              value === label ? "bg-[#082878] text-white" : "bg-surface text-muted"
            }`}
          >
            {label}
            <span className="ml-1 opacity-70">({count})</span>
            {status === "open" && value !== label ? (
              <span className="ml-1 text-[10px] text-emerald-600">open</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
