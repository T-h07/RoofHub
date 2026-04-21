"use client";

import { useMemo } from "react";

import { getMapStyleUrl } from "@/lib/config/map";
import { useActiveTheme } from "@/lib/theme/use-active-theme";

export function useThemedMapStyleUrl(fallbackStyleUrl?: string) {
  const activeTheme = useActiveTheme();

  return useMemo(() => getMapStyleUrl(activeTheme) || fallbackStyleUrl, [activeTheme, fallbackStyleUrl]);
}
