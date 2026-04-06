import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(34,123,255,0.14),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_220px)]" />
      <SiteHeader />
      <main className="flex-1 py-8 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
