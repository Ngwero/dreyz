"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  AttendancePulseChart,
  GradientBarChart,
  ProgressRadarChart,
} from "@/components/dashboard/SchoolCharts";
import { getAllUsers } from "@/lib/auth";
import { attendanceSummary, learnerProgressBreakdown } from "@/lib/academics";
import {
  assessmentsStore,
  attendanceStore,
  coursesStore,
  gradesStore,
  learnersStore,
  modulesStore,
  projectsStore,
  scheduleStore,
  useLiveTick,
} from "@/lib/store";
import type { Instructor } from "@/lib/types";

function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-lg font-bold text-white">
      {letters}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(rating) ? "text-accent" : "text-border"}>
          ★
        </span>
      ))}
      <span className="ml-1.5 text-sm font-semibold tabular-nums text-foreground">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function Sparkline({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const w = 320;
  const h = 88;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - 10 - (v / max) * (h - 24);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[88px] w-full" role="img" aria-label="Attendance trend">
        <defs>
          <linearGradient id="tutorSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b7eef" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#082878" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#tutorSpark)" />
        <polyline
          points={line}
          fill="none"
          stroke="#082878"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function pct(done: number, required: number) {
  if (required <= 0) return 0;
  return Math.min(100, Math.round((done / required) * 100));
}

export function InstructorProfile({
  instructor,
  onClose,
}: {
  instructor: Instructor | null;
  onClose: () => void;
}) {
  const tick = useLiveTick();
  void tick;
  if (!instructor) return null;

  const account = getAllUsers().find(
    (u) =>
      u.instructorId === instructor.id ||
      (u.role === "tutor" && u.email.toLowerCase() === instructor.email.toLowerCase())
  );
  const courses = coursesStore.getAll();
  const assigned = courses.filter(
    (c) =>
      instructor.assignedCourseIds?.includes(c.id) ||
      c.instructor.toLowerCase() === instructor.name.toLowerCase()
  );
  const titles = new Set(assigned.map((c) => c.title));
  const learners = learnersStore.getAll().filter((l) => titles.has(l.course));
  const learnerIds = new Set(learners.map((l) => l.id));
  const sessions = scheduleStore
    .getAll()
    .filter((s) => s.instructor.toLowerCase() === instructor.name.toLowerCase())
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const attendance = attendanceStore
    .getAll()
    .filter((r) => titles.has(r.course) || learnerIds.has(r.learnerId));
  const att = attendanceSummary(attendance);
  const presentRate =
    att.total === 0 ? 0 : Math.round(((att.present + att.late * 0.5) / att.total) * 100);

  const grades = gradesStore.getAll().filter((g) => learnerIds.has(g.learnerId));
  const avgScore =
    grades.length === 0
      ? 0
      : Math.round(
          grades.reduce((s, g) => s + (g.score / Math.max(g.maxScore, 1)) * 100, 0) /
            grades.length
        );
  const assessments = assessmentsStore.getAll().filter((a) => titles.has(a.course));
  const modules = modulesStore.getAll().filter((m) => assigned.some((c) => c.id === m.courseId));
  const projects = projectsStore.getAll().filter((p) => learnerIds.has(p.learnerId));

  const breakdowns = learners.map((l) => learnerProgressBreakdown(l));
  const avgProgress =
    breakdowns.length === 0
      ? 0
      : Math.round(breakdowns.reduce((s, b) => s + b.percent, 0) / breakdowns.length);
  const avgMetric = (pick: (b: (typeof breakdowns)[number]) => { done: number; required: number }) => {
    if (breakdowns.length === 0) return 0;
    return Math.round(
      breakdowns.reduce((s, b) => {
        const m = pick(b);
        if (m.required > 0) return s + pct(m.done, m.required);
        if (m.done > 0) return s + 100;
        return s + b.percent;
      }, 0) / breakdowns.length
    );
  };

  const learnersByCourse = assigned.map((c) => ({
    name: c.title.length > 16 ? `${c.title.slice(0, 14)}…` : c.title,
    value: learners.filter((l) => l.course === c.title).length,
  }));

  const byDate = new Map<string, { present: number; late: number; absent: number }>();
  for (const r of attendance) {
    const row = byDate.get(r.date) ?? { present: 0, late: 0, absent: 0 };
    row[r.status] += 1;
    byDate.set(r.date, row);
  }
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, row]) => {
      const total = row.present + row.late + row.absent;
      return {
        label: date.slice(5),
        rate: total ? Math.round((row.present / total) * 100) : 0,
      };
    });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.filter((s) => s.date >= today);
  const past = sessions.filter((s) => s.date < today);

  return (
    <Modal open title={`${instructor.name} · tutor profile`} onClose={onClose} xl>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Initials name={instructor.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{instructor.name}</p>
              <Badge
                variant={
                  instructor.status === "active"
                    ? "success"
                    : instructor.status === "suspended"
                      ? "danger"
                      : "warning"
                }
              >
                {instructor.status}
              </Badge>
              {account ? (
                <Badge variant={account.status === "active" ? "accent" : "default"}>
                  Portal {account.status}
                </Badge>
              ) : (
                <Badge>No portal login</Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{instructor.id}</p>
            <p className="mt-2 text-sm text-muted">{instructor.specialty}</p>
            <div className="mt-2">
              <Stars rating={instructor.rating} />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Email" value={instructor.email} />
          <Fact label="Phone" value={instructor.phone ?? ""} />
          <Fact label="Portal created" value={account?.createdAt ?? "No account"} />
          <Fact label="Last login" value={account?.lastLoginAt?.slice(0, 10) ?? "Never"} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [assigned.length, "Courses"],
            [learners.length, "Learners"],
            [`${presentRate}%`, "Attendance"],
            [`${avgProgress}%`, "Avg progress"],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-xl bg-surface px-2 py-3 text-center">
              <p className="text-xl font-semibold tabular-nums text-foreground">{n}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Class attendance
            </p>
            <p className="mt-1 text-xs text-muted">
              {att.total} marks across this tutor’s courses
            </p>
            <div className="mt-2">
              <AttendancePulseChart present={att.present} late={att.late} absent={att.absent} />
            </div>
          </section>
          <section className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Learner completion
            </p>
            <p className="mt-1 text-xs text-muted">
              Average of classes, tests, exams, and final for their students
            </p>
            {learners.length === 0 ? (
              <p className="mt-8 text-center text-sm text-muted">No learners on assigned courses yet.</p>
            ) : (
              <ProgressRadarChart
                classes={avgMetric((b) => b.classes)}
                tests={avgMetric((b) => b.tests)}
                exams={avgMetric((b) => b.exams)}
                final={avgMetric((b) => b.final)}
              />
            )}
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Learners per course
            </p>
            {learnersByCourse.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Assign courses to see load.</p>
            ) : (
              <GradientBarChart data={learnersByCourse} valueLabel="Learners" />
            )}
          </section>
          <section className="rounded-2xl border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Present rate over time
            </p>
            {trend.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No attendance recorded on these courses yet.</p>
            ) : (
              <>
                <Sparkline values={trend.map((t) => t.rate)} labels={trend.map((t) => t.label)} />
                <p className="mt-2 text-xs text-muted">Percent of students marked present each session.</p>
              </>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-surface/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Assigned courses
          </p>
          {assigned.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No courses assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {assigned.map((c) => {
                const enrolled = learners.filter((l) => l.course === c.title).length;
                const cap = Math.max(c.capacity, 1);
                const fill = Math.min(100, Math.round((enrolled / cap) * 100));
                const modCount = modules.filter((m) => m.courseId === c.id).length;
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {c.level} · {c.duration} · {c.status}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card">
                      <div className="h-full rounded-full bg-navy" style={{ width: `${fill}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {enrolled}/{c.capacity} seats · {modCount} modules · {c.category}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border px-3 py-2.5 text-center">
            <p className="text-lg font-semibold tabular-nums">{avgScore || "—"}</p>
            <p className="text-[10px] uppercase text-muted">Avg mark %</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5 text-center">
            <p className="text-lg font-semibold tabular-nums">{assessments.length}</p>
            <p className="text-[10px] uppercase text-muted">Assessments set</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5 text-center">
            <p className="text-lg font-semibold tabular-nums">{projects.length}</p>
            <p className="text-[10px] uppercase text-muted">Studio projects</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Learner mix
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface py-2">
              <p className="text-lg font-semibold tabular-nums">
                {learners.filter((l) => l.status === "active").length}
              </p>
              <p className="text-[10px] uppercase text-muted">Active</p>
            </div>
            <div className="rounded-xl bg-surface py-2">
              <p className="text-lg font-semibold tabular-nums">
                {learners.filter((l) => l.status === "paused").length}
              </p>
              <p className="text-[10px] uppercase text-muted">Paused</p>
            </div>
            <div className="rounded-xl bg-surface py-2">
              <p className="text-lg font-semibold tabular-nums">
                {learners.filter((l) => l.status === "completed").length}
              </p>
              <p className="text-[10px] uppercase text-muted">Completed</p>
            </div>
          </div>
          {learners.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No learners listed on these courses.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {learners.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="text-[11px] text-muted">{l.course}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {learnerProgressBreakdown(l).percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Upcoming sessions
            </p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Nothing upcoming on the timetable.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {s.date} · {s.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Recent sessions
            </p>
            {past.length === 0 ? (
              <p className="text-sm text-muted">No past sessions recorded.</p>
            ) : (
              <ul className="space-y-2">
                {past
                  .slice(-5)
                  .reverse()
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{s.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {s.date} · {s.time}
                      </span>
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
