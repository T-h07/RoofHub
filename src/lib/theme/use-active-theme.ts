"use client";

import { useEffect, useState } from "react";

import { THEME_CHANGE_EVENT, type ActiveTheme } from "@/lib/theme/client";

function readDocumentTheme(): ActiveTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useActiveTheme() {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(() => readDocumentTheme());

  useEffect(() => {
    const rootElement = document.documentElement;
    const syncTheme = () => setActiveTheme(readDocumentTheme());

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(rootElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
    };
  }, []);

  return activeTheme;
}
