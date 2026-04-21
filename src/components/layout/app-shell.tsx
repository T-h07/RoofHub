import type { ReactNode } from "react";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import type { AppRole, ProviderAccountType } from "@/lib/auth/roles";
import { getUnreadNotificationCountForUser } from "@/lib/notifications";
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
  providerAccountType: ProviderAccountType | null;
  profileError: string | null;
  unreadNotificationCount: number;
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
        providerAccountType: null,
        profileError: null,
        unreadNotificationCount: 0,
      };
    }

    const unreadNotificationCount = await getUnreadNotificationCountForUser({
      supabase,
      userId: user.id,
    });

    const profileResult = await getCurrentUserProfile(supabase);

    if (!profileResult.ok) {
      return {
        isAuthenticated: true,
        email: user.email ?? null,
        displayName: null,
        role: null,
        providerAccountType: null,
        profileError: profileResult.message,
        unreadNotificationCount,
      };
    }

    return {
      isAuthenticated: true,
      email: user?.email ?? null,
      displayName: profileResult.profile.display_name,
      role: profileResult.profile.role,
      providerAccountType: profileResult.profile.provider_account_type,
      profileError: null,
      unreadNotificationCount,
    };
  } catch {
    return {
      isAuthenticated: false,
      email: null,
      displayName: null,
      role: null,
      providerAccountType: null,
      profileError: "Profile state could not be loaded.",
      unreadNotificationCount: 0,
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
