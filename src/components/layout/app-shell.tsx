import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgba(2,8,23,0.28),transparent_220px)]" />
      <SiteHeader />
      <main className="flex-1 py-8 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
