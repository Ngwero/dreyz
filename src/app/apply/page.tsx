"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { classOptions, schoolInfo, admissionRequirements } from "@/lib/data";
import { publicFeeTracksLive } from "@/lib/fee-catalog";
import { currentOpenIntake, INTAKE_OPTIONS } from "@/lib/intakes";
import { formatUGX } from "@/lib/utils";
import { applicationsStore } from "@/lib/store";
import { showFlash } from "@/lib/flash";

export default function ApplyPage() {
  const tracks = useMemo(() => publicFeeTracksLive(), []);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    feeTrackId: tracks[0]?.id ?? "4-month",
    classOptionId: classOptions[0]?.id ?? "weekday",
    intake: currentOpenIntake(),
    notes: "",
  });
  const [idPhotoUrl, setIdPhotoUrl] = useState("");
  const [idPhotoName, setIdPhotoName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showFlash("error", "Photo must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIdPhotoUrl(String(reader.result ?? ""));
      setIdPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idPhotoUrl: idPhotoUrl || undefined }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        application?: Parameters<typeof applicationsStore.upsert>[0];
        message?: string;
      };
      if (!res.ok || !data.ok) {
        showFlash("error", data.error ?? "Could not submit application.");
        return;
      }
      if (data.application) {
        applicationsStore.upsert(data.application);
      }
      setDone(true);
      showFlash("success", data.message ?? "Application submitted.");
    } catch {
      showFlash("error", "Network error while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#eef4ff,_#f8fafc_55%)] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <BrandLogo />
          <Link href="/login" className="text-sm font-medium text-[#082878]">
            Sign in
          </Link>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-[#082878]">
          Apply to {schoolInfo.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Submit your details for the {currentOpenIntake()} intake. Payment is handled
          separately after the school reviews your application.
        </p>

        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6">
            <p className="font-semibold text-emerald-800">Application received</p>
            <p className="mt-2 text-sm text-slate-600">
              We will review your application and contact you at {form.email}. You can
              create a portal login later when admissions confirms you.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-[#082878] underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Full name</span>
              <input
                required
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                required
                type="email"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Phone</span>
              <input
                required
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Programme</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.feeTrackId}
                onChange={(e) => setForm({ ...form, feeTrackId: e.target.value })}
              >
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatUGX(t.total)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Class option</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.classOptionId}
                onChange={(e) => setForm({ ...form, classOptionId: e.target.value })}
              >
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.days} · {c.time}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Intake</span>
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.intake}
                onChange={(e) => setForm({ ...form, intake: e.target.value })}
              >
                {INTAKE_OPTIONS.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Soft-copy photo / ID (optional)
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="mt-1.5 block w-full text-sm"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              {idPhotoName && (
                <p className="mt-1 text-xs text-slate-500">Attached: {idPhotoName}</p>
              )}
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Notes</span>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">You will also need</p>
              <ul className="mt-1 list-disc pl-4">
                {admissionRequirements.slice(0, 4).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#082878] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
