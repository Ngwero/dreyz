"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { CourseDonutChart } from "@/components/dashboard/CourseDonutChart";
import { formatUGX } from "@/lib/utils";
import { classOptions, feeTracks } from "@/lib/data";
import { getAllUsers } from "@/lib/auth";
import {
  attendanceStore,
  gradesStore,
  projectsStore,
  useLiveTick,
} from "@/lib/store";
import {
  ATTENDANCE_AWARD_MONTHS,
  attendanceSummary,
  awardedAttendance,
  feesForStudent,
  learnerProgressBreakdown,
} from "@/lib/academics";
import type { Learner } from "@/lib/types";
import { resolveLearnerIntake } from "@/lib/intakes";

function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-base font-bold text-accent">
      {letters}
    </div>
  );
}

function Meter({
  label,
  done,
  required,
}: {
  label: string;
  done: number;
  required: number;
}) {
  if (required <= 0) return null;
  const pct = Math.min(100, Math.round((done / required) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {done}/{required} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LearnerProfile({
  learner,
  onClose,
}: {
  learner: Learner | null;
  onClose: () => void;
}) {
  const tick = useLiveTick();
  void tick;
  if (!learner) return null;

  const account = getAllUsers().find(
    (u) =>
      u.learnerId === learner.id ||
      u.email.toLowerCase() === learner.email.toLowerCase()
  );
  const fees = feesForStudent(learner.email, account?.feeTrackId, learner.paidAmount, learner.feeDue);
  const track = feeTracks.find((t) => t.id === account?.feeTrackId) ?? feeTracks[0];
  const klass = classOptions.find((c) => c.id === account?.classOptionId);
  const progress = learnerProgressBreakdown(learner);
  const attendanceAll = attendanceStore
    .getAll()
    .filter((r) => r.learnerId === learner.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
  const attendance = awardedAttendance(attendanceAll, learner.enrollmentDate);
  const att = attendanceSummary(attendance);
  const recentAttendance = attendanceAll.slice(0, 12);
  const grades = gradesStore
    .getAll()
    .filter((g) => g.learnerId === learner.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const projects = projectsStore.getAll().filter((p) => p.learnerId === learner.id);

  return (
    <Modal open title={`${learner.name} · profile`} onClose={onClose} xl>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Initials name={learner.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{learner.name}</p>
              <Badge
                variant={
                  learner.status === "active"
                    ? "success"
                    : learner.status === "completed"
                      ? "info"
                      : "warning"
                }
              >
                {learner.status}
              </Badge>
              {account ? (
                <Badge variant={account.status === "active" ? "accent" : "default"}>
                  Portal {account.status}
                </Badge>
              ) : (
                <Badge>No portal login</Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{learner.id}</p>
            <p className="mt-2 text-sm text-foreground">{learner.email}</p>
            <p className="text-sm text-muted">{learner.phone}</p>
            <p className="mt-2 text-xs text-muted">
              {resolveLearnerIntake(learner)} intake · Enrolled {learner.enrollmentDate}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Fees
          </p>
          {fees.total <= 0 && fees.paid <= 0 ? (
            <p className="mt-6 text-sm text-muted">No fee amount set for this learner.</p>
          ) : (
            <>
              <CourseDonutChart
                total={`${Math.min(100, Math.round((fees.paid / Math.max(fees.total, 1)) * 100))}%`}
                centerLabel={
                  fees.paid <= 0 ? "Not paid" : fees.balance <= 0 ? "Paid in full" : "Part paid"
                }
                centerHint="of programme fee"
                data={[
                  { name: "Paid", value: Math.max(fees.paid, 0), color: "#082878" },
                  { name: "Balance", value: Math.max(fees.balance, 0), color: "#d8ff59" },
                ].filter((slice) => slice.value > 0)}
              />
              <p className="mt-2 text-center text-xs text-muted">
                Expected {formatUGX(fees.total)} · paid {formatUGX(fees.paid)} · balance{" "}
                {formatUGX(fees.balance)}
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            What they are doing
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{learner.course}</p>
          <p className="mt-1 text-sm text-muted">
            {track?.name ?? "Programme fees"}
            {track?.includesInternship ? " · includes internship" : ""}
            {klass ? ` · ${klass.name} (${klass.days}, ${klass.time})` : ""}
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-end justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Academic progress
              </p>
              <p className="text-xl font-semibold tabular-nums text-accent">{progress.percent}%</p>
            </div>
            <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-[#082878]"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="space-y-2.5">
              <Meter
                label="Classes attended"
                done={progress.classes.done}
                required={progress.classes.required}
              />
              <Meter label="Tests" done={progress.tests.done} required={progress.tests.required} />
              <Meter label="Exams" done={progress.exams.done} required={progress.exams.required} />
              <Meter
                label="Final exam"
                done={progress.final.done}
                required={progress.final.required}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Attendance
            </p>
            <p className="mt-1 text-xs text-muted">
              First {ATTENDANCE_AWARD_MONTHS} months from enrolment count toward progress.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Present", att.present, "text-emerald-700"],
                ["Late", att.late, "text-amber-700"],
                ["Absent", att.absent, "text-red-700"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-xl bg-surface px-2 py-3">
                  <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] uppercase text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {att.total} session{att.total === 1 ? "" : "s"} · {att.strikes} strike
              {att.strikes === 1 ? "" : "s"} (absent or two lates)
            </p>
            {recentAttendance.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No attendance marked yet.</p>
            ) : (
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
                {recentAttendance.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted">
                      {r.date}
                      {r.course ? ` · ${r.course}` : ""}
                    </span>
                    <Badge
                      variant={
                        r.status === "present"
                          ? "success"
                          : r.status === "late"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Recent marks
            </p>
            {grades.length === 0 ? (
              <p className="text-sm text-muted">No tests or exams marked yet.</p>
            ) : (
              <ul className="space-y-2">
                {grades.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {g.title} <span className="text-xs text-muted">({g.type})</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {g.score}/{g.maxScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Studio projects
            </p>
            {projects.length === 0 ? (
              <p className="text-sm text-muted">No projects submitted yet.</p>
            ) : (
              <ul className="space-y-2">
                {projects.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{p.title}</span>
                    <Badge variant={p.status === "featured" ? "accent" : "default"}>
                      {p.status} · {p.score}%
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
