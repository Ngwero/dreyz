"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  changePassword,
  DEMO_PASSWORD,
  getAllUsers,
  getPayments,
  updateAccount,
} from "@/lib/auth";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrength";
import { isPasswordAcceptable } from "@/lib/password-strength";
import { ROLE_LABELS } from "@/lib/roles";
import { classOptions, enrollments, feeTracks, schoolInfo } from "@/lib/data";
import { formatUGX } from "@/lib/utils";
import { feesForStudent, computeLearnerProgress, awardedAttendance } from "@/lib/academics";
import {
  attendanceStore,
  instructorsStore,
  learnersStore,
  projectsStore,
  scheduleStore,
  useLiveTick,
} from "@/lib/store";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15";

export default function MyAccountPage() {
  const { user, refresh } = useAuth();
  const tick = useLiveTick();
  const profile = useMemo(() => {
    void tick;
    return user ? getAllUsers().find((u) => u.id === user.id) : null;
  }, [user, tick]);

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

  if (!user || !profile) return null;

  const learners = learnersStore.getAll();
  const instructors = instructorsStore.getAll();
  const learner = profile.learnerId
    ? learners.find((l) => l.id === profile.learnerId)
    : learners.find((l) => l.email.toLowerCase() === profile.email.toLowerCase());
  const instructor = profile.instructorId
    ? instructors.find((i) => i.id === profile.instructorId)
    : instructors.find((i) => i.email.toLowerCase() === profile.email.toLowerCase());
  const track = feeTracks.find((t) => t.id === profile.feeTrackId);
  const klass = classOptions.find((c) => c.id === profile.classOptionId);
  const fees = feesForStudent(
    profile.email,
    profile.feeTrackId,
    learner?.paidAmount,
    learner?.feeDue
  );
  const liveProgress = learner ? computeLearnerProgress(learner) : 0;
  const myPayments = getPayments().filter(
    (p) => p.learnerEmail.toLowerCase() === profile.email.toLowerCase()
  );
  const myAttendance = awardedAttendance(
    attendanceStore.getAll().filter((a) => a.learnerId === learner?.id),
    learner?.enrollmentDate
  );
  const myProjects = projectsStore
    .getAll()
    .filter((p) => p.learnerId === learner?.id);
  const sessions = scheduleStore.getAll();
  const allUsers = getAllUsers();
  const payments = getPayments();
  const revenue = payments
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);

  const persistProfile = (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      updateAccount(profile.id, {
        name,
        phone,
        specialty: profile.role === "tutor" ? specialty : profile.specialty,
      });
      refresh();
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save profile.");
    }
  };

  const onChangePassword = (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!isPasswordAcceptable(password)) {
      setMessage("Password is too weak. Use 6+ characters with mixed case, numbers, or symbols.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      changePassword(profile.id, password);
      setPassword("");
      setConfirm("");
      setMessage("Password updated. Use it next time you sign in.");
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update password.");
    }
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        description={`${ROLE_LABELS[profile.role]} account — update your details, security, and role tools.`}
      />

      {message && (
        <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <form onSubmit={persistProfile} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Full name
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <Row label="Email" value={profile.email} />
            <Row label="Role" value={ROLE_LABELS[profile.role]} />
            <Row
              label="Status"
              value={
                <Badge variant={profile.status === "active" ? "success" : "danger"}>
                  {profile.status}
                </Badge>
              }
            />
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Phone
              <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {profile.role === "tutor" && (
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Specialty
                <input className={fieldClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </label>
            )}
            <Row label="Member since" value={profile.createdAt} />
            {profile.lastLoginAt && (
              <Row label="Last login" value={new Date(profile.lastLoginAt).toLocaleString()} />
            )}
            <Button type="submit" size="sm">
              Save profile
            </Button>
          </form>
        </Card>

        <Card title="Change password">
          <form onSubmit={onChangePassword} className="space-y-3">
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
            <PasswordStrengthMeter
              password={password}
              confirm={confirm}
              variant="light"
            />
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
            {profile.password === DEMO_PASSWORD && (
              <p className="text-[11px] text-muted">
                Demo accounts start with password <strong>{DEMO_PASSWORD}</strong>.
              </p>
            )}
          </form>
        </Card>

        {profile.role === "student" && (
          <>
            <Card title="Programme">
              <dl className="space-y-3 text-sm">
                <Row label="Course" value={learner?.course ?? track?.name ?? "Professional Interior Design Programme"} />
                <Row label="Progress" value={`${liveProgress}%`} />
                <Row
                  label="Class"
                  value={
                    klass
                      ? `${klass.name} · ${klass.days} · ${klass.time}`
                      : "Assigned at admissions"
                  }
                />
                <Row label="Fees" value={formatUGX(fees.total)} />
                <Row label="Paid" value={formatUGX(fees.paid)} />
                <Row label="Balance" value={formatUGX(fees.balance)} />
                <Row
                  label="Learner access"
                  value={fees.isLearner ? "Active (threshold met)" : "Pending — pay UGX 1,000,000 to activate"}
                />
                <Row label="Attendance marks" value={String(myAttendance.length)} />
                <Row label="Projects submitted" value={String(myProjects.length)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/portal/enrollments">
                  <Button size="sm" variant="outline">Fees &amp; billing</Button>
                </Link>
                <Link href="/portal/projects">
                  <Button size="sm" variant="outline">My projects</Button>
                </Link>
              </div>
            </Card>
            <Card title="My payments">
              {myPayments.length === 0 ? (
                <p className="text-sm text-muted">
                  No payments linked to this email yet. Contact {schoolInfo.email} if you recently paid.
                </p>
              ) : (
                <ul className="space-y-2">
                  {myPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{formatUGX(p.amount)}</p>
                        <p className="text-xs text-muted">
                          {p.date} · {p.method.replace("_", " ")}
                        </p>
                      </div>
                      <Badge variant="success">Paid</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        {profile.role === "tutor" && (
          <>
            <Card title="Teaching">
              <dl className="space-y-3 text-sm">
                <Row label="Specialty" value={instructor?.specialty ?? (specialty || "Interior Design")} />
                <Row label="Assigned courses" value={String(instructor?.courses ?? 0)} />
                <Row label="Rating" value={instructor ? `${instructor.rating} / 5` : "—"} />
                <Row label="Sessions listed" value={String(sessions.length)} />
                <Row label="Learners on roster" value={String(learners.length)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/portal/attendance">
                  <Button size="sm">Mark attendance</Button>
                </Link>
                <Link href="/portal/assessments">
                  <Button size="sm" variant="outline">Assessments</Button>
                </Link>
                <Link href="/portal/schedule">
                  <Button size="sm" variant="outline">Schedule</Button>
                </Link>
              </div>
            </Card>
            <Card title="Upcoming sessions">
              <ul className="space-y-2">
                {sessions.slice(0, 4).map((s) => (
                  <li key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted">{s.date} · {s.time} · {s.course}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {profile.role === "accountant" && (
          <>
            <Card title="Finance snapshot">
              <dl className="space-y-3 text-sm">
                <Row label="Confirmed revenue" value={formatUGX(revenue)} />
                <Row label="Payments recorded" value={String(payments.length)} />
                <Row
                  label="Pending enrollments"
                  value={String(enrollments.filter((e) => e.status === "pending").length)}
                />
                <Row
                  label="Student accounts"
                  value={String(allUsers.filter((u) => u.role === "student").length)}
                />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/portal/payments">
                  <Button size="sm">Record payment</Button>
                </Link>
                <Link href="/portal/accounts">
                  <Button size="sm" variant="outline">Student accounts</Button>
                </Link>
              </div>
            </Card>
            <Card title="Your tools">
              <p className="text-sm text-muted">
                Confirm fees under Payments — each confirmed payment creates the student login and emails credentials. Manage student portal accounts from Accounts.
              </p>
            </Card>
          </>
        )}

        {profile.role === "super_admin" && (
          <>
            <Card title="School control">
              <dl className="space-y-3 text-sm">
                <Row label="Portal accounts" value={String(allUsers.length)} />
                <Row label="Students" value={String(allUsers.filter((u) => u.role === "student").length)} />
                <Row label="Tutors" value={String(allUsers.filter((u) => u.role === "tutor").length)} />
                <Row label="Accountants" value={String(allUsers.filter((u) => u.role === "accountant").length)} />
                <Row label="Learners on roster" value={String(learners.length)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/portal/accounts">
                  <Button size="sm">Manage accounts</Button>
                </Link>
                <Link href="/portal/settings">
                  <Button size="sm" variant="outline">Settings</Button>
                </Link>
              </div>
            </Card>
            <Card title="Admin tools">
              <p className="text-sm text-muted">
                Create Super Admin, Accountant, Tutor, and Student logins from Accounts. Confirmed payments also provision student access automatically.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
