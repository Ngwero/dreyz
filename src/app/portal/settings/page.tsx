"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Button } from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { AppearanceCard } from "@/components/theme/AppearanceCard";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { getSettings, saveSettings, type SchoolSettings } from "@/lib/store";
import { showFlash } from "@/lib/flash";
import { useAuth } from "@/components/auth/AuthProvider";
import { RolePagesSettings } from "@/components/settings/RolePagesSettings";
import { LottiePanel } from "@/components/ui/LottieLoader";
import {
  getRukaPayConfig,
  saveRukaPayConfig,
} from "@/lib/rukapay";
import type { RukaPayConfig } from "@/lib/rukapay";

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [rukaConfig, setRukaConfig] = useState<RukaPayConfig | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setSettings(getSettings());
    setRukaConfig(getRukaPayConfig());
  }, []);

  if (!settings) {
    return <LottiePanel label="Loading settings…" />;
  }

  const persist = (next: SchoolSettings, message: string) => {
    setSettings(next);
    saveSettings(next);
    setSaved(message);
    showFlash("success", message);
    window.setTimeout(() => setSaved(""), 2500);
  };

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    persist(settings, "School profile saved.");
  };

  const onSaveNotifications = (e: FormEvent) => {
    e.preventDefault();
    persist(settings, "Notification preferences saved.");
  };

  const onSaveBranding = (e: FormEvent) => {
    e.preventDefault();
    persist(settings, "Branding updated.");
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your Dreyz Interior Design School platform."
      />

      {user?.role === "super_admin" && <RolePagesSettings />}

      {saved && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {saved}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="School Profile">
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">School Name</label>
              <input
                value={settings.name}
                readOnly
                disabled
                className="mt-1 w-full cursor-not-allowed rounded-xl border border-border bg-surface/70 px-4 py-2.5 text-sm text-muted outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                School name is locked so staff cannot change the live school identity by accident.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tagline</label>
              <input
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Support Email</label>
              <input
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Phones</label>
              <input
                value={settings.phones}
                onChange={(e) => setSettings({ ...settings, phones: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Location</label>
              <input
                value={settings.location}
                onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Website</label>
              <input
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <Button type="submit" size="sm">
              Save Changes
            </Button>
          </form>
        </Card>

        <Card title="Notifications">
          <form onSubmit={onSaveNotifications} className="space-y-4">
            {(
              [
                ["notifyEnrollments", "Email notifications for new enrollments"],
                ["notifyAttendance", "SMS alerts for live session reminders"],
                ["notifyAssessments", "Weekly performance digest"],
                ["notifyNotices", "New project submission alerts"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
            <Button type="submit" size="sm">
              Save Preferences
            </Button>
          </form>
        </Card>

        <Card title="Branding">
          <form onSubmit={onSaveBranding} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-border bg-surface p-2">
                <BrandLogo width={64} height={60} className="h-16 w-16" />
              </div>
              <div>
                <p className="text-sm font-medium">School Logo</p>
                <p className="text-xs text-muted">Transparent PNG — swaps for dark mode</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-lg"
                    style={{ background: settings.primaryColor }}
                  />
                  <input
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                    className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Accent Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-lg"
                    style={{ background: settings.accentColor }}
                  />
                  <input
                    value={settings.accentColor}
                    onChange={(e) =>
                      setSettings({ ...settings, accentColor: e.target.value })
                    }
                    className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" size="sm">
              Update Branding
            </Button>
          </form>
        </Card>

        <Card title="Supabase database">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Connected to Supabase
            </p>
            <p className="text-xs text-muted">
              Project:{" "}
              <code className="text-[11px]">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "not set"}
              </code>
            </p>
            <p className="text-xs text-muted">
              Use live Supabase logins in production. Demo seed passwords are disabled
              unless <code>NEXT_PUBLIC_ALLOW_DEMO_AUTH=true</code>.
            </p>
            <a
              href="/api/supabase/health"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-accent underline"
            >
              Check health endpoint
            </a>
          </div>
        </Card>

        {user?.role === "super_admin" && (
          <Card title="Backup & cleanup">
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                Download a JSON snapshot of roster, payments, attendance, and related
                portal data from this browser (after live hydrate).
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const keys = [
                    "dreyz_learners",
                    "dreyz_payments",
                    "dreyz_attendance",
                    "dreyz_grades",
                    "dreyz_courses",
                    "dreyz_projects",
                    "dreyz_notices",
                    "dreyz_users",
                    "dreyz_tombstones",
                    "dreyz_school_settings",
                  ];
                  const data: Record<string, unknown> = {
                    exportedAt: new Date().toISOString(),
                  };
                  for (const key of keys) {
                    try {
                      const raw = localStorage.getItem(key);
                      data[key] = raw ? JSON.parse(raw) : null;
                    } catch {
                      data[key] = null;
                    }
                  }
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `dreyz-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showFlash("success", "Backup downloaded.");
                }}
              >
                Download backup JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await fetch("/api/learners/purge-demo", { method: "POST" });
                  const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
                  if (!res.ok || !json.ok) {
                    showFlash("error", json.error ?? "Could not purge demo learners.");
                    return;
                  }
                  showFlash("success", json.message ?? "Demo learners purged.");
                  window.location.reload();
                }}
              >
                Purge demo learners (DRY001–008)
              </Button>
            </div>
          </Card>
        )}

        <AppearanceCard />

        {(user?.role === "super_admin" || user?.role === "accountant") && (
        <Card title="RukaPay — Mobile Money Collections (MTN & Airtel)">
          {rukaConfig && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (user?.role !== "super_admin") {
                  showFlash("error", "Only Super Admin can change RukaPay settings.");
                  return;
                }
                saveRukaPayConfig(rukaConfig);
                persist(
                  { ...settings, rukaPayConnected: rukaConfig.enabled },
                  rukaConfig.enabled ? "RukaPay enabled." : "RukaPay disabled."
                );
              }}
              className="space-y-4"
            >
              <p className="text-sm text-muted">
                Set <code>RUKAPAY_API_KEY</code> on the server (.env.local / host). The key never
                leaves the server. Enable collections here and set the webhook URL for RukaPay
                callbacks.
              </p>
              {rukaConfig.environment === "development" && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <strong>Sandbox mode.</strong> Server uses{" "}
                  <code>dev-api.rukapay.net</code> when{" "}
                  <code>RUKAPAY_ENVIRONMENT=development</code>.
                </div>
              )}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rukaConfig.enabled}
                  disabled={user?.role !== "super_admin"}
                  onChange={(e) => setRukaConfig({ ...rukaConfig, enabled: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">Enable RukaPay collections</span>
              </label>
              <div>
                <label className="text-sm font-medium text-foreground">Environment (UI hint)</label>
                <select
                  value={rukaConfig.environment}
                  disabled={user?.role !== "super_admin"}
                  onChange={(e) => setRukaConfig({ ...rukaConfig, environment: e.target.value as "development" | "production" })}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="development">Development (Sandbox)</option>
                  <option value="production">Production (Live)</option>
                </select>
                <p className="mt-1 text-[10px] text-muted">
                  Prefer <code>RUKAPAY_ENVIRONMENT</code> on the server for the real gateway.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Callback URL (for collection webhooks)</label>
                <input
                  value={rukaConfig.webhookUrl}
                  onChange={(e) => setRukaConfig({ ...rukaConfig, webhookUrl: e.target.value })}
                  placeholder={typeof window !== "undefined" ? `${window.location.origin}/api/rukapay/webhook` : "https://yourdomain.com/api/rukapay/webhook"}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 font-mono"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Required for PARTNER_COLLECT_MNO transactions. RukaPay sends payment status to this URL.
                </p>
              </div>
              <Button type="submit" size="sm" disabled={user?.role !== "super_admin"}>
                Save
              </Button>
            </form>
          )}
        </Card>
        )}

        {user?.role === "super_admin" && (
        <Card title="Other Integrations">
          <p className="mb-3 text-xs text-muted">
            These toggles are placeholders only — they do not connect external services yet.
          </p>
          <div className="space-y-3">
            {(
              [
                ["stripeConnected", "Stripe Payments"],
                ["zoomConnected", "Zoom (Live Sessions)"],
                ["mailchimpConnected", "Mailchimp"],
              ] as const
            ).map(([key, name]) => {
              const connected = settings[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border p-4"
                >
                  <div>
                    <span className="text-sm font-medium">{name}</span>
                    <p className="text-xs text-muted">
                      {connected ? "Marked on" : "Marked off"} (not wired)
                    </p>
                  </div>
                  <Button
                    variant={connected ? "outline" : "primary"}
                    size="sm"
                    onClick={() =>
                      persist(
                        { ...settings, [key]: !connected },
                        `${name} preference updated.`
                      )
                    }
                  >
                    {connected ? "Turn off" : "Turn on"}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}
