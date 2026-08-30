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
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Download, Trash2, UserPlus, Pencil, Eye } from "lucide-react";
import {
  learnersStore,
  coursesStore,
  useStoreList,
  useLiveTick,
  exportCsv,
  type Learner,
} from "@/lib/store";
import { createAccount, getAllUsers, recordManualFee } from "@/lib/auth";
import { provisionPortalAccount } from "@/lib/auth-client";
import { showFlash } from "@/lib/flash";
import { useAuth } from "@/components/auth/AuthProvider";
import { computeLearnerProgress, feesForStudent } from "@/lib/academics";
import { LearnerProfile } from "@/components/portal/LearnerProfile";
import { IntakeFilterTabs } from "@/components/portal/IntakeFilterTabs";
import { formatUGX, cn } from "@/lib/utils";
import { feeTracks } from "@/lib/data";
import {
  INTAKE_OPTIONS,
  compareIntakeLabels,
  currentOpenIntake,
  intakeStatus,
  resolveLearnerIntake,
} from "@/lib/intakes";
import {
  allocateAdmissionNumber,
  purgeStudentIdentity,
  resolveStudentAdmissionId,
} from "@/lib/learner-identity";
import { formatActivityActor, formatActivityTime, lastActivityByLearner } from "@/lib/activity";

export default function LearnersPage() {
  const { user } = useAuth();
  const tick = useLiveTick();
  const [learners, refresh] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [courses] = useStoreList(coursesStore.getAll, coursesStore.key);
  const [query, setQuery] = useState("");
  const [intakeFilter, setIntakeFilter] = useState<string>("all");
  const [view, setView] = useState<"roster" | "activity">("roster");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    course: "Professional Interior Design Programme",
    status: "active" as Learner["status"],
    intake: currentOpenIntake(),
    feeTrackId: "4-month",
    createLogin: true,
    paidAmount: 0,
    addPayment: 0,
    feeDue: 3350000,
  });
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Learner | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Learner | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const canEdit = user?.role === "super_admin" || user?.role === "accountant";

  useEffect(() => {
    if (!canEdit) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      setEditing(null);
      setForm({
        name: "",
        email: "",
        phone: "",
        course: "Professional Interior Design Programme",
        status: "active",
        intake: currentOpenIntake(),
        feeTrackId: "4-month",
        createLogin: true,
        paidAmount: 0,
        addPayment: 0,
        feeDue: 3350000,
      });
      setOpen(true);
    }
  }, [canEdit]);

  const nextAdmissionPreview = useMemo(() => {
    if (editing) return editing.id;
    if (form.email.trim()) {
      return resolveStudentAdmissionId({ email: form.email });
    }
    return allocateAdmissionNumber();
  }, [editing, form.email, learners]);

  const namesMatch = (typed: string, actual: string) =>
    typed.trim().replace(/\s+/g, " ").toLowerCase() ===
    actual.trim().replace(/\s+/g, " ").toLowerCase();

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (!namesMatch(confirmName, pendingDelete.name)) return;
    const target = pendingDelete;
    void (async () => {
      const result = await purgeStudentIdentity({
        learnerId: target.id,
        email: target.email,
      });
      if (selected?.id === target.id) setSelected(null);
      setPendingDelete(null);
      setConfirmName("");
      refresh();
      const parts = [
        result.removedLearner ? "learner roster" : null,
        result.removedAccount ? "portal account" : null,
        result.removedEnrollments ? "enrolments" : null,
      ].filter(Boolean);
      const msg = `${target.name} was removed from ${parts.join(", ") || "the system"}.`;
      setNotice(msg);
      showFlash("success", msg);
    })();
  };

  const activityByLearner = useMemo(() => {
    void tick;
    if (!user) return new Map();
    return lastActivityByLearner(learners, user);
  }, [learners, user, tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return learners.filter((l) => {
      const intake = resolveLearnerIntake(l);
      if (!tokens.length) {
        if (intakeFilter !== "all" && intake !== intakeFilter) return false;
        return true;
      }
      // Search across all intakes so names always resolve
      const activity = activityByLearner.get(l.id);
      const haystack = [
        l.name,
        l.id,
        l.email,
        l.phone,
        l.course,
        intake,
        activity?.title ?? "",
        activity?.detail ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [learners, query, intakeFilter, activityByLearner]);

  const grouped = useMemo(() => {
    const map = new Map<string, Learner[]>();
    for (const learner of filtered) {
      const intake = resolveLearnerIntake(learner);
      const list = map.get(intake) ?? [];
      list.push(learner);
      map.set(intake, list);
    }
    return [...map.entries()].sort(([a], [b]) => compareIntakeLabels(a, b));
  }, [filtered]);

  const byLastActivity = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aAt = activityByLearner.get(a.id)?.at ?? 0;
      const bAt = activityByLearner.get(b.id)?.at ?? 0;
      if (bAt !== aAt) return bAt - aAt;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, activityByLearner]);

  const canManageAccounts =
    user?.role === "super_admin" || user?.role === "accountant";

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      const extra = Number(form.addPayment) || 0;
      const next: Learner = {
        ...editing,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        course:
          feeTracks.find((t) => t.id === form.feeTrackId)?.name ?? form.course.trim(),
        status: form.status,
        intake: form.intake.trim() || currentOpenIntake(),
        feeTrackId: form.feeTrackId,
        feeDue: Number(form.feeDue) || 0,
      };
      learnersStore.upsert(next);
      recordManualFee({
        learnerName: next.name,
        learnerEmail: next.email,
        phone: next.phone,
        amount: extra,
        feeTrackId: form.feeTrackId,
        feeDue: next.feeDue,
        intake: next.intake,
      });
      setEditing(null);
      refresh();
      setOpen(false);
      showFlash("success", `${next.name} was updated.`);
      return;
    }
    const track = feeTracks.find((t) => t.id === form.feeTrackId);
    const firstPay = Number(form.paidAmount) || 0;
    const enrollmentDate = new Date().toISOString().slice(0, 10);
    const admissionId = resolveStudentAdmissionId({ email: form.email });
    const learner: Learner = {
      id: admissionId,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      course: track?.name ?? form.course.trim(),
      enrollmentDate,
      intake: form.intake.trim() || resolveLearnerIntake({ enrollmentDate }),
      progress: 0,
      status: form.status,
      feeTrackId: form.feeTrackId,
      paidAmount: firstPay,
      feeDue: Number(form.feeDue) || track?.total || 0,
    };
    learnersStore.upsert(learner);
    recordManualFee({
      learnerName: learner.name,
      learnerEmail: learner.email,
      phone: learner.phone,
      amount: firstPay,
      feeTrackId: form.feeTrackId,
      feeDue: learner.feeDue,
      intake: learner.intake,
    });
    if (form.createLogin && canManageAccounts) {
      const live = await provisionPortalAccount({
        name: learner.name,
        email: learner.email,
        phone: learner.phone,
        role: "student",
        learnerId: learner.id,
        feeTrackId: form.feeTrackId,
      });
      if (!live.ok) {
        const msg = `Learner saved. Live portal login was not created: ${live.error} Use Email live login after the network is back.`;
        setNotice(msg);
        showFlash("error", msg);
      } else {
        const msg = `Learner saved. Login emailed to ${learner.email}${live.password ? `. Temporary password: ${live.password}` : "."}`;
        setNotice(msg);
        showFlash("success", msg);
      }
    } else {
      showFlash("success", `${learner.name} was added to the roster.`);
    }
    refresh();
    setOpen(false);
    setForm({
      name: "",
      email: "",
      phone: "",
      course: "Professional Interior Design Programme",
      status: "active",
      intake: currentOpenIntake(),
      feeTrackId: "4-month",
      createLogin: true,
      paidAmount: 0,
      addPayment: 0,
      feeDue: 3350000,
    });
  };

  const grantLogin = async (learner: Learner) => {
    const live = await provisionPortalAccount({
      name: learner.name,
      email: learner.email,
      phone: learner.phone,
      role: "student",
      learnerId: learner.id,
    });
    if (!live.ok) {
      setNotice(live.error);
      showFlash("error", live.error);
      return;
    }
    try {
      createAccount({
        name: learner.name,
        email: learner.email,
        phone: learner.phone,
        role: "student",
        learnerId: learner.id,
      });
    } catch {
      /* already on this device */
    }
    const msg = `Login emailed to ${learner.email}. Temporary password: ${live.password ?? "—"}. They can sign in on dreyzschool.com now.`;
    setNotice(msg);
    showFlash("success", msg);
    refresh();
  };

  const cycleStatus = (learner: Learner) => {
    if (!canEdit) return;
    const next =
      learner.status === "active"
        ? "paused"
        : learner.status === "paused"
          ? "completed"
          : "active";
    learnersStore.upsert({ ...learner, status: next });
    refresh();
  };

  const onExport = () => {
    exportCsv("learners.csv", [
      ["ID", "Name", "Email", "Phone", "Course", "Intake", "Progress", "Status", "Enrolled"],
      ...filtered.map((l) => [
        l.id,
        l.name,
        l.email,
        l.phone,
        l.course,
        resolveLearnerIntake(l),
        String(computeLearnerProgress(l)),
        l.status,
        l.enrollmentDate,
      ]),
    ]);
  };

  const renderLearnerRow = (learner: Learner) => {
    const progress = computeLearnerProgress(learner);
    const account = getAllUsers().find(
      (u) =>
        u.learnerId === learner.id ||
        u.email.toLowerCase() === learner.email.toLowerCase()
    );
    const fees = feesForStudent(
      learner.email,
      account?.feeTrackId ?? learner.feeTrackId,
      learner.paidAmount,
      learner.feeDue
    );
    return (
      <TableRow key={learner.id}>
        <TableCell className="font-mono text-xs text-muted">{learner.id}</TableCell>
        <TableCell>
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => setSelected(learner)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-dark">
              {learner.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p className="font-medium hover:text-accent">{learner.name}</p>
              <p className="text-xs text-muted">{learner.email}</p>
            </div>
          </button>
        </TableCell>
        <TableCell className="max-w-[200px] truncate">{learner.course}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-navy" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-medium">{progress}%</span>
          </div>
        </TableCell>
        <TableCell>
          <p
            className={`text-xs font-medium ${
              fees.paid <= 0
                ? "text-orange-600 dark:text-orange-400"
                : fees.balance <= 0
                  ? "text-emerald-600"
                  : "text-foreground"
            }`}
          >
            {fees.paid <= 0 ? "Not paid" : fees.balance <= 0 ? "Paid" : "Part paid"}
          </p>
          <p className="text-[11px] text-muted">
            Paid {formatUGX(fees.paid)} · due {formatUGX(fees.total)} · balance{" "}
            {formatUGX(fees.balance)}
          </p>
        </TableCell>
        <TableCell>
          <button type="button" onClick={() => cycleStatus(learner)} disabled={!canEdit}>
            <Badge
              variant={
                learner.status === "active"
                  ? "success"
                  : learner.status === "completed"
                    ? "info"
                    : "warning"
              }
            >
              {learner.status}
            </Badge>
          </button>
        </TableCell>
        <TableCell className="text-muted">{learner.enrollmentDate}</TableCell>
        {canEdit && (
          <TableCell>
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" onClick={() => setSelected(learner)}>
                <Eye size={13} /> Profile
              </Button>
              {canManageAccounts && (
                <Button size="sm" onClick={() => void grantLogin(learner)}>
                  <UserPlus size={13} /> Email live login
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(learner);
                  setForm({
                    name: learner.name,
                    email: learner.email,
                    phone: learner.phone,
                    course: learner.course,
                    status: learner.status,
                    intake: resolveLearnerIntake(learner),
                    feeTrackId: learner.feeTrackId ??
                      feeTracks.find((t) => t.total === (learner.feeDue ?? 0))?.id ??
                      feeTracks.find((t) => t.name === learner.course)?.id ??
                      "4-month",
                    createLogin: false,
                    paidAmount: learner.paidAmount ?? 0,
                    addPayment: 0,
                    feeDue: learner.feeDue ?? 3350000,
                  });
                  setOpen(true);
                }}
              >
                <Pencil size={13} /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingDelete(learner);
                  setConfirmName("");
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div>
      <PageHeader
        title="Learners"
        description="Same student records as Admissions and Billing — one admission ID, fee programme, and payment balance everywhere."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download size={14} /> Export
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    name: "",
                    email: "",
                    phone: "",
                    course: "Professional Interior Design Programme",
                    status: "active",
                    intake: currentOpenIntake(),
                    feeTrackId: "4-month",
                    createLogin: true,
                    paidAmount: 0,
                    addPayment: 0,
                    feeDue: 3350000,
                  });
                  setOpen(true);
                }}
              >
                <Plus size={14} /> Add Learner
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <div className="mb-4">
        <IntakeFilterTabs
          learners={learners}
          value={intakeFilter}
          onChange={setIntakeFilter}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            { id: "roster" as const, label: "Roster" },
            { id: "activity" as const, label: "Last activity" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              view === tab.id
                ? "bg-accent text-white"
                : "border border-border bg-card text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <SearchInput
          placeholder={
            view === "activity"
              ? "Search learners by name, ID, or activity…"
              : "Search by name, ID, course, or intake…"
          }
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {view === "activity" ? (
        byLastActivity.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No learners match your search.</p>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Learner" },
              { key: "intake", label: "Intake" },
              { key: "activity", label: "Last activity" },
              { key: "when", label: "When" },
              { key: "status", label: "Status" },
              ...(canEdit ? [{ key: "actions", label: "" }] : []),
            ]}
          >
            {byLastActivity.map((learner) => {
              const item = activityByLearner.get(learner.id);
              return (
                <TableRow key={learner.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelected(learner)}
                    >
                      <p className="font-medium hover:text-accent">{learner.name}</p>
                      <p className="text-xs text-muted">
                        {learner.id} · {learner.email}
                      </p>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted">{resolveLearnerIntake(learner)}</TableCell>
                  <TableCell>
                    {item ? (
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted">
                          User: {formatActivityActor(item)}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">No recorded actions yet</p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {item?.at ? formatActivityTime(item.at) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        learner.status === "active"
                          ? "success"
                          : learner.status === "completed"
                            ? "info"
                            : "warning"
                      }
                    >
                      {learner.status}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelected(learner)}>
                        <Eye size={13} /> Profile
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </DataTable>
        )
      ) : grouped.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No learners match your search.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([intake, rows]) => (
            <section key={intake}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{intake} intake</h2>
                  <p className="text-xs text-muted">
                    {rows.length} learner{rows.length === 1 ? "" : "s"}
                    {intakeStatus(intake) === "open" ? " · registration open" : ""}
                  </p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "id", label: "ID" },
                  { key: "name", label: "Name" },
                  { key: "course", label: "Course" },
                  { key: "progress", label: "Progress" },
                  { key: "fees", label: "Fees" },
                  { key: "status", label: "Status" },
                  { key: "enrolled", label: "Enrolled" },
                  ...(canEdit ? [{ key: "actions", label: "" }] : []),
                ]}
              >
                {rows.map((learner) => renderLearnerRow(learner))}
              </DataTable>
            </section>
          ))}
        </div>
      )}

      <LearnerProfile learner={selected} onClose={() => setSelected(null)} />

      <Modal
        open={open}
        title={editing ? "Edit learner" : "Add learner"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Admission number">
            <input
              readOnly
              className={`${fieldClass} font-mono`}
              value={nextAdmissionPreview}
            />
            <p className="mt-1 text-[11px] text-muted">
              {editing
                ? "Existing admission number — shared with the portal account and enrolments."
                : "Issued automatically. Reuses the same ID if this email already exists."}
            </p>
          </Field>
          <Field label="Full name">
            <input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input required className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Course">
            <select
              required
              className={fieldClass}
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
            >
              <option value="Professional Interior Design Programme">
                Professional Interior Design Programme
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intake">
            <select
              required
              className={fieldClass}
              value={form.intake}
              onChange={(e) => setForm({ ...form, intake: e.target.value })}
            >
              {INTAKE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label}
                  {opt.status === "open" ? " (open)" : ""}
                </option>
              ))}
              {!INTAKE_OPTIONS.some((o) => o.label === form.intake) && form.intake ? (
                <option value={form.intake}>{form.intake}</option>
              ) : null}
            </select>
          </Field>
          <Field label="Fee programme">
            <select
              className={fieldClass}
              value={form.feeTrackId}
              onChange={(e) => {
                const track = feeTracks.find((t) => t.id === e.target.value);
                setForm({
                  ...form,
                  feeTrackId: e.target.value,
                  feeDue: track?.total ?? form.feeDue,
                });
              }}
            >
              {feeTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatUGX(t.total)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Use a previous-rate programme for students who enrolled under UGX 3,050,000 or 3,920,000.
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {editing ? (
              <Field label="Add payment (UGX)">
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.addPayment}
                  onChange={(e) => setForm({ ...form, addPayment: Number(e.target.value) })}
                />
              </Field>
            ) : (
              <Field label="Amount paid (UGX)">
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                />
              </Field>
            )}
            <Field label="Programme fee due (UGX)">
              <input
                type="number"
                min={0}
                className={fieldClass}
                value={form.feeDue}
                onChange={(e) => setForm({ ...form, feeDue: Number(e.target.value) })}
              />
            </Field>
          </div>
          {editing && (
            <p className="text-xs text-muted">
              Already paid {formatUGX(
                feesForStudent(editing.email, undefined, editing.paidAmount, editing.feeDue).paid
              )}
              . Balance{" "}
              {formatUGX(
                feesForStudent(editing.email, undefined, editing.paidAmount, form.feeDue).balance
              )}
              . A new payment here is added on top of earlier RukaPay or cash installments.
            </p>
          )}
          <p className="text-xs text-muted">
            Minimum UGX 1,000,000 activates the student account. Later cash or RukaPay payments reduce the remaining balance automatically.
          </p>
          <Field label="Status">
            <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Learner["status"] })}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
          </Field>
          {canManageAccounts && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.createLogin}
                onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
              />
              Also create student portal login and email credentials
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save changes" : "Save learner"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!pendingDelete}
        title="Delete learner"
        onClose={() => {
          setPendingDelete(null);
          setConfirmName("");
        }}
      >
        {pendingDelete && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              confirmDelete();
            }}
          >
            <p className="text-sm text-foreground">
              This permanently removes{" "}
              <span className="font-semibold">{pendingDelete.name}</span> (
              <span className="font-mono text-xs">{pendingDelete.id}</span>) from the learner
              roster, linked portal account, and enrolments. Type their full name to confirm.
            </p>
            <Field label="Full name">
              <input
                autoFocus
                className={fieldClass}
                placeholder={pendingDelete.name}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingDelete(null);
                  setConfirmName("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!namesMatch(confirmName, pendingDelete.name)}>
                Delete learner
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
