"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Button, DataTable, TableRow, TableCell } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  admissionRequirements,
  classOptions,
  programme,
  schoolInfo,
} from "@/lib/data";
import { getFeeTracks, publicFeeTracksLive } from "@/lib/fee-catalog";
import { formatUGX } from "@/lib/utils";
import {
  applicationsStore,
  learnersStore,
  useStoreList,
} from "@/lib/store";
import type { AdmissionApplication, Learner } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";
import { resolveStudentAdmissionId } from "@/lib/learner-identity";
import { currentOpenIntake } from "@/lib/intakes";
import Link from "next/link";
import { ClipboardList, ExternalLink, UserPlus } from "lucide-react";

export default function AdmissionsPage() {
  const { user } = useAuth();
  const [apps, refreshApps] = useStoreList(
    applicationsStore.getAll,
    applicationsStore.key
  );
  const [, refreshLearners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const tracks = getFeeTracks();
  const publicTracks = publicFeeTracksLive();

  useEffect(() => {
    void fetch("/api/admissions/apply")
      .then((r) => r.json())
      .then((json: { ok?: boolean; applications?: AdmissionApplication[] }) => {
        if (!json.ok || !json.applications?.length) return;
        for (const app of json.applications) applicationsStore.upsert(app);
        refreshApps();
      })
      .catch(() => undefined);
  }, [refreshApps]);

  const rows = useMemo(() => {
    const list = [...apps].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === "pending") return list.filter((a) => a.status === "pending");
    return list;
  }, [apps, filter]);

  const canReview =
    user?.role === "super_admin" || user?.role === "accountant";

  const setStatus = async (app: AdmissionApplication, status: "accepted" | "rejected") => {
    if (!canReview) return;
    applicationsStore.upsert({
      ...app,
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.email,
    });
    await fetch("/api/admissions/apply", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: app.id, status }),
    }).catch(() => undefined);

    if (status === "accepted") {
      const existing = learnersStore
        .getAll()
        .find((l) => l.email.toLowerCase() === app.email.toLowerCase());
      if (!existing) {
        const track = tracks.find((t) => t.id === app.feeTrackId);
        const learner: Learner = {
          id: resolveStudentAdmissionId({ email: app.email }),
          name: app.name,
          email: app.email,
          phone: app.phone,
          course: track?.name ?? "Professional Interior Design Programme",
          enrollmentDate: new Date().toISOString().slice(0, 10),
          intake: app.intake || currentOpenIntake(),
          progress: 0,
          status: "paused",
          feeTrackId: app.feeTrackId,
          feeDue: track?.total,
          paidAmount: 0,
        };
        learnersStore.upsert(learner);
        refreshLearners();
      }
    }
    refreshApps();
    showFlash(
      "success",
      status === "accepted"
        ? `${app.name} accepted — added to learners (paused until fees confirmed).`
        : `${app.name} application rejected.`
    );
  };

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Review applications from the public apply form, then add accepted students to the roster. Fees are confirmed separately in Payments."
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/apply" target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink size={14} /> Public apply form
              </Button>
            </a>
            <Link href="/portal/learners?add=1">
              <Button size="sm" variant="outline">
                <UserPlus size={14} /> Add learner
              </Button>
            </Link>
            <Link href="/portal/payments">
              <Button size="sm">
                <ClipboardList size={14} /> Record payment
              </Button>
            </Link>
          </div>
        }
      />

      <Card
        className="mb-8"
        title="Application queue"
        action={
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className={filter === "pending" ? "font-semibold text-accent" : "text-muted"}
              onClick={() => setFilter("pending")}
            >
              Pending
            </button>
            <button
              type="button"
              className={filter === "all" ? "font-semibold text-accent" : "text-muted"}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
        }
      >
        <DataTable
          columns={[
            { key: "name", label: "Applicant" },
            { key: "programme", label: "Programme" },
            { key: "intake", label: "Intake" },
            { key: "status", label: "Status" },
            ...(canReview ? [{ key: "actions", label: "" }] : []),
          ]}
        >
          {rows.map((app) => {
            const track = tracks.find((t) => t.id === app.feeTrackId);
            return (
              <TableRow key={app.id}>
                <TableCell>
                  <p className="font-medium">{app.name}</p>
                  <p className="text-xs text-muted">
                    {app.email} · {app.phone}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{track?.name ?? app.feeTrackId}</TableCell>
                <TableCell className="text-sm text-muted">{app.intake}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      app.status === "accepted"
                        ? "success"
                        : app.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {app.status}
                  </Badge>
                </TableCell>
                {canReview && (
                  <TableCell>
                    {app.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => void setStatus(app, "accepted")}>
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(app, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </DataTable>
        {rows.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            No applications yet. Share{" "}
            <a className="font-medium text-accent underline" href="/apply">
              /apply
            </a>{" "}
            with prospects.
          </p>
        )}
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Fee programmes">
          <ul className="space-y-2 text-sm">
            {publicTracks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span>{t.name}</span>
                <span className="font-medium">{formatUGX(t.total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Edit totals in Settings → Fee catalogue (Super Admin).
          </p>
        </Card>
        <Card title="Requirements">
          <ul className="space-y-1.5 text-sm text-muted">
            {admissionRequirements.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {programme.courseworkUnits} units · open intake {currentOpenIntake()} ·{" "}
            {schoolInfo.email}
          </p>
          <p className="mt-1 text-xs text-muted">
            Class options: {classOptions.map((c) => c.name).join(", ")}
          </p>
        </Card>
      </div>
    </div>
  );
}
