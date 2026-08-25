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
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  deletePayment,
  getPayments,
  recordManualFee,
  updatePayment,
} from "@/lib/auth";
import type { Enrollment, PaymentRecord } from "@/lib/types";
import {
  enrollmentsStore,
  exportCsv,
  uid,
  useStoreList,
  learnersStore,
} from "@/lib/store";
import { schoolFeeTotals } from "@/lib/academics";
import Link from "next/link";

type Row = {
  id: string;
  source: "payment" | "enrollment";
  learnerName: string;
  email: string;
  course: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "refunded";
};

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>(() =>
    typeof window !== "undefined" ? getPayments() : []
  );
  const [enrollments, refreshEnrollments] = useStoreList(
    enrollmentsStore.getAll,
    enrollmentsStore.key
  );
  const [learners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({
    learnerName: "",
    email: "",
    course: "4-Month Main Course",
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    status: "paid" as Row["status"],
  });

  const canEdit = user?.role === "super_admin";

  useEffect(() => {
    const refresh = () => setPayments(getPayments());
    refresh();
    window.addEventListener("dreyz-store", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("dreyz-store", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const merged: Row[] = useMemo(
    () => [
      ...payments.map((p) => ({
        id: p.id,
        source: "payment" as const,
        learnerName: p.learnerName,
        email: p.learnerEmail,
        course: p.feeTrackId,
        date: p.date,
        amount: p.amount,
        status: p.status === "confirmed" ? ("paid" as const) : p.status === "failed" ? ("refunded" as const) : ("pending" as const),
      })),
      ...enrollments.map((e) => ({
        id: e.id,
        source: "enrollment" as const,
        learnerName: e.learnerName,
        email: e.learnerEmail ?? "",
        course: e.course,
        date: e.date,
        amount: e.amount,
        status: e.status,
      })),
    ],
    [payments, enrollments]
  );

  const roleFiltered =
    user?.role === "student"
      ? merged.filter(
          (r) =>
            r.email.toLowerCase() === user.email.toLowerCase() ||
            r.learnerName.toLowerCase().includes(user.name.split(" ")[0].toLowerCase())
        )
      : merged;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleFiltered;
    return roleFiltered.filter(
      (r) =>
        r.learnerName.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [roleFiltered, query]);

  const totals = schoolFeeTotals(learners);
  const pending = rows.filter((e) => e.status === "pending").length;

  const onExport = () => {
    exportCsv("enrollments.csv", [
      ["ID", "Learner", "Course", "Date", "Amount", "Status"],
      ...rows.map((r) => [r.id, r.learnerName, r.course, r.date, String(r.amount), r.status]),
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      learnerName: "",
      email: "",
      course: "4-Month Main Course",
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      status: "paid",
    });
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      learnerName: row.learnerName,
      email: row.email,
      course: row.course,
      date: row.date,
      amount: row.amount,
      status: row.status,
    });
    setOpen(true);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    if (editing?.source === "payment") {
      updatePayment(editing.id, {
        learnerName: form.learnerName.trim(),
        learnerEmail: form.email.trim().toLowerCase(),
        amount,
        date: form.date,
        status: form.status === "paid" ? "confirmed" : form.status === "pending" ? "pending" : "failed",
        feeTrackId: form.course,
      });
      setPayments(getPayments());
    } else {
      const record: Enrollment = {
        id: editing?.id ?? uid("ENR"),
        learnerName: form.learnerName.trim(),
        learnerEmail: form.email.trim().toLowerCase(),
        course: form.course.trim(),
        date: form.date,
        amount,
        status: form.status,
      };
      enrollmentsStore.upsert(record);
      if (!editing && record.status === "paid" && amount > 0 && record.learnerEmail) {
        recordManualFee({
          learnerName: record.learnerName,
          learnerEmail: record.learnerEmail,
          amount,
        });
      }
      refreshEnrollments();
      setPayments(getPayments());
    }
    setOpen(false);
    showFlash("success", editing ? "Billing record updated." : "Billing record saved.");
  };

  const onDelete = (row: Row) => {
    if (!confirm("Delete this billing record?")) return;
    if (row.source === "payment") {
      deletePayment(row.id);
      setPayments(getPayments());
    } else {
      enrollmentsStore.remove(row.id);
      refreshEnrollments();
    }
    showFlash("success", "Billing record deleted.");
  };

  return (
    <div>
      <PageHeader
        title={user?.role === "student" ? "Fees & billing" : "Enrollments & Billing"}
        description={
          user?.role === "student"
            ? "Your fee payments and enrollment status."
            : "Expected fees, amounts paid, and balances. Super Admin can edit records, including manual enrolments."
        }
        action={
          user?.role === "super_admin" || user?.role === "accountant" ? (
            <div className="flex gap-2">
              {canEdit && (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Add record
                </Button>
              )}
              <Link href="/portal/payments">
                <Button size="sm">Record payment</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download size={14} /> Export
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download size={14} /> Export
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Fees expected</p>
          <p className="mt-1 text-2xl font-bold">{formatUGX(totals.expected)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Amount paid</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatUGX(totals.paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Balance due</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatUGX(totals.balance)}</p>
          <p className="mt-1 text-xs text-muted">{pending} pending records</p>
        </Card>
      </div>

      {user?.role !== "student" && (
        <div className="mb-6">
          <SearchInput
            placeholder="Search enrollments..."
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
          { key: "course", label: "Course / track" },
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {rows.map((enrollment) => (
          <TableRow key={`${enrollment.source}-${enrollment.id}`}>
            <TableCell className="font-mono text-xs text-muted">{enrollment.id}</TableCell>
            <TableCell className="font-medium">{enrollment.learnerName}</TableCell>
            <TableCell className="max-w-[200px] truncate">{enrollment.course}</TableCell>
            <TableCell className="text-muted">{enrollment.date}</TableCell>
            <TableCell className="font-medium">{formatUGX(enrollment.amount)}</TableCell>
            <TableCell>
              <Badge
                variant={
                  enrollment.status === "paid"
                    ? "success"
                    : enrollment.status === "pending"
                      ? "warning"
                      : "danger"
                }
              >
                {enrollment.status}
              </Badge>
            </TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(enrollment)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(enrollment)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      {rows.length === 0 && (
        <p className="mt-4 text-sm text-muted">No billing records yet. Add a manual enrolment or record a payment.</p>
      )}

      <Modal
        open={open}
        title={editing ? "Edit billing record" : "Add billing record"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={onSave} className="space-y-3">
          <Field label="Learner name">
            <input required className={fieldClass} value={form.learnerName} onChange={(e) => setForm({ ...form, learnerName: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Course / track">
            <input required className={fieldClass} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className={fieldClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Amount (UGX)">
              <input type="number" min={0} className={fieldClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Status">
            <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Row["status"] })}>
              <option value="paid">paid</option>
              <option value="pending">pending</option>
              <option value="refunded">refunded</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
