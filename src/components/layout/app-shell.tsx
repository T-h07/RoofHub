import type { ReactNode } from "react";

import { createServerSupabaseClient } from "@/lib/supabase";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type AppShellProps = {
  children: ReactNode;
};

type HeaderAuthState = {
  isAuthenticated: boolean;
  email: string | null;
};

async function getHeaderAuthState(): Promise<HeaderAuthState> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      isAuthenticated: Boolean(user),
      email: user?.email ?? null,
    };
  } catch {
    return {
      isAuthenticated: false,
      email: null,
    };
  }
}

export async function AppShell({ children }: AppShellProps) {
  const authState = await getHeaderAuthState();

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgba(2,8,23,0.28),transparent_220px)]" />
      <SiteHeader authState={authState} />
      <main className="flex-1 py-8 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
