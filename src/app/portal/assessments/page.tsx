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
import { Plus, Trash2 } from "lucide-react";
import {
  assessmentsStore,
  gradesStore,
  learnersStore,
  uid,
  useStoreList,
  type Assessment,
} from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AssessmentsPage() {
  const { user } = useAuth();
  const [assessments, refresh] = useStoreList(assessmentsStore.getAll, assessmentsStore.key);
  const [grades, refreshGrades] = useStoreList(gradesStore.getAll, gradesStore.key);
  const [learners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<Assessment | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    course: "",
    type: "test" as Assessment["type"],
    date: new Date().toISOString().slice(0, 10),
    maxScore: 100,
  });

  const canEdit = user?.role === "super_admin" || user?.role === "tutor";
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
  };

  const bumpSubmission = (a: Assessment) => {
    if (!canEdit && user?.role !== "student") return;
    assessmentsStore.upsert({ ...a, submissions: a.submissions + 1 });
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Tests, exams, and the final exam. Marks here count toward the Super Admin course progress targets."
        action={
          canEdit ? (
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
                <Button size="sm" variant="outline" onClick={() => bumpSubmission(assessment)}>
                  {user?.role === "student" ? "Submit" : "+1 submit"}
                </Button>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setMarking(assessment);
                    const next: Record<string, string> = {};
                    for (const l of learnersStore.getAll()) {
                      const g = gradesStore
                        .getAll()
                        .find((row) => row.assessmentId === assessment.id && row.learnerId === l.id);
                      next[l.id] = g ? String(g.score) : "";
                    }
                    setScoreDrafts(next);
                  }}>
                    Enter marks
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      assessmentsStore.remove(assessment.id);
                      refresh();
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <Modal open={open} title="Create assessment" onClose={() => setOpen(false)}>
        <form onSubmit={onCreate} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Course">
            <input required className={fieldClass} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
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

      <Modal
        open={!!marking}
        title={marking ? `Marks · ${marking.title}` : "Marks"}
        onClose={() => setMarking(null)}
      >
        {marking && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {learners.map((learner) => (
              <div key={learner.id} className="flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate text-sm">{learner.name}</p>
                <input
                  type="number"
                  min={0}
                  max={marking.maxScore}
                  className={`${fieldClass} w-24`}
                  value={scoreDrafts[learner.id] ?? ""}
                  onChange={(e) =>
                    setScoreDrafts((prev) => ({ ...prev, [learner.id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setMarking(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!marking) return;
                  const rows = learners
                    .map((learner) => {
                      const raw = scoreDrafts[learner.id];
                      if (raw === undefined || raw === "") return null;
                      const score = Number(raw);
                      if (Number.isNaN(score)) return null;
                      const existing = grades.find(
                        (g) => g.assessmentId === marking.id && g.learnerId === learner.id
                      );
                      return {
                        id: existing?.id ?? uid("GRD"),
                        assessmentId: marking.id,
                        learnerId: learner.id,
                        learnerName: learner.name,
                        title: marking.title,
                        course: marking.course,
                        type: marking.type,
                        score,
                        maxScore: marking.maxScore,
                        date: new Date().toISOString().slice(0, 10),
                      };
                    })
                    .filter((row) => row !== null);
                  gradesStore.upsertMany(rows);
                  assessmentsStore.upsert({
                    ...marking,
                    submissions: rows.length,
                  });
                  refresh();
                  refreshGrades();
                  setMarking(null);
                }}
              >
                Save marks
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
