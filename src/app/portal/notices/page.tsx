"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal, Field, fieldClass, ConfirmDialog } from "@/components/ui/Modal";
import { Plus, Trash2 } from "lucide-react";
import { noticesStore, useStoreList, uid, type Notice } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";
import { markAllNoticesRead } from "@/lib/notice-reads";

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, refresh] = useStoreList(noticesStore.getAll, noticesStore.key);
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Notice | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "medium" as Notice["priority"],
    category: "General",
  });

  const canPost = user?.role === "super_admin" || user?.role === "accountant";

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/notices", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; notices?: Notice[] };
        if (res.ok && data.ok && data.notices?.length) {
          noticesStore.upsertMany(data.notices);
          refresh();
        }
      } catch {
        /* keep local notices */
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (notices.length) markAllNoticesRead(notices.map((n) => n.id));
  }, [notices]);

  const onPost = async (e: FormEvent) => {
    e.preventDefault();
    const notice: Notice = {
      id: uid("NTC"),
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      category: form.category.trim() || "General",
      date: new Date().toISOString().slice(0, 10),
    };
    noticesStore.upsert(notice);
    refresh();
    setOpen(false);
    setForm({ title: "", content: "", priority: "medium", category: "General" });
    setPosting(true);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notice),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        emailed?: number;
      };
      if (!res.ok || !data.ok) {
        showFlash(
          "error",
          `Notice is on the portal, but email was not sent: ${data.error ?? "mail failed"}`
        );
        return;
      }
      showFlash(
        "success",
        data.message ??
          `Notice posted — students will see it on their portal automatically${
            data.emailed ? ` (emailed to ${data.emailed})` : ""
          }.`
      );
    } catch {
      showFlash("error", "Notice is on the portal, but email could not be sent.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notices & Announcements"
        description="Posted notices show on every student portal home and Notices page, and are emailed to staff and learners."
        action={
          canPost ? (
            <Button size="sm" onClick={() => setOpen(true)} disabled={posting}>
              <Plus size={14} /> {posting ? "Sending…" : "Post Notice"}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {notices.map((notice) => (
          <Card key={notice.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{notice.title}</h3>
                  <Badge
                    variant={
                      notice.priority === "high"
                        ? "danger"
                        : notice.priority === "medium"
                          ? "warning"
                          : "default"
                    }
                  >
                    {notice.priority}
                  </Badge>
                  <Badge variant="info">{notice.category}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{notice.content}</p>
                <p className="mt-3 text-xs text-muted">{notice.date}</p>
              </div>
              {canPost && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingDelete(notice)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} title="Post notice" onClose={() => setOpen(false)}>
        <form onSubmit={(e) => void onPost(e)} className="space-y-3">
          <p className="text-sm text-muted">
            Everyone in the portal will see this, and each person gets an email: “You have received this notice…”
          </p>
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Content">
            <textarea required rows={4} className={fieldClass} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className={fieldClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Notice["priority"] })}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </Field>
            <Field label="Category">
              <input className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={posting}>{posting ? "Sending…" : "Publish & email everyone"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete notice"
        description={`Delete “${pendingDelete?.title ?? ""}”? Learners will no longer see it.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          noticesStore.remove(pendingDelete.id);
          refresh();
          showFlash("success", "Notice removed.");
        }}
      />
    </div>
  );
}
