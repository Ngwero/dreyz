"use client";

import { FormEvent, useState } from "react";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Trash2 } from "lucide-react";
import { noticesStore, useStoreList, uid, type Notice } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, refresh] = useStoreList(noticesStore.getAll, noticesStore.key);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "medium" as Notice["priority"],
    category: "General",
  });

  const canPost = user?.role === "super_admin" || user?.role === "accountant";

  const onPost = (e: FormEvent) => {
    e.preventDefault();
    noticesStore.upsert({
      id: uid("NTC"),
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      category: form.category.trim() || "General",
      date: new Date().toISOString().slice(0, 10),
    });
    refresh();
    setOpen(false);
    setForm({ title: "", content: "", priority: "medium", category: "General" });
    showFlash("success", "Notice posted.");
  };

  return (
    <div>
      <PageHeader
        title="Notices & Announcements"
        description="Broadcast updates, workshops, and important announcements to learners."
        action={
          canPost ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Post Notice
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
                <p className="mt-2 text-sm text-muted">{notice.content}</p>
                <p className="mt-3 text-xs text-muted">{notice.date}</p>
              </div>
              {canPost && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    noticesStore.remove(notice.id);
                    refresh();
                    showFlash("success", "Notice removed.");
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} title="Post notice" onClose={() => setOpen(false)}>
        <form onSubmit={onPost} className="space-y-3">
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
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
