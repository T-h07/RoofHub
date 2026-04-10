export const THEME_STORAGE_KEY = "roofhub-theme-preference";

export const THEME_OPTIONS = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number];

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemePreference(value: string | null): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

