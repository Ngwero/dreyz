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
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createAccount,
  deleteUser,
  getAllUsers,
  getEmailOutbox,
  resendLoginEmail,
  resetUserPassword,
  updateAccount,
  updateUserStatus,
} from "@/lib/auth";
import { provisionPortalAccount } from "@/lib/auth-client";
import { showFlash } from "@/lib/flash";
import { exportCsv } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/roles";
import { classOptions, feeTracks } from "@/lib/data";
import type { PortalUser, UserRole } from "@/lib/types";
import { KeyRound, Mail, Pencil, Plus, Trash2, UserPlus } from "lucide-react";

type AccountForm = {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  feeTrackId: string;
  classOptionId: string;
  specialty: string;
};

const emptyForm = (role: UserRole): AccountForm => ({
  name: "",
  email: "",
  phone: "",
  role,
  feeTrackId: feeTracks[0]?.id ?? "4-month",
  classOptionId: classOptions[0]?.id ?? "weekday",
  specialty: "Interior Design",
});

export default function AccountsPage() {
  const { user, refresh } = useAuth();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tick, setTick] = useState(0);
  const [remoteUsers, setRemoteUsers] = useState<PortalUser[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [open, setOpen] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<PortalUser | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm("student"));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PortalUser | null>(null);

  const ok = (message: string) => {
    setError("");
    setNotice(message);
    showFlash("success", message);
  };
  const fail = (message: string) => {
    setNotice("");
    setError(message);
    showFlash("error", message);
  };
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setListError("");
    try {
      const res = await fetch("/api/accounts/list", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        users?: PortalUser[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.users) {
        setListError(data.error ?? "Could not load accounts from the server.");
        setRemoteUsers(null);
        return;
      }
      setRemoteUsers(data.users);
    } catch {
      setListError("Network error while loading accounts.");
      setRemoteUsers(null);
    } finally {
      setListLoading(false);
      setTick((t) => t + 1);
    }
  };

  useEffect(() => {
    void loadUsers();
    const onStore = () => setTick((t) => t + 1);
    window.addEventListener("dreyz-store", onStore);
    return () => window.removeEventListener("dreyz-store", onStore);
  }, []);

  const users = useMemo(() => {
    void tick;
    const remote = remoteUsers ?? [];
    const liveEmails = new Set(remote.map((u) => u.email.toLowerCase()));
    const listed: (PortalUser & { liveLogin: boolean })[] = remote.map((u) => ({
      ...u,
      liveLogin: true,
    }));
    for (const local of getAllUsers()) {
      if (liveEmails.has(local.email.toLowerCase())) continue;
      listed.push({ ...local, liveLogin: false });
      liveEmails.add(local.email.toLowerCase());
    }
    return listed.sort((a, b) => a.name.localeCompare(b.name));
  }, [tick, remoteUsers]);

  if (user && user.role !== "super_admin" && user.role !== "accountant") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted">
        Account management is limited to Super Admin and Accountant.
      </div>
    );
  }

  const isAdmin = user?.role === "super_admin";
  const creatableRoles: UserRole[] = isAdmin
    ? ["student", "tutor", "accountant", "super_admin"]
    : ["student"];

  const visible = users.filter((u) => {
    if (!isAdmin && u.role !== "student") return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    super_admin: users.filter((u) => u.role === "super_admin").length,
    accountant: users.filter((u) => u.role === "accountant").length,
    tutor: users.filter((u) => u.role === "tutor").length,
    student: users.filter((u) => u.role === "student").length,
  };

  const bump = () => {
    setTick((t) => t + 1);
    void loadUsers();
  };

  const openCreate = (role: UserRole = "student") => {
    setEditing(null);
    setForm(emptyForm(role));
    setError("");
    setOpen("create");
  };

  const openEdit = (u: PortalUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role,
      feeTrackId: u.feeTrackId ?? feeTracks[0]?.id ?? "4-month",
      classOptionId: u.classOptionId ?? classOptions[0]?.id ?? "weekday",
      specialty: u.specialty ?? "Interior Design",
    });
    setError("");
    setOpen("edit");
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const role = isAdmin ? form.role : "student";
      const res = await fetch("/api/accounts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role,
          feeTrackId: form.feeTrackId,
          classOptionId: form.classOptionId,
          specialty: form.specialty,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        password?: string;
        user?: PortalUser;
      };

      if (!res.ok || !data.ok) {
        fail(data.error ?? "Could not create account.");
        return;
      }

      ok(
        `Welcome to Dreyz Interior — confirmation emailed to ${form.email}. Temporary password: ${data.password ?? "—"}`
      );
      setOpen(null);
      await loadUsers();
      refresh();
    } catch {
      // Offline / API unreachable — keep local create as fallback
      try {
        const role = isAdmin ? form.role : "student";
        const result = createAccount({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role,
          feeTrackId: form.feeTrackId,
          classOptionId: form.classOptionId,
          specialty: form.specialty,
        });
        ok(
          `Created ${ROLE_LABELS[result.user.role]} ${result.user.name}. Welcome email queued for ${result.user.email}. Temporary password: ${result.password}`
        );
        setOpen(null);
        bump();
      } catch (err) {
        fail(err instanceof Error ? err.message : "Could not create account.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      updateAccount(editing.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: isAdmin ? form.role : editing.role,
        feeTrackId: form.role === "student" || editing.role === "student" ? form.feeTrackId : undefined,
        classOptionId: form.role === "student" || editing.role === "student" ? form.classOptionId : undefined,
        specialty: form.role === "tutor" || editing.role === "tutor" ? form.specialty : undefined,
      });
      ok(`Updated ${form.name}.`);
      setOpen(null);
      bump();
      refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not update account.");
    }
  };

  const onReset = (u: PortalUser) => {
    try {
      const result = resetUserPassword(u.id);
      void fetch("/api/accounts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, email: u.email, resetPassword: true }),
      });
      ok(
        `Password reset for ${u.name}. Emailed to ${u.email}. Temporary password: ${result.password}`
      );
      bump();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Reset failed.");
    }
  };

  const onResend = async (u: PortalUser) => {
    setNotice("");
    setError("");
    try {
      resendLoginEmail(u.id);
    } catch {
      /* local outbox optional */
    }
    const live = await provisionPortalAccount({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      learnerId: u.learnerId,
      instructorId: u.instructorId,
      feeTrackId: u.feeTrackId,
      classOptionId: u.classOptionId,
      specialty: u.specialty,
    });
    if (!live.ok) {
      fail(live.error);
      return;
    }
    ok(
      `Login emailed to ${u.email}${live.password ? `. Temporary password: ${live.password}` : "."}`
    );
    bump();
  };

  const onEnableLiveLogin = async (u: PortalUser) => {
    setNotice("");
    setError("");
    const live = await provisionPortalAccount({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      learnerId: u.learnerId,
      instructorId: u.instructorId,
      feeTrackId: u.feeTrackId,
      classOptionId: u.classOptionId,
      specialty: u.specialty,
    });
    if (!live.ok) {
      fail(live.error);
      return;
    }
    ok(`Login emailed to ${u.email}. Temporary password: ${live.password ?? "—"}`);
    bump();
  };

  const onExport = () => {
    exportCsv("accounts.csv", [
      ["Name", "Email", "Role", "Status", "Phone", "Created", "Last login"],
      ...visible.map((u) => [
        u.name,
        u.email,
        ROLE_LABELS[u.role],
        u.status,
        u.phone ?? "",
        u.createdAt,
        u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "",
      ]),
    ]);
  };

  const outbox = getEmailOutbox().slice(0, 4);
  const detailFor = (u: PortalUser) => {
    if (u.role === "student") {
      const track = feeTracks.find((t) => t.id === u.feeTrackId);
      const klass = classOptions.find((c) => c.id === u.classOptionId);
      return [track?.name, klass?.name].filter(Boolean).join(" · ");
    }
    if (u.role === "tutor") return u.specialty;
    return ROLE_LABELS[u.role];
  };

  return (
    <div>
      <PageHeader
        title="Account management"
        description={
          isAdmin
            ? "Create and manage Super Admin, Accountant, Tutor, and Student portal logins. Accounts created only on this computer show as This device only until you email a live login. Students sign in at dreyzschool.com with that email."
            : "Create and manage student portal accounts. Confirming a payment also provisions a student login."
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setListLoading(true);
                void loadUsers();
              }}
              disabled={listLoading}
            >
              {listLoading ? "Loading…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              Export
            </Button>
            <Button size="sm" onClick={() => openCreate("student")}>
              <UserPlus size={14} /> New account
            </Button>
          </div>
        }
      />

      {listError && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          {listError} Showing cached accounts if available.
        </p>
      )}
      {listLoading && !remoteUsers && (
        <p className="mb-4 text-sm text-muted">Loading accounts from the school database…</p>
      )}
      {isAdmin && (
        <div className="mb-5 flex flex-wrap gap-2">
          {creatableRoles.map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openCreate(role)}
            >
              <Plus size={13} /> {ROLE_LABELS[role]}
            </Button>
          ))}
        </div>
      )}

      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && !open && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(isAdmin ? (Object.keys(counts) as UserRole[]) : (["student"] as UserRole[])).map(
          (role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(roleFilter === role ? "all" : role)}
              className="text-left"
            >
              <Card className={roleFilter === role ? "ring-2 ring-accent/40" : ""}>
                <p className="text-xs text-muted">{ROLE_LABELS[role]}</p>
                <p className="mt-1 text-2xl font-bold">{counts[role]}</p>
              </Card>
            </button>
          )
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Search by name, email, phone, role…"
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isAdmin && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent/40"
          >
            <option value="all">All roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="accountant">Accountant</option>
            <option value="tutor">Tutor</option>
            <option value="student">Student</option>
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent/40"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status" },
          { key: "login", label: "Last login" },
          { key: "actions", label: "" },
        ]}
      >
        {visible.map((u) => (
          <TableRow key={u.id}>
            <TableCell>
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-muted">{detailFor(u)}</p>
              {u.phone && <p className="text-xs text-muted">{u.phone}</p>}
            </TableCell>
            <TableCell className="text-muted">{u.email}</TableCell>
            <TableCell>
              <Badge variant="accent">{ROLE_LABELS[u.role]}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant={u.status === "active" ? "success" : "danger"}>
                  {u.status}
                </Badge>
                {"liveLogin" in u && u.liveLogin === false && (
                  <Badge variant="warning">This device only</Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted">
              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap justify-end gap-1">
                <Button size="sm" onClick={() => void onEnableLiveLogin(u)}>
                  <UserPlus size={13} /> Email live login
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                  <Pencil size={13} /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onResend(u)}>
                  <Mail size={13} /> Resend
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReset(u)}>
                  <KeyRound size={13} /> Reset
                </Button>
                {u.id !== user?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = u.status === "active" ? "inactive" : "active";
                      updateUserStatus(u.id, next);
                      void fetch("/api/accounts/update", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: u.id, status: next }),
                      });
                      bump();
                      ok(
                        next === "inactive"
                          ? `${u.name} was deactivated.`
                          : `${u.name} was activated.`
                      );
                    }}
                  >
                    {u.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                )}
                {isAdmin && u.id !== user?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingDelete(u)}
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      {visible.length === 0 && (
        <p className="mt-4 text-sm text-muted">No accounts match your filters.</p>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Recent login emails ({getEmailOutbox().length} in outbox)
        </p>
        {outbox.length === 0 ? (
          <p className="text-sm text-muted">
            New accounts, password resets, and confirmed payments queue a login email here.
          </p>
        ) : (
          <ul className="space-y-2">
            {outbox.map((mail) => (
              <li
                key={mail.id}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <p className="font-medium">{mail.subject}</p>
                <p className="text-xs text-muted">
                  To {mail.to} · {new Date(mail.sentAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={open === "create" || open === "edit"}
        title={open === "edit" ? "Edit account" : "Create account"}
        onClose={() => setOpen(null)}
        wide
      >
        <form onSubmit={open === "edit" ? onEdit : onCreate} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input
                required
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Email (login)">
              <input
                required
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className={fieldClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className={fieldClass}
                value={form.role}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                {creatableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {form.role === "student" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Programme">
                <select
                  className={fieldClass}
                  value={form.feeTrackId}
                  onChange={(e) => setForm({ ...form, feeTrackId: e.target.value })}
                >
                  {feeTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class option">
                <select
                  className={fieldClass}
                  value={form.classOptionId}
                  onChange={(e) => setForm({ ...form, classOptionId: e.target.value })}
                >
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {form.role === "tutor" && (
            <Field label="Specialty">
              <input
                className={fieldClass}
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                placeholder="e.g. Residential design"
              />
            </Field>
          )}

          {open === "create" && (
            <p className="text-xs text-muted">
              Creates the portal login and sends a Welcome to Dreyz Interior confirmation email with a temporary password.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {open === "edit" ? (
                "Save changes"
              ) : saving ? (
                "Creating…"
              ) : (
                <>
                  <Plus size={14} /> Create &amp; send welcome
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove portal account"
        description={`Remove ${pendingDelete?.name ?? "this account"} (${pendingDelete?.email ?? ""}) from the portal? They will not be able to sign in.`}
        confirmLabel="Remove account"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteUser(pendingDelete.id);
          bump();
          ok(`${pendingDelete.name} was removed.`);
        }}
      />
    </div>
  );
}
