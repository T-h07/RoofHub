import { parseThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme/preference";

export function resolveActiveTheme(preference: ThemePreference, prefersDark: boolean) {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") {
    return "system" satisfies ThemePreference;
  }

  return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const activeTheme = resolveActiveTheme(preference, prefersDark);
  const rootElement = document.documentElement;

  rootElement.classList.toggle("dark", activeTheme === "dark");

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}
