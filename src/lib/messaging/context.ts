import "server-only";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createServerSupabaseClient } from "@/lib/supabase";

import type { MessagingFailure, MessagingResult } from "./types";

export type MessagingViewerContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
    ? TResult extends { ok: true; profile: infer TProfile }
      ? TProfile
      : never
    : never;
};

function toFailure(code: MessagingFailure["code"], message: string): MessagingFailure {
  return {
    ok: false,
    code,
    message,
    requiresAuth: code === "auth_required",
  };
}

export function toMessagingFailure(
  code: MessagingFailure["code"],
  message: string
): MessagingFailure {
  return toFailure(code, message);
}

export async function getMessagingViewerContext(): Promise<MessagingResult<MessagingViewerContext>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return toFailure("auth_required", "Sign in to access conversations.");
  }

  const profileResult = await getCurrentUserProfile(supabase);
  if (!profileResult.ok) {
    return toFailure("internal", profileResult.message);
  }

  if (isAdminRole(profileResult.profile.role)) {
    return toFailure(
      "forbidden",
      "Messaging access is limited to seeker and provider participant accounts."
    );
  }

  return {
    ok: true,
    data: {
      supabase,
      profile: profileResult.profile,
    },
  };
}
