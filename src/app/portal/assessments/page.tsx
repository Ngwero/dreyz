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
import { Modal, Field, fieldClass, ConfirmDialog } from "@/components/ui/Modal";
import { Plus, Trash2, X } from "lucide-react";
import {
  assessmentsStore,
  coursesStore,
  gradesStore,
  learnersStore,
  uid,
  useStoreList,
  type Assessment,
} from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";
import { getAllUsers } from "@/lib/auth";
import { IntakeFilterTabs } from "@/components/portal/IntakeFilterTabs";
import { resolveLearnerIntake } from "@/lib/intakes";
import { syncLearnerProgress } from "@/lib/academics";

type MarkStudent = { id: string; name: string; course: string; intake: string };

export default function AssessmentsPage() {
  const { user } = useAuth();
  const [assessments, refresh] = useStoreList(assessmentsStore.getAll, assessmentsStore.key);
  const [grades, refreshGrades] = useStoreList(gradesStore.getAll, gradesStore.key);
  const [learners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<Assessment | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [markQuery, setMarkQuery] = useState("");
  const [courseOnly, setCourseOnly] = useState(false);
  const [intakeFilter, setIntakeFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<Assessment | null>(null);
  const [form, setForm] = useState({
    title: "",
    course: "",
    type: "test" as Assessment["type"],
    date: new Date().toISOString().slice(0, 10),
    maxScore: 100,
  });

  const canCreate = user?.role === "super_admin";
  const canMark = user?.role === "super_admin" || user?.role === "tutor";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.course.toLowerCase().includes(q) ||
        a.type.includes(q)
    );
  }, [assessments, query]);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    assessmentsStore.upsert({
      id: uid("ASM"),
      title: form.title.trim(),
      course: form.course.trim(),
      type: form.type,
      date: form.date,
      maxScore: Number(form.maxScore) || 100,
      submissions: 0,
    });
    refresh();
    setOpen(false);
    showFlash("success", `${form.title.trim()} was created.`);
  };

  const bumpSubmission = (a: Assessment) => {
    if (!canCreate && user?.role !== "student") return;
    assessmentsStore.upsert({ ...a, submissions: a.submissions + 1 });
    refresh();
  };

  const markStudents = useMemo(() => {
    const byId = new Map<string, MarkStudent>();
    for (const learner of learners) {
      byId.set(learner.id, {
        id: learner.id,
        name: learner.name,
        course: learner.course,
        intake: resolveLearnerIntake(learner),
      });
    }
    for (const account of getAllUsers()) {
      if (account.role !== "student") continue;
      const id = account.learnerId || account.id;
      const existing = byId.get(id);
      if (existing) {
        if (!existing.name) existing.name = account.name;
        continue;
      }
      const linked = learners.find(
        (l) =>
          l.id === account.learnerId ||
          l.email.toLowerCase() === account.email.toLowerCase()
      );
      byId.set(id, {
        id,
        name: account.name,
        course: linked?.course || account.specialty || "",
        intake: linked ? resolveLearnerIntake(linked) : "",
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [learners]);

  const markingRoster = useMemo(() => {
    if (!marking) return [];
    const q = markQuery.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const course = marking.course.trim().toLowerCase();
    return markStudents.filter((student) => {
      if (tokens.length) {
        const haystack = [student.name, student.id, student.course, student.intake]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      }
      if (intakeFilter !== "all" && student.intake !== intakeFilter) return false;
      if (courseOnly && course) {
        const match =
          student.course.toLowerCase() === course ||
          student.course.toLowerCase().includes(course) ||
          course.includes(student.course.toLowerCase());
        if (!match) return false;
      }
      return true;
    });
  }, [marking, markStudents, markQuery, courseOnly, intakeFilter]);

  const openMarks = (assessment: Assessment) => {
    setMarking(assessment);
    setMarkQuery("");
    setCourseOnly(false);
    setIntakeFilter("all");
    const next: Record<string, string> = {};
    const roster = markStudents.length
      ? markStudents
      : learnersStore.getAll().map((l) => ({
          id: l.id,
          name: l.name,
          course: l.course,
          intake: resolveLearnerIntake(l),
        }));
    const saved = gradesStore.getAll();
    for (const student of roster) {
      const g = saved.find(
        (row) => row.assessmentId === assessment.id && row.learnerId === student.id
      );
      next[student.id] = g ? String(g.score) : "";
    }
    setScoreDrafts(next);
  };

  const saveMarks = () => {
    if (!marking) return;
    const rows = markingRoster
      .map((student) => {
        const raw = scoreDrafts[student.id];
        if (raw === undefined || raw === "") return null;
        const score = Number(raw);
        if (Number.isNaN(score)) return null;
        const existing = grades.find(
          (g) => g.assessmentId === marking.id && g.learnerId === student.id
        );
        return {
          id: existing?.id ?? uid("GRD"),
          assessmentId: marking.id,
          learnerId: student.id,
          learnerName: student.name,
          title: marking.title,
          course: marking.course,
          type: marking.type,
          score,
          maxScore: marking.maxScore,
          date: new Date().toISOString().slice(0, 10),
          recordedAt: new Date().toISOString(),
        };
      })
      .filter((row) => row !== null);
    gradesStore.upsertMany(rows);
    assessmentsStore.upsert({
      ...marking,
      submissions: Math.max(marking.submissions, rows.length),
    });
    syncLearnerProgress(rows.map((r) => r.learnerId));
    refresh();
    refreshGrades();
    setMarking(null);
    showFlash("success", `Marks saved for ${marking.title} (${rows.length} student${rows.length === 1 ? "" : "s"}). Progress bars updated.`);
  };

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Tests, exams, and the final exam. Marks and scores here update each learner’s progress bar (score quality counts, not only presence of a mark)."
        action={
          canCreate ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Create Assessment
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search assessments..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          { key: "title", label: "Assessment" },
          { key: "course", label: "Course" },
          { key: "type", label: "Type" },
          { key: "date", label: "Due Date" },
          { key: "submissions", label: "Submissions" },
          { key: "maxScore", label: "Max Score" },
          { key: "actions", label: "" },
        ]}
      >
        {filtered.map((assessment) => (
          <TableRow key={assessment.id}>
            <TableCell className="font-medium">{assessment.title}</TableCell>
            <TableCell className="max-w-[200px] truncate">{assessment.course}</TableCell>
            <TableCell>
              <Badge
                variant={
                  assessment.type === "test" || assessment.type === "quiz"
                    ? "info"
                    : assessment.type === "exam"
                      ? "accent"
                      : assessment.type === "final"
                        ? "default"
                        : "accent"
                }
              >
                {assessment.type}
              </Badge>
            </TableCell>
            <TableCell className="text-muted">{assessment.date}</TableCell>
            <TableCell>
              {user?.role === "student"
                ? (() => {
                    const mine = grades.find(
                      (g) =>
                        g.assessmentId === assessment.id &&
                        g.learnerId === user.learnerId
                    );
                    return mine ? `${mine.score}/${mine.maxScore}` : "Not marked";
                  })()
                : assessment.submissions}
            </TableCell>
            <TableCell>{assessment.maxScore}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                {user?.role === "student" && (
                  <Button size="sm" variant="outline" onClick={() => bumpSubmission(assessment)}>
                    Submit
                  </Button>
                )}
                {canMark && (
                  <Button size="sm" variant="outline" onClick={() => openMarks(assessment)}>
                    Enter marks
                  </Button>
                )}
                {canCreate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingDelete(assessment)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      {canMark && marking && (
        <Card
          className="mt-8"
          title={`Score students · ${marking.title}`}
          action={
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
              onClick={() => setMarking(null)}
              aria-label="Close mark sheet"
            >
              <X size={16} />
            </button>
          }
        >
          <p className="mb-4 text-sm text-muted">
            Filter by intake so May, September, and January cohorts are scored separately. Marks show
            on each student&apos;s portal and under Learners.
          </p>
          <IntakeFilterTabs
            learners={learners}
            value={intakeFilter}
            onChange={setIntakeFilter}
            className="mb-4"
          />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Find student
              <input
                className={`${fieldClass} mt-1.5`}
                placeholder="Name or admission number…"
                value={markQuery}
                onChange={(e) => setMarkQuery(e.target.value)}
                autoFocus
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={courseOnly}
                onChange={(e) => setCourseOnly(e.target.checked)}
              />
              Only {marking.course || "this course"}
            </label>
          </div>
          {markingRoster.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-sm text-muted">
              No student names to score yet. Add learners under Learners, or grant a student portal login, then come back here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Student
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      ID
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Intake
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Course
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Mark / {marking.maxScore}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {markingRoster.map((student) => (
                    <tr key={student.id} className="hover:bg-surface/70">
                      <td className="px-4 py-3 font-medium text-foreground">{student.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{student.id}</td>
                      <td className="px-4 py-3 text-xs text-muted">{student.intake || "—"}</td>
                      <td className="px-4 py-3 text-muted">{student.course || "—"}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={marking.maxScore}
                          className={`${fieldClass} ml-auto w-28 text-right`}
                          placeholder="Mark"
                          value={scoreDrafts[student.id] ?? ""}
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({ ...prev, [student.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMarking(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveMarks} disabled={markingRoster.length === 0}>
              Save marks
            </Button>
          </div>
        </Card>
      )}

      <Modal open={open} title="Create assessment" onClose={() => setOpen(false)}>
        <form onSubmit={onCreate} className="space-y-3">
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
            <Field label="Type">
              <select className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Assessment["type"] })}>
                <option value="test">test</option>
                <option value="exam">exam</option>
                <option value="final">final exam</option>
                <option value="quiz">quiz (counts as a test)</option>
                <option value="project">project</option>
              </select>
            </Field>
            <Field label="Max score">
              <input type="number" min={1} className={fieldClass} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Due date">
            <input type="date" className={fieldClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete assessment"
        description={`Delete “${pendingDelete?.title ?? ""}”? Marks for this assessment will stay on the grade list unless you remove them separately.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          assessmentsStore.remove(pendingDelete.id);
          refresh();
          showFlash("success", `${pendingDelete.title} was deleted.`);
        }}
      />
    </div>
  );
}
