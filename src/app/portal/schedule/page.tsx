"use client";

import { FormEvent, useState } from "react";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Calendar, Clock, User, Trash2 } from "lucide-react";
import {
  scheduleStore,
  coursesStore,
  useStoreList,
  uid,
  downloadIcs,
  type ScheduleItem,
} from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

const typeColors = {
  live: "info" as const,
  workshop: "accent" as const,
  review: "success" as const,
  physical: "warning" as const,
};

export default function SchedulePage() {
  const { user } = useAuth();
  const [items, refresh] = useStoreList(scheduleStore.getAll, scheduleStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    course: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    type: "live" as ScheduleItem["type"],
    instructor: user?.name ?? "",
  });

  const canEdit = user?.role === "super_admin";

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    scheduleStore.upsert({
      id: uid("SCH"),
      title: form.title.trim(),
      course: form.course.trim(),
      date: form.date,
      time: form.time,
      type: form.type,
      instructor: form.instructor.trim() || "Staff",
    });
    refresh();
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Course Schedule"
        description="Live, physical, workshop, and project review sessions."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Add Session
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-navy text-white">
                  <span className="text-xs font-medium uppercase">
                    {new Date(item.date).toLocaleString("en", { month: "short" })}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {new Date(item.date).getDate()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <Badge variant={typeColors[item.type]}>{item.type}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{item.course}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {item.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} /> {item.instructor}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadIcs(item)}>
                  <Calendar size={14} /> Add to Calendar
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      scheduleStore.remove(item.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} title="Add session" onClose={() => setOpen(false)}>
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Course">
            <select
              required
              className={fieldClass}
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input required type="date" className={fieldClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Time">
              <input required className={fieldClass} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
          </div>
          <Field label="Type">
            <select className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ScheduleItem["type"] })}>
              <option value="live">live</option>
              <option value="physical">physical</option>
              <option value="workshop">workshop</option>
              <option value="review">review</option>
            </select>
          </Field>
          <Field label="Instructor">
            <input required className={fieldClass} value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save session</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
