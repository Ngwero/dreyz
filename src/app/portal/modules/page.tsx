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
import { Modal, Field, fieldClass, ConfirmDialog } from "@/components/ui/Modal";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { modulesStore, coursesStore, useStoreList, uid, type Module } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";

const emptyForm = {
  title: "",
  courseId: "",
  lessons: 4,
  duration: "1 week",
  order: 1,
  classCount: 4,
  quizzes: 1,
  projects: 0,
};

export default function ModulesPage() {
  const { user } = useAuth();
  const [modules, refresh] = useStoreList(modulesStore.getAll, modulesStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<Module | null>(null);

  const canEdit = user?.role === "super_admin";
  const getCourseName = (courseId: string) =>
    courses.find((c) => c.id === courseId)?.title ?? "Unknown";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        getCourseName(m.courseId).toLowerCase().includes(q)
    );
  }, [modules, query, courses]);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      courseId: courses[0]?.id ?? "",
      order: modules.length + 1,
    });
    setOpen(true);
  };

  const openEdit = (mod: Module) => {
    setEditing(mod);
    setForm({
      title: mod.title,
      courseId: mod.courseId,
      lessons: mod.lessons,
      duration: mod.duration,
      order: mod.order,
      classCount: mod.classCount ?? mod.lessons,
      quizzes: mod.quizzes ?? 0,
      projects: mod.projects ?? 0,
    });
    setOpen(true);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    modulesStore.upsert({
      id: editing?.id ?? uid("MOD"),
      title: form.title.trim(),
      courseId: form.courseId || courses[0]?.id || "CRS001",
      lessons: Number(form.lessons) || 1,
      duration: form.duration.trim(),
      order: Number(form.order) || 1,
      classCount: Number(form.classCount) || 0,
      quizzes: Number(form.quizzes) || 0,
      projects: Number(form.projects) || 0,
    });
    refresh();
    closeModal();
    showFlash("success", editing ? `${form.title.trim()} was updated.` : `${form.title.trim()} was added.`);
  };

  return (
    <div>
      <PageHeader
        title="Modules"
        description="Break each course into class count, quizzes, and projects. Super Admin can edit existing modules."
        action={
          canEdit ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> Add Module
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search modules..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "order", label: "#" },
          { key: "title", label: "Module" },
          { key: "course", label: "Course" },
          { key: "lessons", label: "Classes" },
          { key: "quizzes", label: "Quizzes" },
          { key: "projects", label: "Projects" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {filtered.map((mod) => (
          <TableRow key={mod.id}>
            <TableCell className="font-mono text-muted">{mod.order}</TableCell>
            <TableCell className="font-medium">{mod.title}</TableCell>
            <TableCell className="max-w-[220px] truncate text-muted">
              {getCourseName(mod.courseId)}
            </TableCell>
            <TableCell>{mod.classCount ?? mod.lessons}</TableCell>
            <TableCell>{mod.quizzes ?? 0}</TableCell>
            <TableCell>{mod.projects ?? 0}</TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(mod)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingDelete(mod)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <Modal
        open={open}
        title={editing ? "Edit module" : "Add module"}
        onClose={closeModal}
      >
        <form onSubmit={onSave} className="space-y-3">
          <Field label="Title">
            <input
              required
              className={fieldClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Course">
            <select
              required
              className={fieldClass}
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order">
              <input
                type="number"
                min={1}
                className={fieldClass}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Classes">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.classCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    classCount: Number(e.target.value),
                    lessons: Number(e.target.value) || form.lessons,
                  })
                }
              />
            </Field>
            <Field label="Quizzes">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.quizzes}
                onChange={(e) => setForm({ ...form, quizzes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Projects">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.projects}
                onChange={(e) => setForm({ ...form, projects: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete module"
        description={`Delete “${pendingDelete?.title ?? ""}”? This cannot be undone.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          modulesStore.remove(pendingDelete.id);
          refresh();
          showFlash("success", `${pendingDelete.title} was deleted.`);
        }}
      />
    </div>
  );
}
