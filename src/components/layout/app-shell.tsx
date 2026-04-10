import type { ReactNode } from "react";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import type { AppRole } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type AppShellProps = {
  children: ReactNode;
};

type HeaderAuthState = {
  isAuthenticated: boolean;
  email: string | null;
  displayName: string | null;
  role: AppRole | null;
  profileError: string | null;
};

async function getHeaderAuthState(): Promise<HeaderAuthState> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        isAuthenticated: false,
        email: null,
        displayName: null,
        role: null,
        profileError: null,
      };
    }

    const profileResult = await getCurrentUserProfile(supabase);

    if (!profileResult.ok) {
      return {
        isAuthenticated: true,
        email: user.email ?? null,
        displayName: null,
        role: null,
        profileError: profileResult.message,
      };
    }

    return {
      isAuthenticated: true,
      email: user?.email ?? null,
      displayName: profileResult.profile.display_name,
      role: profileResult.profile.role,
      profileError: null,
    };
  } catch {
    return {
      isAuthenticated: false,
      email: null,
      displayName: null,
      role: null,
      profileError: "Profile state could not be loaded.",
    };
  }
}

export async function AppShell({ children }: AppShellProps) {
  const authState = await getHeaderAuthState();

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader authState={authState} />
      <main className="flex-1 py-8 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
