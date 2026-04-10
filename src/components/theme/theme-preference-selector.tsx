"use client";

import { Monitor, MoonStar, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { applyThemePreference, getStoredThemePreference } from "@/lib/theme/client";
import type { ThemePreference } from "@/lib/theme/preference";
import { cn } from "@/lib/utils";

const THEME_OPTION_CONFIG: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    hint: "Crisp editorial surfaces",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Low-light viewing",
    icon: MoonStar,
  },
  {
    value: "system",
    label: "System",
    hint: "Follow device setting",
    icon: Monitor,
  },
];

const ACTIVE_THEME_LABEL: Record<ThemePreference, string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System mode",
};

type ThemePreferenceSelectorProps = {
  className?: string;
};

export function ThemePreferenceSelector({ className }: ThemePreferenceSelectorProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getStoredThemePreference()
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (themePreference === "system") {
        applyThemePreference("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [themePreference]);

  const activeThemeLabel = useMemo(
    () => ACTIVE_THEME_LABEL[themePreference],
    [themePreference]
  );

  function onSelectTheme(nextThemePreference: ThemePreference) {
    setThemePreference(nextThemePreference);
    applyThemePreference(nextThemePreference);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Monitor className="text-primary size-4" />
          App appearance
        </p>
        <span className="border-border/70 bg-card rounded-full border px-2.5 py-1 text-xs font-medium">
          {activeThemeLabel}
        </span>
      </div>

      <p className="text-muted-foreground text-sm leading-6">
        Set how RoofHub looks on this device. Your preference is saved per browser.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {THEME_OPTION_CONFIG.map((option) => {
          const OptionIcon = option.icon;
          const isActive = option.value === themePreference;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelectTheme(option.value)}
              className={cn(
                "focus-visible:outline-ring/70 border-border/75 bg-card hover:border-border hover:bg-surface-soft flex min-h-16 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive &&
                  "border-primary/60 bg-primary/10 shadow-[0_12px_28px_-22px_color-mix(in_oklch,var(--primary)_60%,transparent)]"
              )}
            >
              <OptionIcon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold tracking-tight">{option.label}</span>
                <span className="text-muted-foreground block text-xs leading-5">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
