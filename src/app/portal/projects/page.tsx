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
import { Star, Plus } from "lucide-react";
import { projectsStore, useStoreList, uid, type Project } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, refresh] = useStoreList(projectsStore.getAll, projectsStore.key);
  const [query, setQuery] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    course: "",
    score: 80,
  });

  const canReview = user?.role === "super_admin" || user?.role === "tutor";
  const canSubmit = user?.role === "student" || canReview;

  const scoped = useMemo(() => {
    if (user?.role === "student" && user.learnerId) {
      return projects.filter((p) => p.learnerId === user.learnerId);
    }
    return projects;
  }, [projects, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.learnerName.toLowerCase().includes(q) ||
        p.course.toLowerCase().includes(q)
    );
  }, [scoped, query]);

  const viewing = projects.find((p) => p.id === viewId) ?? null;

  const setStatus = (project: Project, status: Project["status"]) => {
    if (!canReview) return;
    projectsStore.upsert({ ...project, status });
    refresh();
  };

  const setScore = (project: Project, score: number) => {
    if (!canReview) return;
    projectsStore.upsert({ ...project, score });
    refresh();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    projectsStore.upsert({
      id: uid("PRJ"),
      title: form.title.trim(),
      course: form.course.trim(),
      learnerId: user?.learnerId ?? "DRY-NEW",
      learnerName: user?.name ?? "Learner",
      score: canReview ? Number(form.score) || 0 : 0,
      status: "submitted",
    });
    refresh();
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Student Portfolio Projects"
        description="Review, score, and feature outstanding interior design projects."
        action={
          canSubmit ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> {user?.role === "student" ? "Submit project" : "Add project"}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search projects..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project) => (
          <div
            key={project.id}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
          >
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-accent/10 via-surface to-navy/5">
              <div className="text-center">
                <p className="text-4xl font-bold text-accent-dark/20">{project.score}%</p>
                {project.status === "featured" && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-accent">
                    <Star size={14} className="fill-accent" />
                    <span className="text-xs font-semibold">Featured</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-foreground">{project.title}</h3>
              <p className="mt-1 text-sm text-muted">{project.learnerName}</p>
              <p className="text-xs text-muted">{project.course}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge
                  variant={
                    project.status === "featured"
                      ? "accent"
                      : project.status === "reviewed"
                        ? "success"
                        : "default"
                  }
                >
                  {project.status}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setViewId(project.id)}>
                  View Project
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">All Submissions</h2>
        <DataTable
          columns={[
            { key: "title", label: "Project" },
            { key: "learner", label: "Learner" },
            { key: "course", label: "Course" },
            { key: "score", label: "Score" },
            { key: "status", label: "Status" },
          ]}
        >
          {filtered.map((project) => (
            <TableRow key={`row-${project.id}`}>
              <TableCell className="font-medium">{project.title}</TableCell>
              <TableCell>{project.learnerName}</TableCell>
              <TableCell className="max-w-[180px] truncate">{project.course}</TableCell>
              <TableCell className="font-semibold">{project.score}%</TableCell>
              <TableCell>
                <Badge
                  variant={
                    project.status === "featured"
                      ? "accent"
                      : project.status === "reviewed"
                        ? "success"
                        : "default"
                  }
                >
                  {project.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      <Modal open={!!viewing} title={viewing?.title ?? "Project"} onClose={() => setViewId(null)}>
        {viewing && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {viewing.learnerName} · {viewing.course}
            </p>
            <p className="text-3xl font-bold">{viewing.score}%</p>
            {canReview && (
              <>
                <Field label="Score">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={fieldClass}
                    value={viewing.score}
                    onChange={(e) => setScore(viewing, Number(e.target.value))}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStatus(viewing, "submitted")}>
                    Mark submitted
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(viewing, "reviewed")}>
                    Mark reviewed
                  </Button>
                  <Button size="sm" onClick={() => setStatus(viewing, "featured")}>
                    Feature
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={open} title="Submit project" onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Course">
            <input required className={fieldClass} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          </Field>
          {canReview && (
            <Field label="Score">
              <input type="number" min={0} max={100} className={fieldClass} value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} />
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
