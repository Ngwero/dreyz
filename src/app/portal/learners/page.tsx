"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  SearchInput,
  Button,
} from "@/components/ui/PageElements";
import { Badge } from "@/components/ui/Badge";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Download, Trash2, UserPlus, Pencil, Eye } from "lucide-react";
import {
  learnersStore,
  coursesStore,
  useStoreList,
  uid,
  exportCsv,
  type Learner,
} from "@/lib/store";
import { createAccount, getAllUsers, recordManualFee } from "@/lib/auth";
import { provisionPortalAccount } from "@/lib/auth-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { computeLearnerProgress, feesForStudent } from "@/lib/academics";
import { LearnerProfile } from "@/components/portal/LearnerProfile";
import { formatUGX } from "@/lib/utils";

export default function LearnersPage() {
  const { user } = useAuth();
  const [learners, refresh] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    course: "Professional Interior Design Programme",
    status: "active" as Learner["status"],
    createLogin: true,
    paidAmount: 0,
    addPayment: 0,
    feeDue: 3350000,
  });
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Learner | null>(null);

  const canEdit = user?.role === "super_admin" || user?.role === "accountant";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.course.toLowerCase().includes(q)
    );
  }, [learners, query]);

  const canManageAccounts =
    user?.role === "super_admin" || user?.role === "accountant";

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      const extra = Number(form.addPayment) || 0;
      const next: Learner = {
        ...editing,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        course: form.course.trim(),
        status: form.status,
        feeDue: Number(form.feeDue) || 0,
      };
      learnersStore.upsert(next);
      recordManualFee({
        learnerName: next.name,
        learnerEmail: next.email,
        phone: next.phone,
        amount: extra,
        feeDue: next.feeDue,
      });
      setEditing(null);
      refresh();
      setOpen(false);
      return;
    }
    const firstPay = Number(form.paidAmount) || 0;
    const learner: Learner = {
      id: uid("DRY"),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      course: form.course.trim(),
      enrollmentDate: new Date().toISOString().slice(0, 10),
      progress: 0,
      status: form.status,
      paidAmount: firstPay,
      feeDue: Number(form.feeDue) || 0,
    };
    learnersStore.upsert(learner);
    recordManualFee({
      learnerName: learner.name,
      learnerEmail: learner.email,
      phone: learner.phone,
      amount: firstPay,
      feeDue: learner.feeDue,
    });
    if (form.createLogin && canManageAccounts) {
      const live = await provisionPortalAccount({
        name: learner.name,
        email: learner.email,
        phone: learner.phone,
        role: "student",
        learnerId: learner.id,
      });
      if (!live.ok) {
        setNotice(
          `Learner saved. Live portal login was not created: ${live.error} Use Grant login after the network is back.`
        );
      } else if (live.alreadyExists) {
        setNotice(`Learner saved. ${live.message}`);
      } else {
        setNotice(
          `Learner saved. Portal login emailed to ${learner.email}. Temporary password: ${live.password ?? "—"}`
        );
      }
    }
    refresh();
    setOpen(false);
    setForm({
      name: "",
      email: "",
      phone: "",
      course: "Professional Interior Design Programme",
      status: "active",
      createLogin: true,
      paidAmount: 0,
      addPayment: 0,
      feeDue: 3350000,
    });
  };

  const grantLogin = async (learner: Learner) => {
    const live = await provisionPortalAccount({
      name: learner.name,
      email: learner.email,
      phone: learner.phone,
      role: "student",
      learnerId: learner.id,
    });
    if (!live.ok) {
      setNotice(live.error);
      return;
    }
    try {
      createAccount({
        name: learner.name,
        email: learner.email,
        phone: learner.phone,
        role: "student",
        learnerId: learner.id,
      });
    } catch {
      /* already on this device */
    }
    setNotice(
      live.alreadyExists
        ? `${learner.name} already has a live login at ${learner.email}. They should sign in with that email or use Forgot password.`
        : `Live portal login emailed to ${learner.email}. Temporary password: ${live.password ?? "—"}. They can sign in on dreyzschool.com now.`
    );
    refresh();
  };

  const cycleStatus = (learner: Learner) => {
    if (!canEdit) return;
    const next =
      learner.status === "active"
        ? "paused"
        : learner.status === "paused"
          ? "completed"
          : "active";
    learnersStore.upsert({ ...learner, status: next });
    refresh();
  };

  const onExport = () => {
    exportCsv("learners.csv", [
      ["ID", "Name", "Email", "Phone", "Course", "Progress", "Status", "Enrolled"],
      ...filtered.map((l) => [
        l.id,
        l.name,
        l.email,
        l.phone,
        l.course,
        String(computeLearnerProgress(l)),
        l.status,
        l.enrollmentDate,
      ]),
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Learners"
        description="Manage enrolled students across all interior design courses."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download size={14} /> Export
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    name: "",
                    email: "",
                    phone: "",
                    course: "Professional Interior Design Programme",
                    status: "active",
                    createLogin: true,
                    paidAmount: 0,
                    addPayment: 0,
                    feeDue: 3350000,
                  });
                  setOpen(true);
                }}
              >
                <Plus size={14} /> Add Learner
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="mb-6">
        <SearchInput
          placeholder="Search learners by name, ID, or course..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "course", label: "Course" },
          { key: "progress", label: "Progress" },
          { key: "fees", label: "Fees" },
          { key: "status", label: "Status" },
          { key: "enrolled", label: "Enrolled" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {filtered.map((learner) => {
          const progress = computeLearnerProgress(learner);
          const account = getAllUsers().find(
            (u) =>
              u.learnerId === learner.id ||
              u.email.toLowerCase() === learner.email.toLowerCase()
          );
          const fees = feesForStudent(
            learner.email,
            account?.feeTrackId,
            learner.paidAmount,
            learner.feeDue
          );
          return (
          <TableRow key={learner.id}>
            <TableCell className="font-mono text-xs text-muted">{learner.id}</TableCell>
            <TableCell>
              <button
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => setSelected(learner)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-dark">
                  {learner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium hover:text-accent">{learner.name}</p>
                  <p className="text-xs text-muted">{learner.email}</p>
                </div>
              </button>
            </TableCell>
            <TableCell className="max-w-[200px] truncate">{learner.course}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-navy"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{progress}%</span>
              </div>
            </TableCell>
            <TableCell>
              <p
                className={`text-xs font-medium ${
                  fees.paid <= 0
                    ? "text-orange-600 dark:text-orange-400"
                    : fees.balance <= 0
                      ? "text-emerald-600"
                      : "text-foreground"
                }`}
              >
                {fees.paid <= 0 ? "Not paid" : fees.balance <= 0 ? "Paid" : "Part paid"}
              </p>
              <p className="text-[11px] text-muted">
                Paid {formatUGX(fees.paid)} · due {formatUGX(fees.total)} · balance {formatUGX(fees.balance)}
              </p>
            </TableCell>
            <TableCell>
              <button type="button" onClick={() => cycleStatus(learner)} disabled={!canEdit}>
                <Badge
                  variant={
                    learner.status === "active"
                      ? "success"
                      : learner.status === "completed"
                        ? "info"
                        : "warning"
                  }
                >
                  {learner.status}
                </Badge>
              </button>
            </TableCell>
            <TableCell className="text-muted">{learner.enrollmentDate}</TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => setSelected(learner)}>
                    <Eye size={13} /> Profile
                  </Button>
                  {canManageAccounts && (
                    <Button size="sm" variant="outline" onClick={() => grantLogin(learner)}>
                      <UserPlus size={13} /> Email live login
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(learner);
                      setForm({
                        name: learner.name,
                        email: learner.email,
                        phone: learner.phone,
                        course: learner.course,
                        status: learner.status,
                        createLogin: false,
                        paidAmount: learner.paidAmount ?? 0,
                        addPayment: 0,
                        feeDue: learner.feeDue ?? 3350000,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      learnersStore.remove(learner.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
          );
        })}
      </DataTable>

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-muted">No learners match your search.</p>
      )}

      <LearnerProfile learner={selected} onClose={() => setSelected(null)} />

      <Modal
        open={open}
        title={editing ? "Edit learner" : "Add learner"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Full name">
            <input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input required className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Course">
            <select
              required
              className={fieldClass}
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
            >
              <option value="Professional Interior Design Programme">
                Professional Interior Design Programme
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {editing ? (
              <Field label="Add payment (UGX)">
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.addPayment}
                  onChange={(e) => setForm({ ...form, addPayment: Number(e.target.value) })}
                />
              </Field>
            ) : (
              <Field label="Amount paid (UGX)">
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                />
              </Field>
            )}
            <Field label="Programme fee due (UGX)">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.feeDue}
                onChange={(e) => setForm({ ...form, feeDue: Number(e.target.value) })}
              />
            </Field>
          </div>
          {editing && (
            <p className="text-xs text-muted">
              Already paid {formatUGX(
                feesForStudent(editing.email, undefined, editing.paidAmount, editing.feeDue).paid
              )}
              . Balance{" "}
              {formatUGX(
                feesForStudent(editing.email, undefined, editing.paidAmount, form.feeDue).balance
              )}
              . A new payment here is added on top of earlier RukaPay or cash installments.
            </p>
          )}
          <p className="text-xs text-muted">
            Minimum UGX 1,000,000 activates the student account. Later cash or RukaPay payments reduce the remaining balance automatically.
          </p>
          <Field label="Status">
            <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Learner["status"] })}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
          </Field>
          {canManageAccounts && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.createLogin}
                onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
              />
              Also create student portal login and email credentials
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save changes" : "Save learner"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
