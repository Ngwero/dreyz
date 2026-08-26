"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  MapPin,
  Wallet,
  ClipboardCheck,
  Users,
  GraduationCap,
  UserRound,
  Banknote,
  CalendarDays,
  FolderKanban,
  Bell,
  Sparkles,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, formatUGX } from "@/lib/utils";
import {
  courseStats,
  performanceByLevel,
  schoolInfo,
  programme,
  feeTracks,
} from "@/lib/data";
import { ExpandableChart } from "@/components/dashboard/ExpandableChart";
import { CourseDonutChart } from "@/components/dashboard/CourseDonutChart";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import {
  AttendancePulseChart,
  GradientBarChart,
  PeoplePortalChart,
  ProgressRadarChart,
} from "@/components/dashboard/SchoolCharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { collectRecentActivity, formatActivityTime } from "@/lib/activity";
import { getAllUsers } from "@/lib/auth";
import { ROLE_LABELS, roleHomeEyebrow } from "@/lib/roles";
import {
  assessmentsStore,
  attendanceStore,
  coursesStore,
  gradesStore,
  instructorsStore,
  learnersStore,
  noticesStore,
  projectsStore,
  resourcesStore,
  scheduleStore,
  useLiveTick,
} from "@/lib/store";
import {
  liveCourseMix,
  livePerformanceByLevel,
  learnerProgressBreakdown,
  attendanceSummary,
  awardedAttendance,
  schoolFeeTotals,
  feesForStudent,
} from "@/lib/academics";

function DashHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="portal-hero portal-fade-up mb-6 p-5 sm:mb-8 sm:p-7" data-tour="portal-hero">
      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Sparkles size={12} />
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.9rem]">
            {title}
          </h1>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
    </div>
  );
}

function ListRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl bg-surface/80 px-3.5 py-3 transition hover:bg-surface-hover ${className}`}
    >
      {children}
    </div>
  );
}

function CourseMixSection({
  subtitle = "Live mix of units and scores from courses and recorded marks — not demo accounts.",
}: {
  subtitle?: string;
}) {
  const tick = useLiveTick();
  void tick;
  const courses = coursesStore.getAll();
  const grades = gradesStore.getAll();
  const mix = liveCourseMix(courses);
  const performance = livePerformanceByLevel(courses, grades);
  const unitTotal = mix.reduce((s, r) => s + r.value, 0) || programme.courseworkUnits;

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Programme
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Course mix
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p>
        </div>
        <p className="text-xs font-medium text-muted">
          {programme.courseworkUnits} units · {programme.internshipMonths}-mo internship
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ExpandableChart
          title="Unit breakdown"
          details={(mix.length ? mix : courseStats).map((row) => ({
            label: row.name,
            value: `${row.value} units`,
            color: row.color,
          }))}
        >
          <CourseDonutChart
            data={mix.length ? mix : courseStats}
            total={unitTotal}
          />
        </ExpandableChart>
        <ExpandableChart
          title="Performance by level"
          details={(performance.some((p) => p.score > 0) ? performance : performanceByLevel).map(
            (row) => ({
              label: row.level,
              value: `${row.score}% average`,
            })
          )}
        >
          <PerformanceChart
            data={
              performance.some((p) => p.score > 0) ? performance : performanceByLevel
            }
          />
        </ExpandableChart>
      </div>
    </section>
  );
}

function ratio(done: number, required: number) {
  if (!required) return 0;
  return Math.round(Math.min(1, done / required) * 100);
}

function sessionStamp(s: { date: string; time: string }) {
  return `${s.date}T${s.time}`;
}

function UpcomingSessionsPanel({ limit = 5 }: { limit?: number }) {
  const tick = useLiveTick();
  void tick;
  const today = new Date().toISOString().slice(0, 10);
  const all = [...scheduleStore.getAll()].sort((a, b) =>
    sessionStamp(a).localeCompare(sessionStamp(b))
  );
  const upcoming = all.filter((s) => s.date >= today);
  const sessions = (upcoming.length ? upcoming : all).slice(0, limit);
  const next = sessions[0];

  return (
    <section className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
      {next && (
        <Card className="overflow-hidden lg:col-span-4" noPadding>
          <div className="bg-gradient-to-br from-[#082878] to-[#1b7eef] px-5 py-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Next session
            </p>
            <p className="mt-3 font-display text-xl font-semibold leading-snug">{next.title}</p>
            <p className="mt-2 text-sm text-white/80">{next.course}</p>
            <p className="mt-4 text-sm font-medium">
              {next.date} · {next.time}
            </p>
            <p className="mt-1 text-xs text-white/70">{next.instructor}</p>
            <Badge className="mt-4 border-0 bg-white/15 text-white" variant="accent">
              {next.type}
            </Badge>
          </div>
        </Card>
      )}
      <Card
        className={next ? "lg:col-span-8" : "lg:col-span-12"}
        title="Upcoming sessions"
        action={
          <Link href="/portal/schedule" className="text-xs font-semibold text-accent">
            Full timetable
          </Link>
        }
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions on the timetable yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="truncate text-xs text-muted">
                    {s.course} · {s.instructor}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold tabular-nums text-foreground">
                    {s.date}
                  </p>
                  <p className="text-[11px] text-muted">{s.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function LiveInsightCharts({
  showRoles = false,
}: {
  showRoles?: boolean;
}) {
  const tick = useLiveTick();
  void tick;
  const { present, late, absent } = attendanceSummary(attendanceStore.getAll());
  const users = getAllUsers();
  const roleBars = (["super_admin", "accountant", "tutor", "student"] as const).map(
    (role, i) => ({
      name: ROLE_LABELS[role],
      value: users.filter((u) => u.role === role).length,
      color: ["#082878", "#1b7eef", "#5b8def", "#c8f24a"][i],
    })
  );
  const attendanceBars = [
    { name: "Present", value: present, color: "#082878" },
    { name: "Late", value: late, color: "#ff8c00" },
    { name: "Absent", value: absent, color: "#c45c5c" },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <ExpandableChart
        title="Attendance pulse"
        hint="Present, late, and absent marks school-wide"
        className={showRoles ? "lg:col-span-5" : "lg:col-span-6"}
        details={[
          { label: "Present", value: `${present} (${present + late + absent ? Math.round((present / (present + late + absent)) * 100) : 0}%)`, color: "#082878" },
          { label: "Late", value: `${late} (${present + late + absent ? Math.round((late / (present + late + absent)) * 100) : 0}%)`, color: "#ff8c00" },
          { label: "Absent", value: `${absent} (${present + late + absent ? Math.round((absent / (present + late + absent)) * 100) : 0}%)`, color: "#c45c5c" },
          { label: "Total marks", value: String(present + late + absent) },
        ]}
      >
        <AttendancePulseChart present={present} late={late} absent={absent} />
      </ExpandableChart>
      {showRoles ? (
        <ExpandableChart
          title="People on the portal"
          hint="Accounts by role"
          className="lg:col-span-7"
          details={roleBars.map((row) => ({
            label: row.name,
            value: `${row.value} accounts`,
            color: row.color,
          }))}
        >
          <PeoplePortalChart data={roleBars} />
        </ExpandableChart>
      ) : (
        <ExpandableChart
          title="Attendance mix"
          hint="How marks split across the school"
          className="lg:col-span-6"
          details={attendanceBars.map((row) => ({
            label: row.name,
            value: String(row.value),
            color: row.color,
          }))}
        >
          <GradientBarChart data={attendanceBars} valueLabel="Marks" />
        </ExpandableChart>
      )}
    </div>
  );
}

function SuperAdminDashboard() {
  const { user } = useAuth();
  const tick = useLiveTick();
  void tick;
  const learners = learnersStore.getAll();
  const instructors = instructorsStore.getAll();
  const projects = projectsStore.getAll();
  const notices = noticesStore.getAll();
  const users = getAllUsers();
  const featuredProjects = projects.filter((p) => p.status === "featured");
  const recentNotices = notices.slice(0, 4);
  const recentActivity = user ? collectRecentActivity(user).slice(0, 6) : [];
  const { present } = attendanceSummary(attendanceStore.getAll());
  const fees = schoolFeeTotals(learners);

  return (
    <div>
      <DashHero
        eyebrow="Administration"
        title={
          <>
            Welcome back to{" "}
            <span className="text-accent">Dreyz Interior</span>
          </>
        }
        description="Full school control — programme, people, and accounts in one place."
        actions={
          <>
            <Link
              href="/portal/activity"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-surface"
            >
              Recent activity
            </Link>
            <Link
              href="/portal/learners"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-surface"
            >
              Learners
            </Link>
            <Link
              href="/portal/accounts"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              Accounts
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="portal-fade-up portal-delay-1">
          <StatCard
            label="Active Learners"
            value={formatNumber(learners.filter((l) => l.status === "active").length)}
            hint="Currently enrolled"
            icon={GraduationCap}
            tone="accent"
          />
        </div>
        <div className="portal-fade-up portal-delay-2">
          <StatCard
            label="Instructors"
            value={String(instructors.length)}
            hint="Teaching faculty"
            icon={Users}
            tone="lime"
          />
        </div>
        <div className="portal-fade-up portal-delay-3">
          <StatCard
            label="Portal accounts"
            value={String(users.length)}
            hint="All roles"
            icon={UserRound}
          />
        </div>
        <div className="portal-fade-up portal-delay-4">
          <StatCard
            label="Present today"
            value={String(present)}
            hint="Attendance marks"
            icon={ClipboardCheck}
            tone="warm"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Fees expected</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatUGX(fees.expected)}</p>
          <p className="mt-1 text-xs text-muted">From enrolled learners</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Amount paid</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{formatUGX(fees.paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Balance due</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{formatUGX(fees.balance)}</p>
        </Card>
      </div>

      <UpcomingSessionsPanel />

      <LiveInsightCharts showRoles />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <Card title="Accounts by role">
            <ul className="space-y-2">
              {(["super_admin", "accountant", "tutor", "student"] as const).map((role) => (
                <li key={role}>
                  <ListRow>
                    <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                    <span className="rounded-lg bg-card px-2.5 py-1 text-sm font-bold tabular-nums">
                      {users.filter((u) => u.role === role).length}
                    </span>
                  </ListRow>
                </li>
              ))}
            </ul>
            <Link
              href="/portal/accounts"
              className="mt-4 inline-flex items-center text-sm font-semibold text-accent"
            >
              Manage accounts <ArrowUpRight size={14} className="ml-1" />
            </Link>
          </Card>

          <Card title="School">
            <div className="space-y-3 text-sm text-muted">
              <p className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
                  <MapPin size={14} />
                </span>
                {schoolInfo.location}
              </p>
              <p className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
                  <BookOpen size={14} />
                </span>
                {programme.courseworkUnits} units · {programme.internshipMonths}-mo internship
              </p>
              <p className="rounded-xl bg-[#082878]/5 px-3 py-2 text-xs font-medium text-foreground dark:bg-white/5">
                Now registering · {schoolInfo.intake} intake
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-8">
          <CourseMixSection subtitle="Live snapshot of how coursework units are distributed across the school." />

          <Card title="Featured projects">
            <div className="grid gap-3 sm:grid-cols-3">
              {featuredProjects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-gradient-to-br from-surface to-transparent p-4 ring-1 ring-border/70 transition hover:ring-accent/30"
                >
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-xs text-muted">{p.learnerName}</p>
                  <Badge variant="success" className="mt-3">
                    {p.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Recent activity"
            action={
              <Link href="/portal/activity" className="text-xs font-semibold text-accent">
                View all
              </Link>
            }
          >
            <ul className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted">No activity recorded yet.</p>
              ) : (
                recentActivity.map((item) => (
                  <li key={item.id}>
                    <ListRow>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <p className="truncate text-xs text-muted">{item.detail || formatActivityTime(item.at)}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted">{formatActivityTime(item.at)}</span>
                    </ListRow>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card
            title="Notices"
            action={
              <Link href="/portal/notices" className="text-xs font-semibold text-accent">
                View all
              </Link>
            }
          >
            <ul className="space-y-2">
              {recentNotices.map((n) => (
                <li key={n.id}>
                  <ListRow>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted">{n.date}</p>
                    </div>
                    <Badge variant={n.priority === "high" ? "danger" : "default"}>
                      {n.priority}
                    </Badge>
                  </ListRow>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AccountantDashboard() {
  const tick = useLiveTick();
  void tick;
  const users = getAllUsers().filter((u) => u.role === "student");
  const learners = learnersStore.getAll();
  const fees = schoolFeeTotals(learners);
  const unpaid = learners.filter((l) => feesForStudent(l.email, undefined, l.paidAmount, l.feeDue).balance > 0).length;

  return (
    <div>
      <DashHero
        eyebrow="Finance"
        title="Enrollments awaiting fees"
        description="Fees expected, collected, and still due across enrolled learners."
        actions={
          <Link
            href="/portal/accounts"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-surface"
          >
            Student accounts
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Unpaid enrollments"
          value={String(unpaid)}
          hint="Awaiting first payment"
          icon={Bell}
          tone="warm"
        />
        <StatCard
          label="Student logins"
          value={String(users.length)}
          hint="Portal accounts"
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Collected so far"
          value={formatUGX(fees.paid)}
          hint={`Expected ${formatUGX(fees.expected)} · due ${formatUGX(fees.balance)}`}
          icon={Banknote}
        />
      </div>

      <LiveInsightCharts />

      <CourseMixSection subtitle="Programme structure for enrolled learners." />

      <Card title="Fee tracks (not yet collected)">
        <div className="space-y-2">
          {feeTracks.map((t) => (
            <ListRow key={t.id}>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted">
                  {t.durationMonths} months
                  {t.includesInternship ? " · internship" : ""}
                </p>
              </div>
              <p className="text-sm font-medium text-muted">Due {formatUGX(t.total)}</p>
            </ListRow>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TutorDashboard({ name }: { name: string }) {
  const tick = useLiveTick();
  void tick;
  const learners = learnersStore.getAll();
  const schedule = scheduleStore.getAll();
  const attendance = attendanceStore.getAll();
  const assessments = assessmentsStore.getAll();
  const upcoming = schedule.slice(0, 4);
  const present = attendance.filter((a) => a.status === "present").length;

  return (
    <div>
      <DashHero
        eyebrow="Teaching"
        title={`Hello, ${name.split(" ")[0]}`}
        description="Your classes, attendance, and learner submissions — ready for studio time."
        actions={
          <Link
            href="/portal/attendance"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <ClipboardCheck size={14} />
            Mark attendance
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Learners"
          value={String(learners.length)}
          hint="Active roster"
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Sessions ahead"
          value={String(upcoming.length)}
          hint="This period"
          icon={CalendarDays}
          tone="lime"
        />
        <StatCard
          label="Present marks"
          value={String(present)}
          hint="Recent attendance"
          icon={ClipboardCheck}
        />
      </div>

      <UpcomingSessionsPanel />

      <LiveInsightCharts />

      <CourseMixSection subtitle="What learners cover across foundations, studio, and technical units." />

      <Card title="Assessments due">
          <ul className="space-y-2">
            {assessments.slice(0, 4).map((a) => (
              <li key={a.id}>
                <ListRow>
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted">{a.course}</p>
                  </div>
                  <span className="text-xs text-muted">{a.submissions} submitted</span>
                </ListRow>
              </li>
            ))}
          </ul>
          <Link
            href="/portal/assessments"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent"
          >
            View all <ArrowUpRight size={14} />
          </Link>
      </Card>
    </div>
  );
}

function StudentDashboard({
  name,
  learnerId,
  email,
}: {
  name: string;
  learnerId?: string;
  email: string;
}) {
  const tick = useLiveTick();
  void tick;
  const learners = learnersStore.getAll();
  const projects = projectsStore.getAll();
  const attendance = attendanceStore.getAll();
  const resources = resourcesStore.getAll();
  const learner =
    learners.find((l) => l.id === learnerId) ??
    learners.find((l) => l.email.toLowerCase() === email.toLowerCase());
  const myProjects = projects.filter((p) => p.learnerId === learner?.id);
  const myAttendance = awardedAttendance(
    attendance.filter((a) => a.learnerId === learner?.id),
    learner?.enrollmentDate
  );
  const breakdown = learner ? learnerProgressBreakdown(learner) : null;
  const myFees = learner
    ? feesForStudent(learner.email, undefined, learner.paidAmount, learner.feeDue)
    : null;

  return (
    <div>
      <DashHero
        eyebrow="My Learning"
        title={`Welcome, ${name.split(" ")[0]}`}
        description={`Your progress, schedule, and studio work at ${schoolInfo.name}.`}
        actions={
          <Link
            href="/portal/projects"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <FolderKanban size={14} />
            My projects
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Course progress"
          value={`${breakdown?.percent ?? 0}%`}
          hint={
            breakdown
              ? `${breakdown.classes.done}/${breakdown.classes.required} classes · ${breakdown.tests.done}/${breakdown.tests.required} tests`
              : (learner?.course ?? "Programme")
          }
          icon={GraduationCap}
          tone="accent"
        />
        <StatCard
          label="Attendance records"
          value={String(myAttendance.length)}
          hint="First 6 months from enrolment"
          icon={ClipboardCheck}
        />
        <StatCard
          label="Projects"
          value={String(myProjects.length)}
          hint="Submitted / reviewed"
          icon={FolderKanban}
          tone="lime"
        />
        <StatCard
          label="Fee status"
          value={
            !myFees || myFees.paid <= 0
              ? "Unpaid"
              : myFees.balance <= 0
                ? "Paid"
                : "Part paid"
          }
          hint={
            myFees
              ? `${formatUGX(myFees.paid)} paid · ${formatUGX(myFees.balance)} due`
              : "No payment recorded yet"
          }
          icon={Wallet}
          tone="warm"
        />
      </div>

      <UpcomingSessionsPanel />

      {breakdown && (
        <div className="mb-6 grid gap-5 lg:grid-cols-12">
          <ExpandableChart
            title="Your progress radar"
            hint="How far you are against Super Admin course targets"
            className="lg:col-span-5"
            details={[
              {
                label: "Classes",
                value: `${breakdown.classes.done}/${breakdown.classes.required} (${ratio(breakdown.classes.done, breakdown.classes.required)}%)`,
              },
              {
                label: "Tests",
                value: `${breakdown.tests.done}/${breakdown.tests.required} (${ratio(breakdown.tests.done, breakdown.tests.required)}%)`,
              },
              {
                label: "Exams",
                value: `${breakdown.exams.done}/${breakdown.exams.required} (${ratio(breakdown.exams.done, breakdown.exams.required)}%)`,
              },
              {
                label: "Final exam",
                value: `${breakdown.final.done}/${breakdown.final.required} (${ratio(breakdown.final.done, breakdown.final.required)}%)`,
              },
              { label: "Overall", value: `${breakdown.percent}%` },
            ]}
          >
            <ProgressRadarChart
              classes={ratio(breakdown.classes.done, breakdown.classes.required)}
              tests={ratio(breakdown.tests.done, breakdown.tests.required)}
              exams={ratio(breakdown.exams.done, breakdown.exams.required)}
              final={ratio(breakdown.final.done, breakdown.final.required)}
            />
          </ExpandableChart>
          <Card className="lg:col-span-7" title="How progress is calculated">
            <p className="mb-3 text-xs text-muted">
              Progress is the average of classes, tests, exams
              {breakdown.final.required ? ", and the final exam" : ""}.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["Classes attended", breakdown.classes],
                  ["Tests", breakdown.tests],
                  ["Exams", breakdown.exams],
                  ["Final exam", breakdown.final],
                ] as const
              ).map(([label, row]) =>
                row.required > 0 ? (
                  <li key={label} className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-medium">
                      {row.done}/{row.required}
                    </span>
                  </li>
                ) : null
              )}
            </ul>
          </Card>
        </div>
      )}

      <CourseMixSection subtitle="Your programme units — foundations through professional practice." />

      <Card title="Resources for you">
          <ul className="space-y-2">
            {resources.slice(0, 4).map((r) => (
              <li key={r.id}>
                <ListRow>
                  <span className="text-sm font-medium">{r.title}</span>
                  <Badge>{r.type}</Badge>
                </ListRow>
              </li>
            ))}
          </ul>
          <Link
            href="/portal/resources"
            className="mt-4 inline-flex items-center text-sm font-semibold text-accent"
          >
            Browse resources <ArrowUpRight size={14} className="ml-1" />
          </Link>
        </Card>
    </div>
  );
}

export function RoleHome() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <span className="sr-only">{roleHomeEyebrow(user.role)}</span>
      {user.role === "super_admin" && <SuperAdminDashboard />}
      {user.role === "accountant" && <AccountantDashboard />}
      {user.role === "tutor" && <TutorDashboard name={user.name} />}
      {user.role === "student" && (
        <StudentDashboard name={user.name} learnerId={user.learnerId} email={user.email} />
      )}
    </div>
  );
}
