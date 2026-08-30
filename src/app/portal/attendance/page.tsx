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
import { Modal, Field, fieldClass, ConfirmDialog } from "@/components/ui/Modal";
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
import { showFlash } from "@/lib/flash";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_AWARD_MONTHS,
  attendanceAwardWindow,
  attendanceCountsForAward,
  attendanceSummary,
  awardedAttendance,
} from "@/lib/academics";
import { IntakeFilterTabs } from "@/components/portal/IntakeFilterTabs";
import { resolveLearnerIntake } from "@/lib/intakes";

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
  const [intakeFilter, setIntakeFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [bulkNotice, setBulkNotice] = useState("");
  const [pendingReset, setPendingReset] = useState<"all" | "period" | null>(null);

  const canMark = user?.role === "super_admin" || user?.role === "tutor";

  /** Last 24 months for quick jump (includes previous year). */
  const recentMonths = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 24; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      out.push(`${y}-${m}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dreyz_attendance_reset_v2", "1");
  }, []);

  const roster = useMemo(() => {
    return learners.filter((l) => {
      if (!includeInactive && l.status !== "active") return false;
      if (intakeFilter !== "all" && resolveLearnerIntake(l) !== intakeFilter) return false;
      return true;
    });
  }, [learners, intakeFilter, includeInactive]);

  const selectedCourse = bulkCourse || courseOptions[0] || "Professional Interior Design Programme";

  const bulkRoster = useMemo(() => {
    const q = bulkQuery.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        resolveLearnerIntake(l).toLowerCase().includes(q)
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
    const course = form.course || learner.course;
    const existing = records.find(
      (r) =>
        r.learnerId === learner.id &&
        r.date === form.date &&
        r.course === course
    );
    attendanceStore.upsert({
      id: existing?.id ?? uid("ATT"),
      learnerId: learner.id,
      learnerName: learner.name,
      course,
      date: form.date,
      status: form.status,
      recordedAt: new Date().toISOString(),
    });
    const counts = attendanceCountsForAward(form.date, learner.enrollmentDate);
    refresh();
    setOpen(false);
    const { from, to } = attendanceAwardWindow(learner.enrollmentDate);
    const msg = counts
      ? `Saved attendance for ${learner.name} on ${form.date}.`
      : `Saved attendance for ${learner.name} on ${form.date}. Stored for the record (outside the ${ATTENDANCE_AWARD_MONTHS}-month progress window ${from}–${to}).`;
    setBulkNotice(msg);
    showFlash("success", msg, {
      category: "attendance",
      href: "/portal/attendance",
      learnerIds: [learner.id],
      emails: [learner.email],
      detail: `${course} · ${form.date} · ${form.status}`,
    });
  };

  const setStatus = (record: AttendanceRecord, status: Mark) => {
    if (!canMark) return;
    attendanceStore.upsert({ ...record, status, recordedAt: new Date().toISOString() });
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
    // Persist every mark so earlier months / other intakes are not lost.
    saveBulkAttendance(
      allEntries.map(({ learnerId, learnerName, course, date, status }) => ({
        learnerId,
        learnerName,
        course,
        date,
        status,
      }))
    );
    setMarks({});
    refresh();
    const msg = `Saved ${allEntries.length} class roll mark${allEntries.length === 1 ? "" : "s"} for ${periodDates[0] ?? "—"}${periodDates.length > 1 ? ` → ${periodDates[periodDates.length - 1]}` : ""} (${bulkCounts.present} present, ${bulkCounts.late} late, ${bulkCounts.absent} absent).${
      skipped
        ? ` ${skipped} are outside the ${ATTENDANCE_AWARD_MONTHS}-month progress window — still stored, not counted in progress %.`
        : ` All count toward progress.`
    }`;
    setBulkNotice(msg);
    showFlash("success", msg, {
      category: "attendance",
      href: "/portal/attendance",
      learnerIds: bulkRoster.map((l) => l.id),
      emails: bulkRoster.map((l) => l.email),
      detail: `${selectedCourse} · ${periodDates[0] ?? ""}${periodDates.length > 1 ? ` → ${periodDates[periodDates.length - 1]}` : ""}`,
    });
  };

  const resetAttendance = (scope: "all" | "period") => {
    if (!canMark) return;
    if (scope === "all") {
      attendanceStore.replaceAll([]);
    } else {
      const dates = new Set(periodDates);
      attendanceStore.replaceAll(
        records.filter((r) => !(r.course === selectedCourse && dates.has(r.date)))
      );
    }
    setMarks({});
    refresh();
    const msg = scope === "all" ? "All attendance marks were cleared." : "Attendance for this period was cleared.";
    setBulkNotice(msg);
    showFlash("success", msg);
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
        description="Mark class rolls for any day or month — including previous months and last year. Marks are always saved to the school record."
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
            Progress uses the first {ATTENDANCE_AWARD_MONTHS} months from your enrolment date.
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
            Choose any past month (including last year), a single day, or a date range. Every mark is
            saved. Progress % still uses only the first {ATTENDANCE_AWARD_MONTHS} months from each
            learner&apos;s enrolment — older rolls stay on the record.
          </p>

          <IntakeFilterTabs
            learners={includeInactive ? learners : learners.filter((l) => l.status === "active")}
            value={intakeFilter}
            onChange={(next) => {
              setIntakeFilter(next);
              setMarks({});
            }}
            className="mb-4"
          />

          <label className="mb-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setMarks({});
              }}
            />
            Include paused and completed learners (needed for earlier intakes)
          </label>

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
                <option value="month">Full month (any year)</option>
              </select>
            </label>
            {periodMode === "month" ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Month
                <input
                  type="month"
                  className={`${fieldClass} mt-1.5`}
                  value={bulkMonth}
                  min="2020-01"
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
                    min="2020-01-01"
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
                    min="2020-01-01"
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

          {periodMode === "month" && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {recentMonths.map((ym) => {
                const [y, m] = ym.split("-");
                const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en", {
                  month: "short",
                  year: "numeric",
                });
                return (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => {
                      setBulkMonth(ym);
                      setMarks({});
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      bulkMonth === ym
                        ? "bg-[#082878] text-white"
                        : "bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

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
            <Button type="button" size="sm" variant="outline" onClick={() => setPendingReset("period")}>
              Reset this period
            </Button>
            {user?.role === "super_admin" && (
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingReset("all")}>
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
                        <p className="text-xs text-muted">
                          {learner.id}
                          {learner.status !== "active" ? ` · ${learner.status}` : ""}
                        </p>
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
              <p className="px-4 py-6 text-sm text-muted">
                No learners match this roll. Try another intake or include paused/completed.
              </p>
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
                {counts ? "Counts to %" : "Record only"}
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
              min="2020-01-01"
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

      <ConfirmDialog
        open={pendingReset !== null}
        title={pendingReset === "all" ? "Clear all attendance" : "Clear this period"}
        description={
          pendingReset === "all"
            ? "Clear every attendance mark in the school? This cannot be undone."
            : `Clear attendance for ${selectedCourse} from ${periodDates[0] ?? "—"} to ${periodDates[periodDates.length - 1] ?? "—"}?`
        }
        confirmLabel="Clear marks"
        onClose={() => setPendingReset(null)}
        onConfirm={() => {
          if (pendingReset) resetAttendance(pendingReset);
        }}
      />
    </div>
  );
}
