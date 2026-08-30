"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PortalUser, UserRole } from "@/lib/types";
import {
  changePassword,
  changePasswordByEmail,
  DEMO_PASSWORD,
  getAllUsers,
  getPayments,
  resolveSessionProfile,
  updateAccount,
  upsertUser,
} from "@/lib/auth";
import { supabaseUpdatePassword, type ProfileRow, profileToPortalUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrength";
import { isPasswordAcceptable } from "@/lib/password-strength";
import { ROLE_LABELS, canAccessRoute } from "@/lib/roles";
import { classOptions, feeTracks, programme, schoolInfo } from "@/lib/data";
import { resolveLearnerIntake } from "@/lib/intakes";
import { formatUGX } from "@/lib/utils";
import {
  attendanceSummary,
  awardedAttendance,
  computeLearnerProgress,
  feesForStudent,
  schoolFeeTotals,
} from "@/lib/academics";
import { showFlash } from "@/lib/flash";
import { LottiePanel } from "@/components/ui/LottieLoader";
import { collectRecentActivity, formatActivityTime } from "@/lib/activity";
import {
  attendanceStore,
  instructorsStore,
  learnersStore,
  noticesStore,
  projectsStore,
  scheduleStore,
  useLiveTick,
} from "@/lib/store";
import {
  ClipboardCheck,
  FolderKanban,
  TrendingUp,
  Wallet,
} from "lucide-react";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15";

const PROFILE_LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/activity", label: "Recent activity" },
  { href: "/portal/notices", label: "Notices" },
  { href: "/portal/schedule", label: "Schedule" },
  { href: "/portal/attendance", label: "Attendance" },
  { href: "/portal/assessments", label: "Assessments" },
  { href: "/portal/projects", label: "Projects" },
  { href: "/portal/resources", label: "Resources" },
  { href: "/portal/enrollments", label: "Fees & billing" },
  { href: "/portal/learners", label: "Learners" },
  { href: "/portal/accounts", label: "Accounts" },
  { href: "/portal/settings", label: "Settings" },
];

export default function MyAccountPage() {
  const { user, refresh, usingSupabase } = useAuth();
  const tick = useLiveTick();
  const [remote, setRemote] = useState<PortalUser | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        if (data) setRemote(profileToPortalUser(data as ProfileRow));
      } catch {
        setRemote(null);
      }
    })();
  }, [user]);

  const profile = useMemo(() => {
    void tick;
    if (!user) return null;
    const local = resolveSessionProfile(user);
    if (!remote) return local;
    return {
      ...local,
      ...remote,
      id: user.id,
      email: user.email,
      role: user.role,
      name: remote.name || local.name,
      learnerId: user.learnerId ?? remote.learnerId ?? local.learnerId,
      instructorId: user.instructorId ?? remote.instructorId ?? local.instructorId,
    };
  }, [user, tick, remote]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setSpecialty(profile.specialty ?? "");
  }, [profile]);

  if (!user || !profile) {
    return (
      <div>
        <PageHeader title="My profile" description="Your portal account." />
        {user ? (
          <LottiePanel label="Loading your profile…" />
        ) : (
          <p className="text-sm text-muted">Sign in to view your profile.</p>
        )}
      </div>
    );
  }

  const learners = learnersStore.getAll();
  const instructors = instructorsStore.getAll();
  const notices = noticesStore.getAll();
  const sessions = scheduleStore.getAll();
  const allUsers = getAllUsers();
  const payments = getPayments();
  const projects = projectsStore.getAll();
  const attendance = attendanceStore.getAll();

  const learner = profile.learnerId
    ? learners.find((l) => l.id === profile.learnerId)
    : learners.find((l) => l.email.toLowerCase() === profile.email.toLowerCase());
  const instructor = profile.instructorId
    ? instructors.find((i) => i.id === profile.instructorId)
    : instructors.find((i) => i.email.toLowerCase() === profile.email.toLowerCase());
  const track = feeTracks.find((t) => t.id === profile.feeTrackId);
  const klass = classOptions.find((c) => c.id === profile.classOptionId);
  const personalFees = feesForStudent(
    profile.email,
    profile.feeTrackId,
    learner?.paidAmount,
    learner?.feeDue
  );
  const schoolFees = schoolFeeTotals(learners);
  const feeDue = learner ? personalFees.total : schoolFees.expected;
  const feePaid = learner ? personalFees.paid : schoolFees.paid;
  const feeBalance = learner ? personalFees.balance : schoolFees.balance;
  const liveProgress = learner ? computeLearnerProgress(learner) : 0;
  const myPayments = payments.filter(
    (p) => p.learnerEmail.toLowerCase() === profile.email.toLowerCase()
  );
  const myAttendance = awardedAttendance(
    attendance.filter((a) => a.learnerId === learner?.id),
    learner?.enrollmentDate
  );
  const myProjects = projects.filter((p) => p.learnerId === learner?.id);
  const { present } = attendanceSummary(attendance);
  const upcoming = [...sessions].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const activity = collectRecentActivity(user).slice(0, 8);
  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const roleLabel = ROLE_LABELS[profile.role as UserRole] ?? String(profile.role);
  const programmeName =
    learner?.course || track?.name || programme.name || "Professional Interior Design Programme";
  const classLabel = klass
    ? `${klass.name} · ${klass.days} · ${klass.time}`
    : learner
      ? "Assigned at admissions"
      : "Staff — school timetable";
  const progressLabel = learner ? `${liveProgress}%` : "Staff account";
  const links = PROFILE_LINKS.filter((item) => canAccessRoute(profile.role as UserRole, item.href));

  const persistProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      upsertUser({
        ...profile,
        name: name.trim() || profile.name,
        phone: phone.trim() || undefined,
        specialty: specialty.trim() || undefined,
      });
      try {
        updateAccount(profile.id, {
          name,
          phone,
          specialty,
        });
      } catch {
        /* live accounts may not exist in the local roster yet */
      }
      // Always push profile edits to the live school database when possible.
      try {
        const res = await fetch("/api/accounts/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: profile.id,
            name,
            phone,
            specialty,
          }),
        });
        if (usingSupabase && !res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Could not save profile to the live school.");
        }
      } catch (err) {
        if (usingSupabase) throw err;
      }
      await refresh();
      setMessage("Profile saved.");
      showFlash("success", "Profile saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save profile.";
      setMessage(msg);
      showFlash("error", msg);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    const nextPassword = password.trim();
    const nextConfirm = confirm.trim();
    if (!isPasswordAcceptable(nextPassword)) {
      const msg = "Password is too weak. Use 6+ characters with mixed case, numbers, or symbols.";
      setMessage(msg);
      showFlash("error", msg);
      return;
    }
    if (nextPassword !== nextConfirm) {
      setMessage("Passwords do not match.");
      showFlash("error", "Passwords do not match.");
      return;
    }
    try {
      // Always update live auth. Local-only saves look successful, then fail at login.
      const remotePw = await supabaseUpdatePassword(nextPassword);
      if (!remotePw.ok) {
        setMessage(remotePw.error);
        showFlash("error", remotePw.error);
        return;
      }
      try {
        changePassword(profile.id, nextPassword);
      } catch {
        changePasswordByEmail(profile.email, nextPassword);
        upsertUser({ ...profile, password: nextPassword });
      }
      setPassword("");
      setConfirm("");
      setMessage("Password updated. Use it next time you sign in.");
      showFlash("success", "Password updated. Use it next time you sign in.");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update password.";
      setMessage(msg);
      showFlash("error", msg);
    }
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        description="The same profile for every portal account — your details, programme, fees, attendance, and activity."
      />

      {message && (
        <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">
          {message}
        </p>
      )}

      <div className="portal-hero mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-white">
          {initials || "D"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-foreground">{profile.name}</h2>
            <Badge variant="accent">{roleLabel}</Badge>
            <Badge variant={profile.status === "active" ? "success" : "danger"}>{profile.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{profile.email}</p>
          <p className="mt-1 text-xs text-muted">
            {schoolInfo.name} · {usingSupabase ? "Live login" : "This device"} · Last login{" "}
            {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "this session"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Progress" value={learner ? `${liveProgress}%` : "—"} hint="Course completion" icon={TrendingUp} tone="accent" />
        <StatCard label="Paid" value={formatUGX(feePaid)} hint={learner ? "Your fees" : "School collected"} icon={Wallet} tone="lime" />
        <StatCard
          label="Attendance"
          value={String(learner ? myAttendance.length : present)}
          hint={learner ? "Your awarded marks" : "Present marks in school"}
          icon={ClipboardCheck}
          tone="warm"
        />
        <StatCard
          label="Projects"
          value={String(learner ? myProjects.length : projects.length)}
          hint={learner ? "Your submissions" : "School portfolio"}
          icon={FolderKanban}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal details">
          <form onSubmit={(e) => void persistProfile(e)} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Full name
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Phone
              <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256…" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Specialty / focus
              <input
                className={fieldClass}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Residential design"
              />
            </label>
            <Button type="submit" size="sm">
              Save profile
            </Button>
          </form>
        </Card>

        <Card title="Security">
          <form onSubmit={(e) => void onChangePassword(e)} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <PasswordStrengthMeter password={password} confirm={confirm} variant="light" />
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={fieldClass}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <Button type="submit" size="sm">
              Save password
            </Button>
            <p className="text-[11px] text-muted">
              This updates the password you use to sign in on dreyzschool.com. If save fails, sign
              out, use Forgot password on the login page, then sign in again.
            </p>
            {profile.password === DEMO_PASSWORD && (
              <p className="text-[11px] text-muted">
                Demo accounts start with password <strong>{DEMO_PASSWORD}</strong>.
              </p>
            )}
          </form>
        </Card>

        <Card title="Account record">
          <dl className="space-y-3 text-sm">
            <Row label="Account ID" value={profile.id} />
            <Row label="Email" value={profile.email} />
            <Row label="Role" value={roleLabel} />
            <Row label="Status" value={profile.status} />
            <Row label="Phone" value={profile.phone || phone || "Not set"} />
            <Row label="Specialty" value={specialty || instructor?.specialty || "Not set"} />
            <Row label="Admission number" value={profile.learnerId || learner?.id || "—"} />
            <Row
              label="Intake"
              value={learner ? resolveLearnerIntake(learner) : schoolInfo.intake}
            />
            <Row label="Tutor ID" value={profile.instructorId || instructor?.id || "—"} />
            <Row label="Member since" value={profile.createdAt || "—"} />
            <Row
              label="Last login"
              value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "This session"}
            />
          </dl>
        </Card>

        <Card title="Programme & class">
          <dl className="space-y-3 text-sm">
            <Row label="Programme" value={programmeName} />
            <Row label="Class" value={classLabel} />
            <Row label="Progress" value={progressLabel} />
            <Row label="Fee track" value={track?.name ?? (learner ? "Standard programme" : "Staff")} />
            <Row label="Campus" value={`${schoolInfo.location} · ${schoolInfo.intake}`} />
            <Row label="School contact" value={schoolInfo.email} />
          </dl>
        </Card>

        <Card title="Fees">
          <dl className="space-y-3 text-sm">
            <Row label="Fee due" value={formatUGX(feeDue)} />
            <Row label="Amount paid" value={formatUGX(feePaid)} />
            <Row label="Balance" value={formatUGX(feeBalance)} />
            <Row
              label="Access"
              value={
                learner
                  ? personalFees.isLearner
                    ? "Active (threshold met)"
                    : "Pending — UGX 1,000,000 to activate"
                  : "Staff portal access"
              }
            />
            <Row label="Payments on file" value={String(learner ? myPayments.length : payments.length)} />
          </dl>
          <p className="mt-3 text-xs text-muted">
            {learner ? "These are your personal fee totals." : "These are school-wide fee totals for staff accounts."}
          </p>
        </Card>

        <Card title="Attendance & studio">
          <dl className="space-y-3 text-sm">
            <Row label="Attendance marks" value={String(learner ? myAttendance.length : attendance.length)} />
            <Row label="Present in school today" value={String(present)} />
            <Row label="Projects" value={String(learner ? myProjects.length : projects.length)} />
            <Row label="Notices" value={String(notices.length)} />
            <Row label="Upcoming sessions" value={String(sessions.length)} />
            <Row label="Portal accounts" value={String(allUsers.length)} />
          </dl>
        </Card>

        <Card
          title="Payments"
          action={
            <Link href="/portal/enrollments" className="text-xs font-semibold text-accent">
              Billing
            </Link>
          }
        >
          {(learner ? myPayments : payments.slice(0, 6)).length === 0 ? (
            <p className="text-sm text-muted">
              No payments on file yet. Contact {schoolInfo.email} if a payment is missing.
            </p>
          ) : (
            <ul className="space-y-2">
              {(learner ? myPayments : payments.slice(0, 6)).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{formatUGX(p.amount)}</p>
                    <p className="text-xs text-muted">
                      {p.learnerName} · {p.date} · {p.method.replace("_", " ")}
                    </p>
                  </div>
                  <Badge variant={p.status === "confirmed" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Upcoming sessions"
          action={
            <Link href="/portal/schedule" className="text-xs font-semibold text-accent">
              Schedule
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No sessions on the timetable yet.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.date} · {s.time} · {s.course} · {s.instructor}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {profile.role === "super_admin" && (
        <Card
          title="Recent activity"
          action={
            <Link href="/portal/activity" className="text-xs font-semibold text-accent">
              View all
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="text-sm text-muted">No recent activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li key={item.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted">
                    {item.detail || formatActivityTime(item.at)} · {formatActivityTime(item.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        <Card title="Shortcuts">
          <div className="flex flex-wrap gap-2">
            {links.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button size="sm" variant="outline">
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
