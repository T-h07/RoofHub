"use client";

import { usePathname } from "next/navigation";

export function useActiveRoute() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === href;
    }

    return pathname.startsWith(href);
  };

  return { pathname, isActive };
}
