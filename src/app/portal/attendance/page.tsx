"use client";

import { useMemo, useState } from "react";
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
import { fieldClass, ConfirmDialog } from "@/components/ui/Modal";
import { Check, Clock, Download, Users, X } from "lucide-react";
import {
  attendanceStore,
  learnersStore,
  saveBulkAttendance,
  coursesStore,
  useStoreList,
  exportCsv,
  allCourseTitles,
  type AttendanceRecord,
  type Learner,
} from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_AWARD_MONTHS,
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
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);

  const today = new Date().toISOString().slice(0, 10);
  const courseOptions = useMemo(() => {
    const set = new Set<string>(allCourseTitles());
    for (const c of courses) if (c.title) set.add(c.title);
    for (const l of learners) if (l.course) set.add(l.course);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [courses, learners]);

  const [date, setDate] = useState(today);
  const [course, setCourse] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [historyQuery, setHistoryQuery] = useState("");
  const [pendingClear, setPendingClear] = useState(false);

  const canMark = user?.role === "super_admin" || user?.role === "tutor";
  const selectedCourse = course || courseOptions[0] || "Professional Interior Design Programme";

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const matchesSearch = (l: Learner) => {
      if (!tokens.length) return true;
      const haystack = [
        l.name,
        l.id,
        l.email,
        l.phone,
        l.course,
        resolveLearnerIntake(l),
      ]
        .join(" ")
        .toLowerCase();
      // Every typed word must appear somewhere (so "ama oka" finds "Amara Okafor")
      return tokens.every((token) => haystack.includes(token));
    };

    return learners.filter((l) => {
      if (q) {
        // Searching: look across all statuses and intakes
        return matchesSearch(l);
      }
      if (intakeFilter === "all") {
        if (l.status !== "active") return false;
      } else if (resolveLearnerIntake(l) !== intakeFilter) {
        return false;
      }
      return true;
    });
  }, [learners, intakeFilter, search]);

  const markFor = (learner: Learner): Mark => {
    if (marks[learner.id]) return marks[learner.id];
    const existing = records.find(
      (r) =>
        r.learnerId === learner.id &&
        r.date === date &&
        r.course === selectedCourse
    );
    return existing?.status ?? "present";
  };

  const counts = useMemo(() => {
    const out = { present: 0, late: 0, absent: 0 };
    for (const learner of roster) {
      const status =
        marks[learner.id] ??
        records.find(
          (r) =>
            r.learnerId === learner.id &&
            r.date === date &&
            r.course === selectedCourse
        )?.status ??
        "present";
      out[status] += 1;
    }
    return out;
  }, [roster, marks, records, date, selectedCourse]);

  const scopedHistory = useMemo(() => {
    if (user?.role === "student" && user.learnerId) {
      return records.filter((r) => r.learnerId === user.learnerId);
    }
    return records;
  }, [records, user]);

  const history = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const list = [...scopedHistory].sort((a, b) => b.date.localeCompare(a.date));
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (r) =>
          r.learnerName.toLowerCase().includes(q) ||
          r.learnerId.toLowerCase().includes(q) ||
          r.date.includes(q)
      )
      .slice(0, 40);
  }, [scopedHistory, historyQuery]);

  const learnerById = useMemo(
    () => new Map(learners.map((l) => [l.id, l])),
    [learners]
  );

  const awarded = useMemo(() => {
    if (user?.role === "student" && user.learnerId) {
      return awardedAttendance(
        scopedHistory,
        learnerById.get(user.learnerId)?.enrollmentDate
      );
    }
    return scopedHistory.filter((r) =>
      attendanceCountsForAward(r.date, learnerById.get(r.learnerId)?.enrollmentDate)
    );
  }, [scopedHistory, user, learnerById]);

  const summary = attendanceSummary(awarded);

  const setAll = (status: Mark) => {
    const next: Record<string, Mark> = {};
    for (const learner of roster) next[learner.id] = status;
    setMarks((prev) => ({ ...prev, ...next }));
  };

  const saveRoll = () => {
    if (!roster.length) return;
    saveBulkAttendance(
      roster.map((learner) => ({
        learnerId: learner.id,
        learnerName: learner.name,
        course: selectedCourse,
        date,
        status: markFor(learner),
      }))
    );
    setMarks({});
    refresh();
    const msg = `Saved attendance for ${roster.length} learner${roster.length === 1 ? "" : "s"} on ${date}.`;
    showFlash("success", msg, {
      category: "attendance",
      href: "/portal/attendance",
      learnerIds: roster.map((l) => l.id),
      emails: roster.map((l) => l.email),
      detail: `${selectedCourse} · ${date}`,
    });
  };

  const onExport = () => {
    exportCsv("attendance.csv", [
      ["Learner", "ID", "Course", "Date", "Status"],
      ...scopedHistory.map((r) => [
        r.learnerName,
        r.learnerId,
        r.course,
        r.date,
        r.status,
      ]),
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Mark Present, Late, or Absent for one class day. Present and Late in the first ${ATTENDANCE_AWARD_MONTHS} months count toward progress.`}
        action={
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download size={14} /> Export
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted">Present</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.present}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Late</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{summary.late}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Absent</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{summary.absent}</p>
        </Card>
      </div>

      {user?.role === "student" && (
        <Card className="mb-8" title="Your attendance">
          <p className="text-sm text-muted">
            {summary.present} present · {summary.late} late · {summary.absent} absent
            {summary.total ? ` · ${summary.total} sessions` : ""} · {summary.strikes} strike
            {summary.strikes === 1 ? "" : "s"}
          </p>
        </Card>
      )}

      {canMark && (
        <Card
          className="mb-8"
          title="Mark today’s class"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Users size={13} /> {roster.length} on roll
            </span>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Date
              <input
                type="date"
                className={`${fieldClass} mt-1.5`}
                value={date}
                min="2020-01-01"
                onChange={(e) => {
                  setDate(e.target.value);
                  setMarks({});
                }}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2">
              Course / class
              <select
                className={`${fieldClass} mt-1.5`}
                value={selectedCourse}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setMarks({});
                }}
              >
                {courseOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2 lg:col-span-1">
              Find learner
              <input
                type="search"
                className={`${fieldClass} mt-1.5`}
                placeholder="Name, email, or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>

          {!search.trim() && (
            <IntakeFilterTabs
              learners={learners}
              value={intakeFilter}
              onChange={(next) => {
                setIntakeFilter(next);
                setMarks({});
              }}
              className="mb-4"
            />
          )}
          {search.trim() && (
            <p className="mb-4 text-xs text-muted">
              Showing {roster.length} match{roster.length === 1 ? "" : "es"} for “{search.trim()}”
              (all intakes). Clear search to use intake tabs again.
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAll("present")}>
              <Check size={13} /> All present
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAll("late")}>
              <Clock size={13} /> All late
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAll("absent")}>
              <X size={13} /> All absent
            </Button>
            <span className="text-xs text-muted sm:ml-auto">
              {counts.present} present · {counts.late} late · {counts.absent} absent
            </span>
            <Button type="button" size="sm" onClick={saveRoll} disabled={!roster.length}>
              Save attendance
            </Button>
            {user?.role === "super_admin" && (
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingClear(true)}>
                Clear all
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Learner
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.map((learner) => {
                  const status = markFor(learner);
                  return (
                    <tr key={learner.id} className="hover:bg-surface/70">
                      <td className="px-4 py-3">
                        <p className="font-medium">{learner.name}</p>
                        <p className="text-xs text-muted">
                          {learner.id} · {resolveLearnerIntake(learner)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setMarks((prev) => ({
                                  ...prev,
                                  [learner.id]: option.value,
                                }))
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
            {roster.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">
                No learners on this roll. Pick another intake or search.
              </p>
            )}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent marks</h2>
          <p className="text-xs text-muted">Latest saved attendance records</p>
        </div>
        <SearchInput
          placeholder="Search history..."
          className="max-w-xs"
          value={historyQuery}
          onChange={(e) => setHistoryQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "learner", label: "Learner" },
          { key: "date", label: "Date" },
          { key: "status", label: "Status" },
        ]}
      >
        {history.map((record) => (
          <TableRow key={record.id}>
            <TableCell>
              <p className="font-medium">{record.learnerName}</p>
              <p className="text-xs text-muted">{record.learnerId}</p>
            </TableCell>
            <TableCell className="text-muted">{record.date}</TableCell>
            <TableCell>
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
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      {history.length === 0 && (
        <p className="mt-4 text-sm text-muted">No attendance saved yet.</p>
      )}

      <ConfirmDialog
        open={pendingClear}
        title="Clear all attendance"
        description="Clear every attendance mark in the school? This cannot be undone."
        confirmLabel="Clear all"
        onClose={() => setPendingClear(false)}
        onConfirm={() => {
          attendanceStore.replaceAll([]);
          setMarks({});
          refresh();
          showFlash("success", "All attendance marks were cleared.");
        }}
      />
    </div>
  );
}
