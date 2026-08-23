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
import { Card } from "@/components/ui/Card";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { programme } from "@/lib/data";
import { coursesStore, useStoreList, uid, type Course } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  courseStructureSummary,
  durationLabel,
  isCourseReadyToActivate,
  normalizeCourse,
} from "@/lib/course-structure";

const emptyForm = {
  title: "",
  category: "Foundations",
  level: "Beginner" as Course["level"],
  durationWeeks: 2,
  classCount: 8,
  testCount: 1,
  examCount: 1,
  hasFinalExam: true,
  capacity: 100,
  instructor: "",
  status: "draft" as Course["status"],
};

export default function CoursesPage() {
  const { user } = useAuth();
  const [coursesRaw, refresh] = useStoreList(coursesStore.getAll, coursesStore.key);
  const courses = useMemo(() => coursesRaw.map(normalizeCourse), [coursesRaw]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const canEdit = user?.role === "super_admin";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q)
    );
  }, [courses, query]);

  const activeCourses = courses.filter((c) => c.status === "active").length;
  const internship = courses.find((c) => c.category === "Internship");

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      title: course.title,
      category: course.category,
      level: course.level,
      durationWeeks: course.durationWeeks || 2,
      classCount: course.classCount || 0,
      testCount: course.testCount ?? 0,
      examCount: course.examCount ?? 0,
      hasFinalExam: course.hasFinalExam ?? true,
      capacity: course.capacity,
      instructor: course.instructor,
      status: course.status,
    });
    setOpen(true);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const weeks = Number(form.durationWeeks) || 0;
    const draft: Course = {
      id: editing?.id ?? uid("CRS"),
      title: form.title.trim(),
      category: form.category.trim(),
      level: form.level,
      durationWeeks: weeks,
      duration: durationLabel(weeks || 1),
      classCount: Number(form.classCount) || 0,
      testCount: Number(form.testCount) || 0,
      examCount: Number(form.examCount) || 0,
      hasFinalExam: form.hasFinalExam,
      enrolled: editing?.enrolled ?? 0,
      capacity: Number(form.capacity) || 100,
      instructor: form.instructor.trim() || "Staff",
      status: form.status,
      price: editing?.price ?? 0,
    };
    if (draft.status === "active" && !isCourseReadyToActivate(draft)) {
      setFormError(
        "Set duration, class count, tests, exams, and whether there is a final exam before activating this course."
      );
      return;
    }
    coursesStore.upsert(draft);
    refresh();
    closeModal();
  };

  return (
    <div>
      <PageHeader
        title="Courses"
        description={`${programme.name}: duration, classes, tests, exams, and the final exam must be set by Super Admin before a course can go active. Those targets drive student progress.`}
        action={
          canEdit ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> Create Course
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Programme Units</p>
          <p className="mt-1 text-2xl font-bold">{activeCourses}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Internship</p>
          <p className="mt-1 text-2xl font-bold">{internship?.duration ?? "2 months"}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Avg. Fill Rate</p>
          <p className="mt-1 text-2xl font-bold">
            {courses.length
              ? Math.round(
                  (courses.reduce((sum, c) => sum + c.enrolled / Math.max(c.capacity, 1), 0) /
                    courses.length) *
                    100
                )
              : 0}
            %
          </p>
        </Card>
      </div>

      <div className="mb-6">
        <SearchInput
          placeholder="Search courses..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "title", label: "Course" },
          { key: "category", label: "Category" },
          { key: "level", label: "Level" },
          { key: "enrolled", label: "Enrolled" },
          { key: "instructor", label: "Tutor" },
          { key: "structure", label: "Progress targets" },
          { key: "status", label: "Status" },
          ...(canEdit ? [{ key: "actions", label: "" }] : []),
        ]}
      >
        {filtered.map((course) => (
          <TableRow key={course.id}>
            <TableCell>
              <div>
                <p className="font-medium">{course.title}</p>
                <p className="text-xs text-muted">{course.duration}</p>
              </div>
            </TableCell>
            <TableCell>{course.category}</TableCell>
            <TableCell>
              <Badge
                variant={
                  course.level === "Beginner"
                    ? "info"
                    : course.level === "Intermediate"
                      ? "accent"
                      : "default"
                }
              >
                {course.level}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-muted" />
                <span>
                  {course.enrolled}/{course.capacity}
                </span>
              </div>
            </TableCell>
            <TableCell>{course.instructor}</TableCell>
            <TableCell>
              <p className="max-w-[240px] text-xs leading-snug text-muted">
                {courseStructureSummary(course)}
              </p>
              {!isCourseReadyToActivate(course) && (
                <p className="mt-1 text-[11px] font-medium text-amber-700">Needs structure before active</p>
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  course.status === "active"
                    ? "success"
                    : course.status === "draft"
                      ? "warning"
                      : "default"
                }
              >
                {course.status}
              </Badge>
            </TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(course)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      coursesStore.remove(course.id);
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

      <Modal
        open={open}
        title={editing ? "Edit course" : "Create course"}
        onClose={closeModal}
        wide
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
          <Field label="Category">
            <input
              required
              className={fieldClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <select
                className={fieldClass}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as Course["level"] })}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </Field>
            <Field label="Duration (weeks)">
              <input
                type="number"
                min={1}
                required
                className={fieldClass}
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: Number(e.target.value) })}
              />
            </Field>
          </div>
          <p className="text-xs font-medium text-foreground">Progress targets (required before active)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Classes to attend">
              <input
                type="number"
                min={1}
                required
                className={fieldClass}
                value={form.classCount}
                onChange={(e) => setForm({ ...form, classCount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tests">
              <input
                type="number"
                min={0}
                required
                className={fieldClass}
                value={form.testCount}
                onChange={(e) => setForm({ ...form, testCount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Exams">
              <input
                type="number"
                min={0}
                required
                className={fieldClass}
                value={form.examCount}
                onChange={(e) => setForm({ ...form, examCount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Final exam">
              <select
                className={fieldClass}
                value={form.hasFinalExam ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, hasFinalExam: e.target.value === "yes" })}
              >
                <option value="yes">Required</option>
                <option value="no">Not required</option>
              </select>
            </Field>
          </div>
          <Field label="Tutor / instructor">
            <input
              required
              className={fieldClass}
              value={form.instructor}
              onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity">
              <input
                type="number"
                min={1}
                className={fieldClass}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Course["status"] })}
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
            </Field>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
