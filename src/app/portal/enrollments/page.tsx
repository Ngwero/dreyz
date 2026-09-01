"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  SearchInput,
  Button,
} from "@/components/ui/PageElements";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { formatUGX } from "@/lib/utils";
import { showFlash } from "@/lib/flash";
import { Download, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  foldLegacyEnrollmentsIntoRoster,
  recordManualFee,
} from "@/lib/auth";
import type { Learner } from "@/lib/types";
import { exportCsv, learnersStore, useStoreList } from "@/lib/store";
import { feesForStudent, schoolFeeTotals } from "@/lib/academics";
import { getFeeTracks } from "@/lib/fee-catalog";
import { resolveStudentAdmissionId } from "@/lib/learner-identity";
import { currentOpenIntake, resolveLearnerIntake } from "@/lib/intakes";
import Link from "next/link";

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const feeTracks = getFeeTracks();
  const [learners, refreshLearners] = useStoreList(
    learnersStore.getAll,
    learnersStore.key
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [form, setForm] = useState({
    learnerName: "",
    email: "",
    phone: "",
    feeTrackId: feeTracks[0]?.id ?? "4-month",
    amount: 0,
    feeDue: feeTracks[0]?.total ?? 3_350_000,
  });

  const canEdit = user?.role === "super_admin" || user?.role === "accountant";

  useEffect(() => {
    const folded = foldLegacyEnrollmentsIntoRoster();
    if (folded > 0) {
      refreshLearners();
      showFlash(
        "success",
        `Merged ${folded} legacy billing row${folded === 1 ? "" : "s"} into the learner roster.`
      );
    }
  }, [refreshLearners]);

  const roleFiltered =
    user?.role === "student"
      ? learners.filter(
          (l) =>
            l.email.toLowerCase() === user.email.toLowerCase() ||
            (user.learnerId && l.id === user.learnerId)
        )
      : learners;

  const isStudent = user?.role === "student";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = roleFiltered.map((learner) => {
      const trackId =
        learner.feeTrackId ||
        feeTracks.find((t) => t.name === learner.course)?.id ||
        feeTracks.find((t) => t.total === (learner.feeDue ?? 0))?.id;
      const fees = feesForStudent(
        learner.email,
        trackId,
        learner.paidAmount,
        learner.feeDue
      );
      const track = feeTracks.find((t) => t.id === trackId);
      return {
        learner,
        trackName: track?.name ?? learner.course,
        fees,
      };
    });
    if (!q) return list;
    return list.filter(
      ({ learner, trackName }) =>
        learner.name.toLowerCase().includes(q) ||
        learner.email.toLowerCase().includes(q) ||
        learner.id.toLowerCase().includes(q) ||
        trackName.toLowerCase().includes(q)
    );
  }, [roleFiltered, query, feeTracks]);

  const totals = useMemo(
    () => schoolFeeTotals(isStudent ? roleFiltered : learners),
    [isStudent, roleFiltered, learners]
  );
  const pending = rows.filter((r) => r.fees.balance > 0).length;

  const onExport = () => {
    exportCsv("billing.csv", [
      ["ID", "Learner", "Email", "Programme", "Expected", "Paid", "Balance", "Status"],
      ...rows.map(({ learner, trackName, fees }) => [
        learner.id,
        learner.name,
        learner.email,
        trackName,
        String(fees.total),
        String(fees.paid),
        String(fees.balance),
        learner.status,
      ]),
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    const track = feeTracks[0];
    setForm({
      learnerName: "",
      email: "",
      phone: "",
      feeTrackId: track?.id ?? "4-month",
      amount: 0,
      feeDue: track?.total ?? 3_350_000,
    });
    setOpen(true);
  };

  const openEdit = (learner: Learner) => {
    setEditing(learner);
    const trackId =
      learner.feeTrackId ||
      feeTracks.find((t) => t.name === learner.course)?.id ||
      "4-month";
    const track = feeTracks.find((t) => t.id === trackId);
    setForm({
      learnerName: learner.name,
      email: learner.email,
      phone: learner.phone,
      feeTrackId: trackId,
      amount: 0,
      feeDue: learner.feeDue ?? track?.total ?? 3_350_000,
    });
    setOpen(true);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const track = feeTracks.find((t) => t.id === form.feeTrackId);
    const email = form.email.trim().toLowerCase();
    const name = form.learnerName.trim();
    const phone = form.phone.trim();
    const feeDue = Number(form.feeDue) || track?.total || 0;
    const amount = Number(form.amount) || 0;
    const admissionId = editing?.id ?? resolveStudentAdmissionId({ email });

    learnersStore.upsert({
      id: admissionId,
      name,
      email,
      phone,
      course: track?.name ?? editing?.course ?? "Professional Interior Design Programme",
      enrollmentDate:
        editing?.enrollmentDate ?? new Date().toISOString().slice(0, 10),
      intake: editing?.intake || resolveLearnerIntake(editing ?? {}) || currentOpenIntake(),
      progress: editing?.progress ?? 0,
      status: editing?.status ?? "active",
      feeTrackId: form.feeTrackId,
      feeDue,
      paidAmount: editing?.paidAmount ?? 0,
    });

    recordManualFee({
      learnerName: name,
      learnerEmail: email,
      phone,
      amount,
      feeTrackId: form.feeTrackId,
      feeDue,
      intake: editing?.intake,
    });
    refreshLearners();
    setOpen(false);
    showFlash(
      "success",
      editing
        ? amount > 0
          ? "Learner billing updated and payment recorded."
          : "Learner billing updated."
        : amount > 0
          ? "Learner added and payment recorded."
          : "Learner added to billing."
    );
  };

  return (
    <div>
      <PageHeader
        title={user?.role === "student" ? "Fees & billing" : "Enrollments & Billing"}
        description={
          user?.role === "student"
            ? "Your fee payments and enrollment status — same record as your learner profile."
            : "Same learner roster and fee programmes as Admissions and Learners. Payments update balances here automatically."
        }
        action={
          user?.role === "super_admin" || user?.role === "accountant" ? (
            <div className="flex gap-2">
              {canEdit && (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Add / update billing
                </Button>
              )}
              <Link href="/portal/payments">
                <Button size="sm">Record payment</Button>
              </Link>
              <Link href="/portal/learners">
                <Button size="sm" variant="outline">
                  Learners
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download size={14} /> Export
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">{isStudent ? "Your programme fee" : "Fees expected"}</p>
          <p className="mt-1 text-2xl font-bold">{formatUGX(totals.expected)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{isStudent ? "Your payments" : "Amount paid"}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatUGX(totals.paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{isStudent ? "Your balance" : "Balance due"}</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatUGX(totals.balance)}</p>
          {!isStudent && (
            <p className="mt-1 text-xs text-muted">{pending} with balance remaining</p>
          )}
        </Card>
      </div>

      {user?.role !== "student" && (
        <div className="mb-6">
          <SearchInput
            placeholder="Search by name, email, admission ID, or programme..."
            className="max-w-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "learner", label: "Learner" },
          { key: "course", label: "Programme" },
          { key: "expected", label: "Expected" },
          { key: "paid", label: "Paid" },
          { key: "balance", label: "Balance" },
          { key: "status", label: "Status" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {rows.map(({ learner, trackName, fees }) => (
          <TableRow key={learner.id}>
            <TableCell className="font-mono text-xs text-muted">{learner.id}</TableCell>
            <TableCell>
              <p className="font-medium">{learner.name}</p>
              <p className="text-xs text-muted">{learner.email}</p>
            </TableCell>
            <TableCell className="max-w-[200px] truncate">{trackName}</TableCell>
            <TableCell className="font-medium">{formatUGX(fees.total)}</TableCell>
            <TableCell className="font-medium text-emerald-700">{formatUGX(fees.paid)}</TableCell>
            <TableCell className="font-medium text-amber-700">{formatUGX(fees.balance)}</TableCell>
            <TableCell>
              <Badge
                variant={
                  fees.balance <= 0
                    ? "success"
                    : fees.paid > 0
                      ? "warning"
                      : "danger"
                }
              >
                {fees.balance <= 0 ? "settled" : fees.paid > 0 ? "partial" : "unpaid"}
              </Badge>
            </TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(learner)}>
                    <Pencil size={13} /> Edit
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      {rows.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          No learners on the roster yet. Add one here, from Learners, or by recording a payment.
        </p>
      )}

      <Modal
        open={open}
        title={editing ? "Update learner billing" : "Add learner billing"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={onSave} className="space-y-3">
          <p className="text-xs text-muted">
            Uses the same learner record as Admissions and the Learners roster. Payments go on the shared ledger.
          </p>
          <Field label="Learner name">
            <input
              required
              className={fieldClass}
              value={form.learnerName}
              onChange={(e) => setForm({ ...form, learnerName: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className={fieldClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!!editing}
            />
          </Field>
          <Field label="Phone">
            <input
              className={fieldClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Fee programme">
            <select
              required
              className={fieldClass}
              value={form.feeTrackId}
              onChange={(e) => {
                const track = feeTracks.find((t) => t.id === e.target.value);
                setForm({
                  ...form,
                  feeTrackId: e.target.value,
                  feeDue: track?.total ?? form.feeDue,
                });
              }}
            >
              {feeTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatUGX(t.total)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fee due (UGX)">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.feeDue}
                onChange={(e) => setForm({ ...form, feeDue: Number(e.target.value) })}
              />
            </Field>
            <Field label={editing ? "Add payment (UGX)" : "Amount paid (UGX)"}>
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </Field>
          </div>
          {editing && (
            <p className="text-xs text-muted">
              Paid to date:{" "}
              {formatUGX(
                feesForStudent(
                  editing.email,
                  form.feeTrackId,
                  editing.paidAmount,
                  form.feeDue
                ).paid
              )}
              . Leave “Add payment” at 0 to only update programme details.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
