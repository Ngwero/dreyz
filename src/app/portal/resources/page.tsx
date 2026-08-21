"use client";

import { FormEvent, useMemo, useState } from "react";
import { PageHeader, SearchInput, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal, Field, fieldClass } from "@/components/ui/Modal";
import { Plus, Download, FileText, Box, Image, Video, Layout, Trash2 } from "lucide-react";
import { resourcesStore, useStoreList, uid, type Resource } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";

const typeIcons = {
  PDF: FileText,
  CAD: Box,
  Video: Video,
  Template: Layout,
  Texture: Image,
};

export default function ResourcesPage() {
  const { user } = useAuth();
  const [resources, refresh] = useStoreList(resourcesStore.getAll, resourcesStore.key);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "Materials",
    type: "PDF" as Resource["type"],
    files: 1,
  });

  const canUpload = user?.role === "super_admin" || user?.role === "tutor";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
    );
  }, [resources, query]);

  const onUpload = (e: FormEvent) => {
    e.preventDefault();
    resourcesStore.upsert({
      id: uid("RES"),
      title: form.title.trim(),
      category: form.category.trim(),
      type: form.type,
      files: Number(form.files) || 1,
      downloads: 0,
    });
    refresh();
    setOpen(false);
  };

  const onDownload = (resource: Resource) => {
    resourcesStore.upsert({ ...resource, downloads: resource.downloads + 1 });
    refresh();
    // Demo download content
    const blob = new Blob(
      [`Dreyz Interior Resource\n${resource.title}\nType: ${resource.type}\n`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resource.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Design Resource Center"
        description="Textures, CAD files, templates, and reference materials for learners."
        action={
          canUpload ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Upload Resource
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <SearchInput
          placeholder="Search resources..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((resource) => {
          const Icon = typeIcons[resource.type];
          return (
            <Card key={resource.id}>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/10">
                  <Icon size={22} className="text-accent-dark" />
                </div>
                <Badge variant="accent">{resource.type}</Badge>
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{resource.title}</h3>
              <p className="mt-1 text-sm text-muted">{resource.category}</p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="text-xs text-muted">
                  <span className="font-medium text-foreground">{resource.files}</span> files ·{" "}
                  <span className="font-medium text-foreground">
                    {resource.downloads.toLocaleString()}
                  </span>{" "}
                  downloads
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => onDownload(resource)}>
                    <Download size={14} />
                  </Button>
                  {canUpload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resourcesStore.remove(resource.id);
                        refresh();
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} title="Upload resource" onClose={() => setOpen(false)}>
        <form onSubmit={onUpload} className="space-y-3">
          <Field label="Title">
            <input required className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <input required className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Resource["type"] })}>
                <option value="PDF">PDF</option>
                <option value="CAD">CAD</option>
                <option value="Video">Video</option>
                <option value="Template">Template</option>
                <option value="Texture">Texture</option>
              </select>
            </Field>
            <Field label="Files">
              <input type="number" min={1} className={fieldClass} value={form.files} onChange={(e) => setForm({ ...form, files: Number(e.target.value) })} />
            </Field>
          </div>
          <p className="text-xs text-muted">Demo upload — metadata is saved; download increments the counter.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save resource</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
