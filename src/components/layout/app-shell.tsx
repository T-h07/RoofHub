import type { ReactNode } from "react";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import type { AppRole, ProviderAccountType } from "@/lib/auth/roles";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import type { OrganizationMemberRole } from "@/lib/company/team-types";
import { getUnreadNotificationCountForUser } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type AppShellProps = {
  children: ReactNode;
};

type HeaderAuthState = {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: AppRole | null;
  providerAccountType: ProviderAccountType | null;
  companyMembershipRole: OrganizationMemberRole | null;
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
        userId: null,
        email: null,
        displayName: null,
        role: null,
        providerAccountType: null,
        companyMembershipRole: null,
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
        userId: user.id,
        email: user.email ?? null,
        displayName: null,
        role: null,
        providerAccountType: null,
        companyMembershipRole: null,
        profileError: profileResult.message,
        unreadNotificationCount,
      };
    }

    let companyMembershipRole: OrganizationMemberRole | null = null;
    if (
      profileResult.profile.role === "provider" &&
      profileResult.profile.provider_account_type === "company"
    ) {
      const companyContextResult = await getCurrentUserCompanyContext(supabase);
      if (companyContextResult.ok) {
        companyMembershipRole = companyContextResult.company.activeMembership?.role ?? null;
      }
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      email: user?.email ?? null,
      displayName: profileResult.profile.display_name,
      role: profileResult.profile.role,
      providerAccountType: profileResult.profile.provider_account_type,
      companyMembershipRole,
      profileError: null,
      unreadNotificationCount,
    };
  } catch {
    return {
      isAuthenticated: false,
      userId: null,
      email: null,
      displayName: null,
      role: null,
      providerAccountType: null,
      companyMembershipRole: null,
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
