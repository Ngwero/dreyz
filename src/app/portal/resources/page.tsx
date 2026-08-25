"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { PageHeader, SearchInput, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, fieldClass, ConfirmDialog } from "@/components/ui/Modal";
import { Plus, Download, FileText, Box, Image, Video, Layout, Trash2, Upload } from "lucide-react";
import { resourcesStore, useStoreList, uid, type Resource } from "@/lib/store";
import { useAuth } from "@/components/auth/AuthProvider";
import { showFlash } from "@/lib/flash";

const typeIcons = {
  PDF: FileText,
  CAD: Box,
  Video: Video,
  Template: Layout,
  Texture: Image,
};

const emptyForm = {
  title: "",
  category: "Materials",
  type: "PDF" as Resource["type"],
  paid: false,
  price: 0,
  file: null as File | null,
};

export default function ResourcesPage() {
  const { user } = useAuth();
  const [resources, refresh] = useStoreList(resourcesStore.getAll, resourcesStore.key);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload =
    user?.role === "super_admin" || user?.role === "accountant" || user?.role === "tutor";

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

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!canUpload) return;
    if (!form.file) {
      showFlash("error", "Choose a file to upload.");
      fileRef.current?.click();
      return;
    }
    if (!form.title.trim()) {
      showFlash("error", "Enter a title for this resource.");
      return;
    }

    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", form.file);
      const res = await fetch("/api/resources/upload", { method: "POST", body: data });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        showFlash("error", json.error ?? "Could not upload the file.");
        return;
      }

      resourcesStore.upsert({
        id: uid("RES"),
        title: form.title.trim(),
        category: form.category.trim() || "Materials",
        type: form.type,
        files: 1,
        downloads: 0,
        fileUrl: json.url,
        paid: form.paid,
        price: form.paid ? Number(form.price) || 0 : 0,
      });
      refresh();
      setForm(emptyForm);
      if (fileRef.current) fileRef.current.value = "";
      showFlash("success", `${form.title.trim()} was uploaded for learners to download.`);
    } catch {
      showFlash("error", "Network error while uploading the file.");
    } finally {
      setUploading(false);
    }
  };

  const onDownload = (resource: Resource) => {
    resourcesStore.upsert({ ...resource, downloads: resource.downloads + 1 });
    refresh();
    if (resource.fileUrl) {
      const a = document.createElement("a");
      a.href = resource.fileUrl;
      a.download = `${resource.title.replace(/\s+/g, "-").toLowerCase()}`;
      a.target = "_blank";
      a.click();
      return;
    }
    showFlash("error", "No file is attached to this resource yet.");
  };

  return (
    <div>
      <PageHeader
        title="Design Resource Center"
        description="Upload PDFs, CAD, images, and templates for learners to download."
        action={
          canUpload ? (
            <Button
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> Upload file
            </Button>
          ) : undefined
        }
      />

      {canUpload && (
        <form
          onSubmit={onUpload}
          className="mb-6 rounded-2xl border border-dashed border-accent/35 bg-accent/5 p-4 sm:p-5"
        >
          <p className="text-sm font-semibold text-foreground">Upload a file</p>
          <p className="mt-1 text-xs text-muted">
            Choose the file first, then add a title and save. Learners will see it below.
          </p>

          <input
            ref={fileRef}
            type="file"
            required
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp,.gif,.svg,.dwg,.dxf,.mp4,.mov"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setForm((f) => ({
                ...f,
                file,
                title: f.title || (file ? file.name.replace(/\.[^.]+$/, "") : ""),
                type: typeFromName(file?.name ?? f.type),
              }));
            }}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-8 text-center transition hover:border-accent/40 hover:bg-surface"
          >
            <Upload className="text-accent" size={28} />
            <span className="mt-2 text-sm font-semibold text-foreground">
              {form.file ? form.file.name : "Click to choose a file"}
            </span>
            <span className="mt-1 text-xs text-muted">
              PDF, Word, images, ZIP, CAD, or video · up to 25 MB
            </span>
          </button>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input
                required
                className={fieldClass}
                value={form.title}
                placeholder="e.g. Colour palette handout"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                required
                className={fieldClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                className={fieldClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Resource["type"] })}
              >
                <option value="PDF">PDF</option>
                <option value="CAD">CAD</option>
                <option value="Video">Video</option>
                <option value="Template">Template</option>
                <option value="Texture">Texture</option>
              </select>
            </Field>
            {form.paid ? (
              <Field label="Price (UGX)">
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </Field>
            ) : (
              <div />
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setForm({ ...form, paid: e.target.checked })}
            />
            This resource is payable (not included in tuition)
          </label>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={uploading}>
              <Plus size={14} />
              {uploading ? "Uploading…" : "Upload to resource centre"}
            </Button>
          </div>
        </form>
      )}

      <div className="mb-6">
        <SearchInput
          placeholder="Search resources..."
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <FileText className="mx-auto mb-3 text-muted" size={28} />
          <p className="text-sm font-medium text-foreground">No resources yet</p>
          <p className="mt-1 text-sm text-muted">
            {canUpload ? "Use Upload file above to add the first handout." : "Staff have not uploaded files yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resource) => {
            const Icon = typeIcons[resource.type];
            return (
              <Card key={resource.id}>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/10">
                    <Icon size={22} className="text-accent-dark" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant="accent">{resource.type}</Badge>
                    {resource.fileUrl ? (
                      <Badge variant="success">File attached</Badge>
                    ) : (
                      <Badge variant="warning">No file</Badge>
                    )}
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{resource.title}</h3>
                <p className="mt-1 text-sm text-muted">{resource.category}</p>
                <p className="mt-1 text-xs font-medium text-accent">
                  {resource.paid
                    ? `Payable · UGX ${resource.price?.toLocaleString() ?? 0}`
                    : "Included with tuition"}
                </p>
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
                      <Download size={14} /> Download
                    </Button>
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(resource)}
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
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete resource"
        description={`Delete “${pendingDelete?.title ?? ""}” and its file from the resource centre?`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          resourcesStore.remove(pendingDelete.id);
          refresh();
          showFlash("success", `${pendingDelete.title} was deleted.`);
        }}
      />
    </div>
  );
}

function typeFromName(name: string): Resource["type"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "Video";
  if (lower.endsWith(".dwg") || lower.endsWith(".dxf") || lower.endsWith(".zip")) return "CAD";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
    return "Texture";
  }
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "Template";
  return "PDF";
}
