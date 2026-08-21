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
import { Plus, Star, Trash2, UserPlus } from "lucide-react";
import { instructorsStore, useStoreList, uid, type Instructor } from "@/lib/store";
import { createAccount, getAllUsers } from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";

export default function InstructorsPage() {
  const { user } = useAuth();
  const [instructors, refresh] = useStoreList(instructorsStore.getAll, instructorsStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    specialty: "",
    courses: 1,
    rating: 4.5,
    createLogin: true,
  });
  const [notice, setNotice] = useState("");

  const canEdit = user?.role === "super_admin";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return instructors;
    return instructors.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.specialty.toLowerCase().includes(q)
    );
  }, [instructors, query]);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const instructor: Instructor = {
      id: uid("INS"),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      specialty: form.specialty.trim(),
      courses: Number(form.courses) || 1,
      rating: Number(form.rating) || 4.5,
      status: "active",
    };
    instructorsStore.upsert(instructor);
    if (form.createLogin && canEdit) {
      try {
        const result = createAccount({
          name: instructor.name,
          email: instructor.email,
          role: "tutor",
          specialty: instructor.specialty,
          instructorId: instructor.id,
        });
        setNotice(
          `Instructor saved. Tutor login emailed to ${result.user.email}. Temporary password: ${result.password}`
        );
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Instructor saved without a new login.");
      }
    }
    refresh();
    setOpen(false);
    setForm({ name: "", email: "", specialty: "", courses: 1, rating: 4.5, createLogin: true });
  };

  const grantLogin = (instructor: Instructor) => {
    try {
      const result = createAccount({
        name: instructor.name,
        email: instructor.email,
        role: "tutor",
        specialty: instructor.specialty,
        instructorId: instructor.id,
      });
      setNotice(
        `Tutor login created for ${instructor.name}. Emailed ${result.user.email}. Temporary password: ${result.password}`
      );
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not create login.");
    }
  };

  const hasPortal = (instructor: Instructor) =>
    getAllUsers().some(
      (u) =>
        u.role === "tutor" &&
        (u.instructorId === instructor.id ||
          u.email.toLowerCase() === instructor.email.toLowerCase())
    );

  const toggleStatus = (instructor: Instructor) => {
    if (!canEdit) return;
    instructorsStore.upsert({
      ...instructor,
      status: instructor.status === "active" ? "on-leave" : "active",
    });
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Instructors"
        description="Manage your interior design faculty and course assignments."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Add Instructor
            </Button>
          ) : undefined
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="mb-6">
        <SearchInput
          placeholder="Search instructors..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Instructor" },
          { key: "specialty", label: "Specialty" },
          { key: "courses", label: "Courses" },
          { key: "rating", label: "Rating" },
          { key: "status", label: "Status" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {filtered.map((instructor) => (
          <TableRow key={instructor.id}>
            <TableCell className="font-mono text-xs text-muted">{instructor.id}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {instructor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium">{instructor.name}</p>
                  <p className="text-xs text-muted">{instructor.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>{instructor.specialty}</TableCell>
            <TableCell>{instructor.courses}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-accent text-accent" />
                <span className="font-medium">{instructor.rating}</span>
              </div>
            </TableCell>
            <TableCell>
              <button type="button" onClick={() => toggleStatus(instructor)} disabled={!canEdit}>
                <Badge variant={instructor.status === "active" ? "success" : "warning"}>
                  {instructor.status}
                </Badge>
              </button>
            </TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  {!hasPortal(instructor) && (
                    <Button size="sm" variant="outline" onClick={() => grantLogin(instructor)}>
                      <UserPlus size={13} /> Grant login
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      instructorsStore.remove(instructor.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <Modal open={open} title="Add instructor" onClose={() => setOpen(false)}>
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Name">
            <input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Specialty">
            <input required className={fieldClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Courses">
              <input type="number" min={0} className={fieldClass} value={form.courses} onChange={(e) => setForm({ ...form, courses: Number(e.target.value) })} />
            </Field>
            <Field label="Rating">
              <input type="number" min={0} max={5} step={0.1} className={fieldClass} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.createLogin}
              onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
            />
            Also create tutor portal login and email credentials
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
