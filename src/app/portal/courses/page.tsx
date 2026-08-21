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
import { Plus, Users, Trash2 } from "lucide-react";
import { programme } from "@/lib/data";
import { coursesStore, useStoreList, uid, type Course } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, refresh] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "Foundations",
    level: "Beginner" as Course["level"],
    duration: "2 weeks",
    capacity: 100,
    instructor: "",
  });

  const canEdit = user?.role === "super_admin" || user?.role === "tutor";
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

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    coursesStore.upsert({
      id: uid("CRS"),
      title: form.title.trim(),
      category: form.category.trim(),
      level: form.level,
      duration: form.duration.trim(),
      enrolled: 0,
      capacity: Number(form.capacity) || 100,
      instructor: form.instructor.trim() || "Staff",
      status: "active",
      price: 0,
    });
    refresh();
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Courses"
        description={`${programme.name}: ${programme.courseworkUnits} units plus a ${programme.internshipMonths}-month internship.`}
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setOpen(true)}>
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
          { key: "instructor", label: "Instructor" },
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
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <Modal open={open} title="Create course" onClose={() => setOpen(false)}>
        <form onSubmit={onCreate} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <input required className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <select className={fieldClass} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Course["level"] })}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </Field>
            <Field label="Duration">
              <input className={fieldClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
          </div>
          <Field label="Instructor">
            <input required className={fieldClass} value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
          </Field>
          <Field label="Capacity">
            <input type="number" min={1} className={fieldClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
