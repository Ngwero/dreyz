"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/PageElements";
import { ROLE_LABELS } from "@/lib/roles";
import { showFlash } from "@/lib/flash";
import {
  PAGE_FEATURES,
  PAGE_GROUPS,
  defaultRolePages,
  getRolePages,
  saveRolePages,
  type ConfigurableRole,
  type PageFeatureId,
  type RolePages,
} from "@/lib/role-visibility";

const ROLES: ConfigurableRole[] = ["accountant", "tutor", "student"];

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ${
        on ? "bg-[#082878]" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform duration-200 ease-out ${
          on ? "translate-x-[16px]" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function clonePages(pages: RolePages): RolePages {
  return JSON.parse(JSON.stringify(pages)) as RolePages;
}

export function RolePagesSettings() {
  const [saved, setSaved] = useState<RolePages>(() => getRolePages());
  const [pages, setPages] = useState<RolePages>(() => getRolePages());

  useEffect(() => {
    const loaded = getRolePages();
    setSaved(loaded);
    setPages(loaded);
  }, []);

  const dirty = JSON.stringify(pages) !== JSON.stringify(saved);

  const onToggle = (role: ConfigurableRole, id: PageFeatureId, on: boolean) => {
    setPages((prev) => ({
      ...prev,
      [role]: { ...prev[role], [id]: on },
    }));
  };

  const onReset = () => {
    setPages(defaultRolePages());
  };

  const onSave = () => {
    const next = clonePages(pages);
    saveRolePages(next);
    setSaved(next);
    showFlash("success", "Role pages saved.");
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">What people see</h3>
          <p className="mt-1 text-sm text-muted">
            Choose which pages Accountant, Tutor, and Student accounts can open. Dashboard and My
            profile stay on. Super Admin always sees everything.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset defaults
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        {ROLES.map((role) => {
          const flags = pages[role];
          const onCount = PAGE_FEATURES.filter((f) => flags[f.id]).length;
          return (
            <div key={role} className="min-w-0">
              <div className="border-b border-border px-5 py-3.5">
                <p className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {onCount} of {PAGE_FEATURES.length} pages on
                </p>
              </div>
              <div className="divide-y divide-border">
                {PAGE_GROUPS.map((group) => (
                  <div key={group} className="px-5 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {group}
                    </p>
                    <ul className="space-y-0.5">
                      {PAGE_FEATURES.filter((f) => f.group === group).map((feature) => {
                        const on = flags[feature.id];
                        return (
                          <li key={feature.id}>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              onClick={() => onToggle(role, feature.id, !on)}
                              className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082878]/25"
                            >
                              <span className={`text-sm ${on ? "text-foreground" : "text-muted"}`}>
                                {feature.label}
                              </span>
                              <Toggle on={on} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
