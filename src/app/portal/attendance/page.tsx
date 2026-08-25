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
import { Check, Clock, Download, Plus, Users, X } from "lucide-react";
import {
  attendanceStore,
  learnersStore,
  saveBulkAttendance,
  scheduleStore,
  coursesStore,
  useStoreList,
  uid,
  exportCsv,
  allCourseTitles,
  datesInRange,
  monthRange,
  type AttendanceRecord,
  type Learner,
} from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_AWARD_MONTHS,
  attendanceAwardWindow,
  attendanceCountsForAward,
  attendanceSummary,
  awardedAttendance,
} from "@/lib/academics";

type Mark = AttendanceRecord["status"];

const STATUSES: { value: Mark; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, refresh] = useStoreList(attendanceStore.getAll, attendanceStore.key);
  const [learners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [sessions] = useStoreList(scheduleStore.getAll, scheduleStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    learnerId: "",
    course: "",
    date: new Date().toISOString().slice(0, 10),
    status: "present" as Mark,
  });

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const courseOptions = useMemo(() => {
    const set = new Set<string>(allCourseTitles());
    for (const c of courses) if (c.title) set.add(c.title);
    for (const l of learners) if (l.course) set.add(l.course);
    for (const s of sessions) if (s.course) set.add(s.course);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [courses, learners, sessions]);

  const [bulkDate, setBulkDate] = useState(today);
  const [bulkEnd, setBulkEnd] = useState(today);
  const [bulkMonth, setBulkMonth] = useState(thisMonth);
  const [periodMode, setPeriodMode] = useState<"day" | "month">("day");
  const [bulkCourse, setBulkCourse] = useState("");
  const [bulkQuery, setBulkQuery] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [bulkNotice, setBulkNotice] = useState("");

  const canMark = user?.role === "super_admin" || user?.role === "tutor";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("dreyz_attendance_reset_v2")) return;
    attendanceStore.replaceAll([]);
    localStorage.setItem("dreyz_attendance_reset_v2", "1");
    refresh();
  }, [refresh]);

  const roster = useMemo(
    () => learners.filter((l) => l.status === "active"),
    [learners]
  );

  const selectedCourse = bulkCourse || courseOptions[0] || "Professional Interior Design Programme";

  const bulkRoster = useMemo(() => {
    const q = bulkQuery.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [roster, bulkQuery]);

  const markFor = (learner: Learner): Mark => {
    if (marks[learner.id]) return marks[learner.id];
    const existing = records.find(
      (r) =>
        r.learnerId === learner.id &&
        r.date === bulkDate &&
        r.course === selectedCourse
    );
    return existing?.status ?? "present";
  };

  const scoped = useMemo(() => {
    if (user?.role === "student" && user.learnerId) {
      return records.filter((r) => r.learnerId === user.learnerId);
    }
    return records;
  }, [records, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (r) =>
        r.learnerName.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.learnerId.toLowerCase().includes(q)
    );
  }, [scoped, query]);

  const learnerById = useMemo(() => {
    const map = new Map(learners.map((l) => [l.id, l]));
    return map;
  }, [learners]);

  const awarded = useMemo(() => {
    if (user?.role === "student" && user.learnerId) {
      const enrolled = learnerById.get(user.learnerId)?.enrollmentDate;
      return awardedAttendance(scoped, enrolled);
    }
    return scoped.filter((r) =>
      attendanceCountsForAward(r.date, learnerById.get(r.learnerId)?.enrollmentDate)
    );
  }, [scoped, user, learnerById]);

  const present = awarded.filter((a) => a.status === "present").length;
  const absent = awarded.filter((a) => a.status === "absent").length;
  const late = awarded.filter((a) => a.status === "late").length;
  const studentStats = attendanceSummary(awarded);

  const bulkCounts = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0 };
    for (const learner of bulkRoster) {
      const existing = records.find(
        (r) =>
          r.learnerId === learner.id &&
          r.date === bulkDate &&
          r.course === selectedCourse
      );
      const status = marks[learner.id] ?? existing?.status ?? "present";
      counts[status] += 1;
    }
    return counts;
  }, [bulkRoster, marks, records, bulkDate, selectedCourse]);

  const onMark = (e: FormEvent) => {
    e.preventDefault();
    const learner = learners.find((l) => l.id === form.learnerId);
    if (!learner) return;
    attendanceStore.upsert({
      id: uid("ATT"),
      learnerId: learner.id,
      learnerName: learner.name,
      course: form.course || learner.course,
      date: form.date,
      status: form.status,
    });
    const counts = attendanceCountsForAward(form.date, learner.enrollmentDate);
    refresh();
    setOpen(false);
    const { from, to } = attendanceAwardWindow(learner.enrollmentDate);
    setBulkNotice(
      counts
        ? `Saved attendance for ${learner.name}.`
        : `Saved, but ${form.date} is outside ${learner.name}'s ${ATTENDANCE_AWARD_MONTHS}-month window (${from} to ${to}) and will not count toward progress.`
    );
  };

  const setStatus = (record: AttendanceRecord, status: Mark) => {
    if (!canMark) return;
    attendanceStore.upsert({ ...record, status });
    refresh();
  };

  const setAllMarks = (status: Mark) => {
    const next: Record<string, Mark> = {};
    for (const learner of bulkRoster) next[learner.id] = status;
    setMarks((prev) => ({ ...prev, ...next }));
  };

  const periodDates = useMemo(() => {
    if (periodMode === "month") {
      const range = monthRange(bulkMonth);
      return datesInRange(range.from, range.to);
    }
    return datesInRange(bulkDate, bulkEnd || bulkDate);
  }, [periodMode, bulkMonth, bulkDate, bulkEnd]);

  const saveBulk = () => {
    if (!bulkRoster.length) return;
    const allEntries = periodDates.flatMap((date) =>
      bulkRoster.map((learner) => ({
        learnerId: learner.id,
        learnerName: learner.name,
        course: selectedCourse,
        date,
        status: markFor(learner),
        enrollmentDate: learner.enrollmentDate,
      }))
    );
    const awardedEntries = allEntries.filter((e) =>
      attendanceCountsForAward(e.date, e.enrollmentDate)
    );
    const skipped = allEntries.length - awardedEntries.length;
    saveBulkAttendance(
      awardedEntries.map(({ learnerId, learnerName, course, date, status }) => ({
        learnerId,
        learnerName,
        course,
        date,
        status,
      }))
    );
    setMarks({});
    refresh();
    setBulkNotice(
      `Awarded ${awardedEntries.length} mark${awardedEntries.length === 1 ? "" : "s"} in the first ${ATTENDANCE_AWARD_MONTHS} months from each learner's enrolment (${bulkCounts.present} present, ${bulkCounts.late} late, ${bulkCounts.absent} absent).${
        skipped ? ` ${skipped} day${skipped === 1 ? "" : "s"} outside that window were not saved.` : ""
      }`
    );
  };

  const resetAttendance = (scope: "all" | "period") => {
    if (!canMark) return;
    if (scope === "all") {
      if (!confirm("Clear every attendance mark in the school?")) return;
      attendanceStore.replaceAll([]);
    } else {
      if (!confirm(`Clear attendance for ${selectedCourse} from ${periodDates[0]} to ${periodDates[periodDates.length - 1]}?`)) return;
      const dates = new Set(periodDates);
      attendanceStore.replaceAll(
        records.filter((r) => !(r.course === selectedCourse && dates.has(r.date)))
      );
    }
    setMarks({});
    refresh();
    setBulkNotice(scope === "all" ? "All attendance marks were cleared." : "Attendance for this period was cleared.");
  };

  const onExport = () => {
    exportCsv("attendance.csv", [
      ["Learner", "ID", "Course", "Date", "Status"],
      ...filtered.map((r) => [r.learnerName, r.learnerId, r.course, r.date, r.status]),
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Track live sessions and workshops. Only the first ${ATTENDANCE_AWARD_MONTHS} months from a learner's enrolment date count toward class progress.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download size={14} /> Export Report
            </Button>
            {canMark && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus size={14} /> Mark one
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted">Present</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{present}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Late</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{late}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Absent</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{absent}</p>
        </Card>
      </div>

      {user?.role === "student" && (
        <Card className="mb-8" title="Your attendance record">
          <p className="text-sm text-muted">
            {studentStats.present} present · {studentStats.late} late · {studentStats.absent} absent
            {studentStats.total ? ` · ${studentStats.total} sessions` : ""}
          </p>
          <p className="mt-2 text-sm">
            Strikes (absence or two lates):{" "}
            <span className="font-semibold text-foreground">{studentStats.strikes}</span>
            . Four absences can lead to suspension — speak with your tutor if you need to catch up.
            Only the first {ATTENDANCE_AWARD_MONTHS} months from your enrolment date count.
          </p>
        </Card>
      )}

      {canMark && (
        <Card
          className="mb-8"
          title="Bulk attendance"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Users size={13} /> {bulkRoster.length} on roll
            </span>
          }
        >
          <p className="mb-4 text-sm text-muted">
            Mark one day or a date range. Days after a learner&apos;s {ATTENDANCE_AWARD_MONTHS}-month enrolment window are not awarded.
          </p>

          {bulkNotice && (
            <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {bulkNotice}
            </p>
          )}

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Period
              <select
                className={`${fieldClass} mt-1.5`}
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as "day" | "month")}
              >
                <option value="day">One day / date range</option>
                <option value="month">Full month</option>
              </select>
            </label>
            {periodMode === "month" ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Month
                <input
                  type="month"
                  className={`${fieldClass} mt-1.5`}
                  value={bulkMonth}
                  onChange={(e) => {
                    setBulkMonth(e.target.value);
                    setMarks({});
                  }}
                />
              </label>
            ) : (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  From
                  <input
                    type="date"
                    className={`${fieldClass} mt-1.5`}
                    value={bulkDate}
                    onChange={(e) => {
                      setBulkDate(e.target.value);
                      if (e.target.value > bulkEnd) setBulkEnd(e.target.value);
                      setMarks({});
                    }}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  To
                  <input
                    type="date"
                    className={`${fieldClass} mt-1.5`}
                    value={bulkEnd}
                    onChange={(e) => {
                      setBulkEnd(e.target.value);
                      setMarks({});
                    }}
                  />
                </label>
              </>
            )}
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2">
              Course
              <select
                className={`${fieldClass} mt-1.5`}
                value={selectedCourse}
                onChange={(e) => {
                  setBulkCourse(e.target.value);
                  setMarks({});
                }}
              >
                {courseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Find learner
              <input
                className={`${fieldClass} mt-1.5`}
                placeholder="Name or ID"
                value={bulkQuery}
                onChange={(e) => setBulkQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAllMarks("present")}>
              <Check size={13} /> All present
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAllMarks("late")}>
              <Clock size={13} /> All late
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAllMarks("absent")}>
              <X size={13} /> All absent
            </Button>
            <span className="ml-auto text-xs text-muted">
              {periodDates.length} day{periodDates.length === 1 ? "" : "s"} · {bulkCounts.present} present · {bulkCounts.late} late · {bulkCounts.absent} absent
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => resetAttendance("period")}>
              Reset this period
            </Button>
            {user?.role === "super_admin" && (
              <Button type="button" size="sm" variant="outline" onClick={() => resetAttendance("all")}>
                Reset all scores
              </Button>
            )}
            <Button type="button" size="sm" onClick={saveBulk} disabled={!bulkRoster.length}>
              Save class roll
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Learner
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Course
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bulkRoster.map((learner) => {
                  const status = markFor(learner);
                  return (
                    <tr key={learner.id} className="hover:bg-surface/70">
                      <td className="px-4 py-3">
                        <p className="font-medium">{learner.name}</p>
                        <p className="text-xs text-muted">{learner.id}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{learner.course}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setMarks((prev) => ({ ...prev, [learner.id]: option.value }))
                              }
                              className={cn(
                                "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                                status === option.value
                                  ? option.value === "present"
                                    ? "bg-emerald-600 text-white"
                                    : option.value === "late"
                                      ? "bg-amber-500 text-white"
                                      : "bg-red-600 text-white"
                                  : "border border-border bg-card text-muted hover:text-foreground"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {bulkRoster.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">No active learners match this roll.</p>
            )}
          </div>
        </Card>
      )}

      <div className="mb-6">
        <SearchInput
          placeholder="Search attendance records..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "learner", label: "Learner" },
          { key: "course", label: "Course" },
          { key: "date", label: "Date" },
          { key: "award", label: "Counts" },
          { key: "status", label: "Status" },
        ]}
      >
        {filtered.map((record) => {
          const counts = attendanceCountsForAward(
            record.date,
            learnerById.get(record.learnerId)?.enrollmentDate
          );
          return (
          <TableRow key={record.id}>
            <TableCell>
              <div>
                <p className="font-medium">{record.learnerName}</p>
                <p className="text-xs text-muted">{record.learnerId}</p>
              </div>
            </TableCell>
            <TableCell>{record.course}</TableCell>
            <TableCell className="text-muted">{record.date}</TableCell>
            <TableCell>
              <Badge variant={counts ? "success" : "default"}>
                {counts ? "Awarded" : "Outside 6 months"}
              </Badge>
            </TableCell>
            <TableCell>
              {canMark ? (
                <select
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  value={record.status}
                  onChange={(e) =>
                    setStatus(record, e.target.value as Mark)
                  }
                >
                  <option value="present">present</option>
                  <option value="late">late</option>
                  <option value="absent">absent</option>
                </select>
              ) : (
                <Badge
                  variant={
                    record.status === "present"
                      ? "success"
                      : record.status === "late"
                        ? "warning"
                        : "danger"
                  }
                >
                  {record.status}
                </Badge>
              )}
            </TableCell>
          </TableRow>
          );
        })}
      </DataTable>

      <Modal open={open} title="Mark attendance" onClose={() => setOpen(false)}>
        <form onSubmit={onMark} className="space-y-3">
          <Field label="Learner">
            <select
              required
              className={fieldClass}
              value={form.learnerId}
              onChange={(e) => {
                const l = learners.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  learnerId: e.target.value,
                  course: l?.course ?? form.course,
                });
              }}
            >
              <option value="">Select learner</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Course">
            <select
              required
              className={fieldClass}
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
            >
              <option value="">Select course</option>
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              required
              type="date"
              className={fieldClass}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className={fieldClass}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as Mark })
              }
            >
              <option value="present">present</option>
              <option value="late">late</option>
              <option value="absent">absent</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
