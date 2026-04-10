"use client";

import { useEffect } from "react";

import { applyThemePreference, getStoredThemePreference } from "@/lib/theme/client";
import {
  parseThemePreference,
  THEME_STORAGE_KEY,
} from "@/lib/theme/preference";

export function ThemeSync() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const initialPreference = getStoredThemePreference();

    applyThemePreference(initialPreference);

    const handleSystemThemeChange = () => {
      const currentPreference = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
      if (currentPreference === "system") {
        applyThemePreference(currentPreference);
      }
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const syncedPreference = parseThemePreference(event.newValue);
      applyThemePreference(syncedPreference);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorageSync);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, []);

  return null;
}
