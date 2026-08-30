import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  admissionRequirements,
  classOptions,
  feeTracks,
  publicFeeTracks,
  schoolInfo,
  programme,
} from "@/lib/data";
import { formatUGX } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  Globe,
  GraduationCap,
  CreditCard,
  Building2,
  UserPlus,
  Smartphone,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { INTAKE_OPTIONS, currentOpenIntake } from "@/lib/intakes";

export default function AdmissionsPage() {
  const openIntake = currentOpenIntake();

  return (
    <div>
      <PageHeader
        title="Admissions"
        description={`${schoolInfo.intakeNote} ${programme.courseworkUnits} course units plus optional ${programme.internshipMonths}-month internship. One learner record (DRY###) is shared across Admissions, Learners, and Billing — payments update the same balances everywhere.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/payments">
              <Button size="sm">
                <Smartphone size={14} /> RukaPay / Record payment
              </Button>
            </Link>
            <Link href="/portal/enrollments">
              <Button size="sm" variant="outline">
                <ClipboardList size={14} /> Billing
              </Button>
            </Link>
            <Link href="/portal/learners?add=1">
              <Button size="sm" variant="outline">
                <UserPlus size={14} /> Add learner
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-foreground lg:col-span-2">
          <p className="font-semibold text-accent-dark">
            Now registering · {schoolInfo.intake} intake
          </p>
          <p className="mt-1 text-muted">{schoolInfo.intakeNote}</p>
          <p className="mt-3 text-xs text-muted">
            New students default to <span className="font-medium text-foreground">{openIntake}</span>.
            Pick a different intake when adding a learner so May, September, and January cohorts stay separate for attendance and marks.
          </p>
        </div>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Admission numbers
          </p>
          <p className="mt-2 text-sm text-foreground">
            Each student gets one ID like <span className="font-mono font-semibold">DRY009</span> —
            the same number on their portal account, learner roster, and billing.
          </p>
        </Card>
      </div>

      <div className="mb-6">
        <Card title="Enrol a student">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/portal/payments"
              className="rounded-xl border border-border bg-surface/50 p-4 transition hover:border-accent/40"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone size={16} className="text-accent" /> RukaPay
              </p>
              <p className="mt-1 text-xs text-muted">
                Mobile money payment that creates the portal login and learner record together.
              </p>
            </Link>
            <Link
              href="/portal/enrollments"
              className="rounded-xl border border-border bg-surface/50 p-4 transition hover:border-accent/40"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList size={16} className="text-accent" /> Billing
              </p>
              <p className="mt-1 text-xs text-muted">
                Cash or bank — updates the same learner fees shown on Learners and Payments.
              </p>
            </Link>
            <Link
              href="/portal/learners?add=1"
              className="rounded-xl border border-border bg-surface/50 p-4 transition hover:border-accent/40"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserPlus size={16} className="text-accent" /> Add learner
              </p>
              <p className="mt-1 text-xs text-muted">
                Create the roster entry with intake + admission number; optionally email a login.
              </p>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <Card title="Intakes">
          <div className="flex flex-wrap gap-2">
            {INTAKE_OPTIONS.map((opt) => (
              <span
                key={opt.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  opt.status === "open"
                    ? "bg-[#082878] text-white"
                    : "bg-surface text-muted"
                }`}
              >
                {opt.label}
                {opt.status === "open" ? " · open" : ""}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Filter Attendance, Assessments, and Portfolio by intake so each cohort is marked on its own.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Admission Requirements">
          <ul className="space-y-3">
            {admissionRequirements.map((req) => (
              <li key={req} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Class Options">
          <p className="mb-4 text-sm text-muted">
            Choose one. {schoolInfo.format}
          </p>
          <div className="space-y-3">
            {classOptions.map((opt) => (
              <div
                key={opt.id}
                className="rounded-xl border border-border bg-surface/50 p-4"
              >
                <p className="font-semibold text-foreground">{opt.name}</p>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  <p className="flex items-center gap-2">
                    <CalendarDays size={14} /> {opt.days}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={14} /> {opt.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {publicFeeTracks.map((track) => (
          <Card
            key={track.id}
            title={track.name}
            action={
              <Badge variant={track.includesInternship ? "success" : "info"}>
                {track.durationMonths} months
              </Badge>
            }
          >
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{formatUGX(track.total)}</span>
              <span className="text-xs text-muted">total</span>
            </div>
            <div className="divide-y divide-border rounded-xl border border-border">
              {track.breakdown.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="text-muted">{item.label}</span>
                  <span className="font-medium text-foreground">{formatUGX(item.amount)}</span>
                </div>
              ))}
            </div>
            {track.includesInternship && (
              <p className="mt-3 text-xs text-muted">
                Includes PPE and the 2-month internship on top of the main course.
              </p>
            )}
            <div className="mt-4">
              <Link href={`/portal/payments?track=${track.id}`}>
                <Button size="sm" variant="outline">
                  Enrol on this track
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-dark">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment Plans</p>
              <p className="text-xs text-muted">{schoolInfo.installments}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-dark">
              <GraduationCap size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Certification</p>
              <p className="text-xs text-muted">{schoolInfo.certificate}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-dark">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Class Format</p>
              <p className="text-xs text-muted">{schoolInfo.format}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Location & Contact">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="flex items-start gap-3 text-sm text-foreground">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
              {schoolInfo.location}
            </p>
            <div className="space-y-2">
              <p className="flex items-center gap-3 text-sm text-foreground">
                <Phone size={18} className="shrink-0 text-accent" />
                {schoolInfo.phones.join("  /  ")}
              </p>
              <p className="flex items-center gap-3 text-sm text-foreground">
                <Mail size={18} className="shrink-0 text-accent" />
                {schoolInfo.email}
              </p>
              <p className="flex items-center gap-3 text-sm text-foreground">
                <Globe size={18} className="shrink-0 text-accent" />
                {schoolInfo.website}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
