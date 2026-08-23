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
import { Plus, Download, Trash2, UserPlus, Pencil } from "lucide-react";
import {
  learnersStore,
  useStoreList,
  uid,
  exportCsv,
  type Learner,
} from "@/lib/store";
import { createAccount, getAllUsers } from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import { computeLearnerProgress } from "@/lib/academics";

export default function LearnersPage() {
  const { user } = useAuth();
  const [learners, refresh] = useStoreList(learnersStore.getAll, learnersStore.key);
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
  });
  const [notice, setNotice] = useState("");

  const canEdit = user?.role === "super_admin" || user?.role === "accountant" || user?.role === "tutor";

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

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      learnersStore.upsert({
        ...editing,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        course: form.course.trim(),
        status: form.status,
      });
      setEditing(null);
      refresh();
      setOpen(false);
      return;
    }
    const learner: Learner = {
      id: uid("DRY"),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      course: form.course.trim(),
      enrollmentDate: new Date().toISOString().slice(0, 10),
      progress: 0,
      status: form.status,
    };
    learnersStore.upsert(learner);
    if (form.createLogin && canManageAccounts) {
      try {
        const result = createAccount({
          name: learner.name,
          email: learner.email,
          phone: learner.phone,
          role: "student",
          learnerId: learner.id,
        });
        setNotice(
          `Learner saved. Portal login emailed to ${result.user.email}. Temporary password: ${result.password}`
        );
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Learner saved without a new login.");
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
    });
  };

  const grantLogin = (learner: Learner) => {
    try {
      const result = createAccount({
        name: learner.name,
        email: learner.email,
        phone: learner.phone,
        role: "student",
        learnerId: learner.id,
      });
      setNotice(
        `Portal login created for ${learner.name}. Emailed ${result.user.email}. Temporary password: ${result.password}`
      );
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not create login.");
    }
  };

  const hasPortal = (learner: Learner) =>
    getAllUsers().some(
      (u) =>
        u.role === "student" &&
        (u.learnerId === learner.id || u.email.toLowerCase() === learner.email.toLowerCase())
    );

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
              <Button size="sm" onClick={() => setOpen(true)}>
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
          { key: "status", label: "Status" },
          { key: "enrolled", label: "Enrolled" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {filtered.map((learner) => {
          const progress = computeLearnerProgress(learner);
          return (
          <TableRow key={learner.id}>
            <TableCell className="font-mono text-xs text-muted">{learner.id}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-dark">
                  {learner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium">{learner.name}</p>
                  <p className="text-xs text-muted">{learner.email}</p>
                </div>
              </div>
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
                  {canManageAccounts && !hasPortal(learner) && (
                    <Button size="sm" variant="outline" onClick={() => grantLogin(learner)}>
                      <UserPlus size={13} /> Grant login
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
            <input required className={fieldClass} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          </Field>
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
