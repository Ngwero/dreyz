"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "light" as const, label: "Light", icon: Sun, hint: "RukaPay blues & lime" },
    { id: "dark" as const, label: "Dark", icon: Moon, hint: "Deep navy night" },
  ];

  return (
    <Card title="Appearance">
      <p className="mb-4 text-sm text-muted">
        Choose how the admin console looks. Your preference is saved on this device.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const Icon = option.icon;
          const active = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                active
                  ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                  : "border-border bg-surface hover:border-accent/40"
              )}
            >
              <Icon size={18} className={active ? "text-accent" : "text-muted"} />
              <div>
                <p className="text-sm font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted">{option.hint}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Monitor size={12} />
        Defaults to your system preference until you choose one.
      </p>
    </Card>
  );
}
