import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  admissionRequirements,
  classOptions,
  feeTracks,
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
} from "lucide-react";
import Link from "next/link";

export default function AdmissionsPage() {
  return (
    <div>
      <PageHeader
        title="Admissions"
        description={`${schoolInfo.intakeNote} ${programme.courseworkUnits} course units plus optional ${programme.internshipMonths}-month internship. ${schoolInfo.tagline}.`}
        action={
          <Link href="/portal/payments">
            <Button size="sm">Enroll / Record payment</Button>
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold text-accent-dark">
          Now registering · {schoolInfo.intake} intake
        </p>
        <p className="mt-1 text-muted">{schoolInfo.intakeNote}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Requirements */}
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

        {/* Class options */}
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
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{opt.name}</p>
                  <Badge variant="accent">{opt.hoursPerDay}h / day</Badge>
                </div>
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

      {/* Fees */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {feeTracks.map((track) => (
          <Card
            key={track.id}
            title={track.name}
            action={<Badge variant={track.includesInternship ? "success" : "info"}>{track.durationMonths} months</Badge>}
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
          </Card>
        ))}
      </div>

      {/* Payment & graduation */}
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

      {/* Contact / location */}
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
