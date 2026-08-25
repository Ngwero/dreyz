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
import { Plus, Star, Trash2, UserPlus, Pencil, Eye, BookOpen, Ban, RotateCcw } from "lucide-react";
import {
  instructorsStore,
  coursesStore,
  useStoreList,
  uid,
  type Instructor,
} from "@/lib/store";
import { createAccount, getAllUsers, updateAccount, updateUserStatus } from "@/lib/auth";
import { showFlash } from "@/lib/flash";
import { useAuth } from "@/components/auth/AuthProvider";
import { InstructorProfile } from "@/components/portal/InstructorProfile";
import { ActionMenu } from "@/components/ui/ActionMenu";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
  rating: 4.5,
  status: "active" as Instructor["status"],
  createLogin: true,
};

export default function InstructorsPage() {
  const { user } = useAuth();
  const [instructors, refresh] = useStoreList(instructorsStore.getAll, instructorsStore.key);
  const [courses, refreshCourses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [assigning, setAssigning] = useState<Instructor | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Instructor | null>(null);

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

  const assignedCount = (instructor: Instructor) => {
    const ids = instructor.assignedCourseIds ?? [];
    const byName = courses.filter(
      (c) => c.instructor.toLowerCase() === instructor.name.toLowerCase()
    ).length;
    return ids.length || byName;
  };

  const portalUser = (instructor: Instructor) =>
    getAllUsers().find(
      (u) =>
        u.role === "tutor" &&
        (u.instructorId === instructor.id ||
          u.email.toLowerCase() === instructor.email.toLowerCase())
    );

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const payload: Instructor = {
      id: editing?.id ?? uid("INS"),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      specialty: form.specialty.trim(),
      courses: editing?.assignedCourseIds?.length ?? editing?.courses ?? 1,
      rating: Number(form.rating) || 4.5,
      status: form.status,
      assignedCourseIds: editing?.assignedCourseIds,
    };
    const previousName = editing?.name;
    instructorsStore.upsert(payload);
    if (previousName && previousName !== payload.name) {
      coursesStore.replaceAll(
        courses.map((c) =>
          c.instructor.toLowerCase() === previousName.toLowerCase()
            ? { ...c, instructor: payload.name }
            : c
        )
      );
      refreshCourses();
    }
    const linked = portalUser(payload);
    if (linked) {
      updateAccount(linked.id, {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        specialty: payload.specialty,
        status: payload.status === "suspended" ? "inactive" : "active",
      });
    }
    if (!editing && form.createLogin && canEdit) {
      try {
        const result = createAccount({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          role: "tutor",
          specialty: payload.specialty,
          instructorId: payload.id,
        });
        const msg = `Tutor saved. Login emailed to ${result.user.email}. Temporary password: ${result.password}`;
        setNotice(msg);
        showFlash("success", msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tutor saved without a new login.";
        setNotice(msg);
        showFlash("error", msg);
      }
    } else {
      showFlash("success", editing ? `${payload.name} was updated.` : `${payload.name} was added.`);
    }
    refresh();
    closeForm();
  };

  const grantLogin = (instructor: Instructor) => {
    try {
      const result = createAccount({
        name: instructor.name,
        email: instructor.email,
        phone: instructor.phone,
        role: "tutor",
        specialty: instructor.specialty,
        instructorId: instructor.id,
      });
      const msg = `Tutor login created for ${instructor.name}. Emailed ${result.user.email}. Temporary password: ${result.password}`;
      setNotice(msg);
      showFlash("success", msg);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create login.";
      setNotice(msg);
      showFlash("error", msg);
    }
  };

  const openAssign = (instructor: Instructor) => {
    const current =
      instructor.assignedCourseIds?.length
        ? instructor.assignedCourseIds
        : courses.filter((c) => c.instructor.toLowerCase() === instructor.name.toLowerCase()).map((c) => c.id);
    setSelectedIds(current);
    setAssigning(instructor);
  };

  const saveAssign = () => {
    if (!assigning) return;
    const nextCourses = courses.map((c) => {
      if (selectedIds.includes(c.id)) return { ...c, instructor: assigning.name };
      if (c.instructor.toLowerCase() === assigning.name.toLowerCase()) {
        return { ...c, instructor: "Unassigned" };
      }
      return c;
    });
    coursesStore.replaceAll(nextCourses);
    instructorsStore.getAll().forEach((ins) => {
      if (ins.id === assigning.id) return;
      const ids = (ins.assignedCourseIds ?? []).filter((id) => !selectedIds.includes(id));
      if (ids.length !== (ins.assignedCourseIds ?? []).length) {
        instructorsStore.upsert({ ...ins, assignedCourseIds: ids, courses: ids.length });
      }
    });
    instructorsStore.upsert({
      ...assigning,
      assignedCourseIds: selectedIds,
      courses: selectedIds.length,
    });
    refresh();
    refreshCourses();
    setAssigning(null);
    setNotice(`Assigned ${selectedIds.length} course${selectedIds.length === 1 ? "" : "s"} to ${assigning.name}.`);
    showFlash(
      "success",
      `Assigned ${selectedIds.length} course${selectedIds.length === 1 ? "" : "s"} to ${assigning.name}.`
    );
  };

  const suspend = (instructor: Instructor) => {
    const next: Instructor["status"] =
      instructor.status === "suspended" ? "active" : "suspended";
    instructorsStore.upsert({ ...instructor, status: next });
    const linked = portalUser(instructor);
    if (linked) updateUserStatus(linked.id, next === "suspended" ? "inactive" : "active");
    refresh();
    showFlash(
      "success",
      next === "suspended" ? `${instructor.name} was suspended.` : `${instructor.name} was restored.`
    );
  };

  return (
    <div>
      <PageHeader
        title="Tutors"
        description="Assign courses, edit details, and manage portal access."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
              <Plus size={14} /> Add tutor
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
          placeholder="Search tutors..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID", className: "hidden md:table-cell" },
          { key: "name", label: "Tutor" },
          { key: "specialty", label: "Specialty", className: "hidden sm:table-cell" },
          { key: "courses", label: "Courses" },
          { key: "rating", label: "Rating", className: "hidden lg:table-cell" },
          { key: "status", label: "Status" },
          { key: "actions", label: "", className: "w-px" },
        ]}
      >
        {filtered.map((instructor) => {
          const account = portalUser(instructor);
          const assigned = assignedCount(instructor);
          return (
          <TableRow key={instructor.id}>
            <TableCell className="hidden font-mono text-xs text-muted md:table-cell">
              {instructor.id}
            </TableCell>
            <TableCell>
              <button
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => setSelected(instructor)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {instructor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium hover:text-accent">{instructor.name}</p>
                  <p className="truncate text-xs text-muted">{instructor.email}</p>
                  <p className="mt-0.5 text-[11px] text-muted sm:hidden">{instructor.specialty}</p>
                </div>
              </button>
            </TableCell>
            <TableCell className="hidden sm:table-cell">{instructor.specialty}</TableCell>
            <TableCell>
              <span className="tabular-nums font-medium">{assigned}</span>
              <span className="ml-1 text-xs text-muted">{assigned === 1 ? "course" : "courses"}</span>
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-accent text-accent" />
                <span className="font-medium tabular-nums">{instructor.rating}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1">
                <Badge
                  variant={
                    instructor.status === "active"
                      ? "success"
                      : instructor.status === "suspended"
                        ? "danger"
                        : "warning"
                  }
                >
                  {instructor.status}
                </Badge>
                <span className="text-[11px] text-muted">
                  {account ? "Has login" : "No login"}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={() => setSelected(instructor)}
                >
                  <Eye size={13} /> Profile
                </Button>
                {canEdit ? (
                  <ActionMenu
                    items={[
                      {
                        label: "View profile",
                        icon: <Eye size={14} />,
                        onClick: () => setSelected(instructor),
                      },
                      {
                        label: "Assign courses",
                        icon: <BookOpen size={14} />,
                        onClick: () => openAssign(instructor),
                      },
                      {
                        label: "Edit details",
                        icon: <Pencil size={14} />,
                        onClick: () => {
                          setEditing(instructor);
                          setForm({
                            name: instructor.name,
                            email: instructor.email,
                            phone: instructor.phone ?? "",
                            specialty: instructor.specialty,
                            rating: instructor.rating,
                            status: instructor.status,
                            createLogin: false,
                          });
                          setOpen(true);
                        },
                      },
                      {
                        label: "Grant login",
                        icon: <UserPlus size={14} />,
                        onClick: () => grantLogin(instructor),
                        hidden: !!account,
                      },
                      {
                        label: instructor.status === "suspended" ? "Restore access" : "Suspend",
                        icon:
                          instructor.status === "suspended" ? (
                            <RotateCcw size={14} />
                          ) : (
                            <Ban size={14} />
                          ),
                        onClick: () => suspend(instructor),
                      },
                      {
                        label: "Remove tutor",
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => {
                          if (!confirm(`Remove ${instructor.name} from the roster?`)) return;
                          instructorsStore.remove(instructor.id);
                          refresh();
                          showFlash("success", `${instructor.name} was removed.`);
                        },
                      },
                    ]}
                  />
                ) : (
                  <Button size="sm" variant="outline" className="sm:hidden" onClick={() => setSelected(instructor)}>
                    <Eye size={13} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
          );
        })}
      </DataTable>

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-muted">No tutors match your search.</p>
      )}

      <InstructorProfile instructor={selected} onClose={() => setSelected(null)} />

      <Modal
        open={open}
        title={editing ? "Edit tutor" : "Add tutor"}
        onClose={closeForm}
      >
        <form onSubmit={onSave} className="space-y-3">
          <Field label="Name">
            <input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Specialty">
            <input required className={fieldClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rating">
              <input type="number" min={0} max={5} step={0.1} className={fieldClass} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Instructor["status"] })}
              >
                <option value="active">active</option>
                <option value="on-leave">on-leave</option>
                <option value="suspended">suspended</option>
              </select>
            </Field>
          </div>
          {!editing && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.createLogin}
                onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
              />
              Also create tutor portal login and email credentials
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit">{editing ? "Save changes" : "Save tutor"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!assigning}
        title={assigning ? `Assign courses · ${assigning.name}` : "Assign courses"}
        onClose={() => setAssigning(null)}
        wide
      >
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {courses.map((course) => (
            <label key={course.id} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.includes(course.id)}
                onChange={(e) => {
                  setSelectedIds((ids) =>
                    e.target.checked ? [...ids, course.id] : ids.filter((id) => id !== course.id)
                  );
                }}
              />
              <span>
                <span className="font-medium">{course.title}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {course.category} · currently {course.instructor}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setAssigning(null)}>
            Cancel
          </Button>
          <Button type="button" onClick={saveAssign}>
            Save assignment
          </Button>
        </div>
      </Modal>
    </div>
  );
}
