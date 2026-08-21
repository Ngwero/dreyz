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
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Trash2 } from "lucide-react";
import { modulesStore, coursesStore, useStoreList, uid } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ModulesPage() {
  const { user } = useAuth();
  const [modules, refresh] = useStoreList(modulesStore.getAll, modulesStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    courseId: "",
    lessons: 4,
    duration: "1 week",
  });

  const canEdit = user?.role === "super_admin" || user?.role === "tutor";
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

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    modulesStore.upsert({
      id: uid("MOD"),
      title: form.title.trim(),
      courseId: form.courseId || courses[0]?.id || "CRS001",
      lessons: Number(form.lessons) || 1,
      duration: form.duration.trim(),
      order: modules.length + 1,
    });
    refresh();
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Modules"
        description="Organize course content into structured learning modules."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setOpen(true)}>
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
          { key: "lessons", label: "Lessons" },
          { key: "duration", label: "Duration" },
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
            <TableCell>{mod.lessons}</TableCell>
            <TableCell>{mod.duration}</TableCell>
            {canEdit && (
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    modulesStore.remove(mod.id);
                    refresh();
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <Modal open={open} title="Add module" onClose={() => setOpen(false)}>
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Course">
            <select required className={fieldClass} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lessons">
              <input type="number" min={1} className={fieldClass} value={form.lessons} onChange={(e) => setForm({ ...form, lessons: Number(e.target.value) })} />
            </Field>
            <Field label="Duration">
              <input className={fieldClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
