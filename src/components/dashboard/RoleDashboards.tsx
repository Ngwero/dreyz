"use client";

import Link from "next/link";
import { Download, ArrowUpRight, BookOpen, MapPin, Wallet, ClipboardCheck } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/PageElements";
import { formatNumber, formatUGX } from "@/lib/utils";
import {
  scheduleDownloads,
  courseStats,
  performanceByLevel,
  schoolInfo,
  programme,
  enrollments,
  feeTracks,
} from "@/lib/data";
import { CourseDonutChart } from "@/components/dashboard/CourseDonutChart";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useAuth } from "@/components/auth/AuthProvider";
import { getPayments, getAllUsers } from "@/lib/auth";
import { ROLE_LABELS, roleHomeEyebrow } from "@/lib/roles";
import {
  assessmentsStore,
  attendanceStore,
  instructorsStore,
  learnersStore,
  noticesStore,
  projectsStore,
  resourcesStore,
  scheduleStore,
  useLiveTick,
} from "@/lib/store";

function SuperAdminDashboard() {
  const tick = useLiveTick();
  void tick;
  const learners = learnersStore.getAll();
  const instructors = instructorsStore.getAll();
  const projects = projectsStore.getAll();
  const notices = noticesStore.getAll();
  const users = getAllUsers();
  const featuredProjects = projects.filter((p) => p.status === "featured");
  const recentNotices = notices.slice(0, 4);
  const payments = getPayments();
  const revenue = payments
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Administration
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            Welcome back to{" "}
            <span className="text-accent">Dreyz Interior</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Full school control — programme, people, payments, and accounts.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/payments">
            <Button size="sm" variant="outline">
              Payments
            </Button>
          </Link>
          <Link href="/portal/accounts">
            <Button size="sm">Accounts</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Active Learners"
          value={formatNumber(learners.filter((l) => l.status === "active").length)}
          hint="Currently enrolled"
        />
        <StatCard
          label="Instructors"
          value={String(instructors.length)}
          hint="Teaching faculty"
        />
        <StatCard
          label="Portal accounts"
          value={String(users.length)}
          hint="All roles"
        />
        <StatCard
          label="Confirmed fees"
          value={formatUGX(revenue)}
          hint={`${payments.length} payments`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <Card title="Accounts by role">
            <ul className="space-y-2.5">
              {(["super_admin", "accountant", "tutor", "student"] as const).map((role) => (
                <li
                  key={role}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
                >
                  <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                  <span className="text-sm font-bold">
                    {users.filter((u) => u.role === role).length}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/portal/accounts" className="mt-3 inline-flex text-sm font-medium text-accent">
              Manage accounts <ArrowUpRight size={14} className="ml-1" />
            </Link>
          </Card>

          <Card title="Class Schedules">
            <div className="space-y-2.5">
              {scheduleDownloads.map((item) => (
                <div
                  key={item.month}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.month}</p>
                    <p className="text-xs text-muted">{item.sessions} sessions</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download size={13} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="School">
            <div className="space-y-2 text-sm text-muted">
              <p className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                {schoolInfo.location}
              </p>
              <p className="flex items-start gap-2">
                <BookOpen size={14} className="mt-0.5 shrink-0" />
                {programme.courseworkUnits} units · {programme.internshipMonths}-mo internship
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card title="Course mix">
              <CourseDonutChart data={courseStats} total={programme.courseworkUnits} />
            </Card>
            <Card title="Performance">
              <PerformanceChart data={performanceByLevel} />
            </Card>
          </div>

          <Card title="Featured projects">
            <div className="grid gap-3 sm:grid-cols-3">
              {featuredProjects.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-xs text-muted">{p.learnerName}</p>
                  <Badge variant="success" className="mt-2">
                    {p.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Notices">
            <ul className="space-y-3">
              {recentNotices.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted">{n.date}</p>
                  </div>
                  <Badge variant={n.priority === "high" ? "danger" : "default"}>
                    {n.priority}
                  </Badge>
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
  const payments = getPayments();
  const users = getAllUsers().filter((u) => u.role === "student");
  const confirmed = payments.filter((p) => p.status === "confirmed");
  const revenue =
    confirmed.reduce((s, p) => s + p.amount, 0) ||
    enrollments.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const pending = enrollments.filter((e) => e.status === "pending").length;

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Finance
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            Fees, payments &amp; enrollments
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Confirm payments and student logins are emailed automatically when payment clears.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/portal/accounts">
            <Button size="sm" variant="outline">Student accounts</Button>
          </Link>
          <Link href="/portal/payments">
            <Button size="sm">
              <Wallet size={14} />
              Record payment
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Confirmed revenue" value={formatUGX(revenue)} hint="Paid fees" />
        <StatCard label="Pending invoices" value={String(pending)} hint="Awaiting payment" />
        <StatCard
          label="Credentials emailed"
          value={String(confirmed.filter((p) => p.credentialsSent).length)}
          hint="Student accounts provisioned"
        />
        <StatCard label="Student logins" value={String(users.length)} hint="Portal accounts" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Fee tracks">
          <div className="space-y-3">
            {feeTracks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted">
                    {t.durationMonths} months
                    {t.includesInternship ? " · internship" : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-accent">{formatUGX(t.total)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent payments">
          {payments.length === 0 ? (
            <p className="text-sm text-muted">
              No payments recorded yet.{" "}
              <Link href="/portal/payments" className="font-medium text-accent">
                Record the first payment
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {payments.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{p.learnerName}</p>
                    <p className="text-xs text-muted">
                      {p.date} · {p.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatUGX(p.amount)}</p>
                    <Badge variant={p.credentialsSent ? "success" : "warning"}>
                      {p.credentialsSent ? "Login emailed" : "Pending email"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
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
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Teaching
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            Hello, {name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Your classes, attendance, and learner submissions.
          </p>
        </div>
        <Link href="/portal/attendance">
          <Button size="sm">
            <ClipboardCheck size={14} />
            Mark attendance
          </Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Learners" value={String(learners.length)} hint="Active roster" />
        <StatCard label="Sessions ahead" value={String(upcoming.length)} hint="This period" />
        <StatCard label="Present marks" value={String(present)} hint="Recent attendance" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Upcoming sessions">
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.date} · {s.time}
                  </p>
                </div>
                <Badge variant="accent">{s.type}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Assessments due">
          <ul className="space-y-3">
            {assessments.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted">{a.course}</p>
                </div>
                <span className="text-xs text-muted">{a.submissions} submitted</span>
              </li>
            ))}
          </ul>
          <Link
            href="/portal/assessments"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent"
          >
            View all <ArrowUpRight size={14} />
          </Link>
        </Card>
      </div>
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
  const schedule = scheduleStore.getAll();
  const resources = resourcesStore.getAll();
  const learner =
    learners.find((l) => l.id === learnerId) ??
    learners.find((l) => l.email.toLowerCase() === email.toLowerCase());
  const myProjects = projects.filter((p) => p.learnerId === learner?.id);
  const myAttendance = attendance.filter((a) => a.learnerId === learner?.id);
  const myPayments = getPayments().filter(
    (p) => p.learnerEmail.toLowerCase() === email.toLowerCase()
  );

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            My Learning
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            Welcome, {name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Your progress, schedule, and studio work at {schoolInfo.name}.
          </p>
        </div>
        <Link href="/portal/projects">
          <Button size="sm">My projects</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Course progress"
          value={`${learner?.progress ?? 0}%`}
          hint={learner?.course ?? "Programme"}
        />
        <StatCard
          label="Attendance records"
          value={String(myAttendance.length)}
          hint="Your marks"
        />
        <StatCard
          label="Projects"
          value={String(myProjects.length)}
          hint="Submitted / reviewed"
        />
        <StatCard
          label="Payments"
          value={String(myPayments.length)}
          hint="Linked to your email"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Next classes">
          <ul className="space-y-3">
            {schedule.slice(0, 3).map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-surface px-3.5 py-3">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted">
                  {s.date} · {s.time} · {s.instructor}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/portal/schedule" className="mt-3 inline-flex text-sm font-medium text-accent">
            Full schedule <ArrowUpRight size={14} className="ml-1" />
          </Link>
        </Card>
        <Card title="Resources for you">
          <ul className="space-y-3">
            {resources.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{r.title}</span>
                <Badge>{r.type}</Badge>
              </li>
            ))}
          </ul>
          <Link href="/portal/resources" className="mt-3 inline-flex text-sm font-medium text-accent">
            Browse resources <ArrowUpRight size={14} className="ml-1" />
          </Link>
        </Card>
      </div>
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
