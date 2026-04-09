import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { toSignInPath } from "@/lib/auth/routing";
import { isAdminRole } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function getAdminRouteContext(nextPath: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath(nextPath));
  }

  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false as const,
      message: profileResult.message,
      profile: null,
      supabase,
      isAdmin: false,
    };
  }

  const isAdmin = isAdminRole(profileResult.profile.role);

  return {
    ok: true as const,
    profile: profileResult.profile,
    supabase,
    isAdmin,
  };
}
