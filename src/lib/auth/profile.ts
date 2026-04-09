import type { SupabaseClient, User } from "@supabase/supabase-js";

import { DEFAULT_APP_ROLE } from "@/lib/auth/roles";
import type { Database, Tables } from "@/types/database";

const PROFILE_SELECT =
  "id, role, display_name, avatar_url, phone, bio, preferred_contact_method, contact_methods, created_at, updated_at";

export type AppProfile = Tables<"profiles">;

type EnsureProfileResult = {
  ok: boolean;
  message?: string;
};

type ProfileFetchResult = { ok: true; profile: AppProfile | null } | { ok: false; message: string };

export type CurrentAuthProfileResult =
  | { ok: true; user: User; profile: AppProfile; created: boolean }
  | { ok: false; message: string };

function getDisplayNameFromUser(user: User) {
  const metadataValue =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const emailPrefix = user.email?.split("@")[0]?.trim() ?? "";
  const fallback = metadataValue || emailPrefix || "NestMap User";

  return fallback.length >= 2 ? fallback : `User ${fallback}`.slice(0, 50);
}

async function getAuthenticatedUser(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function fetchProfileByUserId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: "Could not load your profile. Please refresh and try again.",
    };
  }

  return {
    ok: true,
    profile: data,
  };
}

export async function ensureProfileForCurrentUser(
  supabase: SupabaseClient<Database>,
  preferredDisplayName?: string
): Promise<EnsureProfileResult> {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return {
      ok: false,
      message: "Unable to read your account session.",
    };
  }

  const existing = await fetchProfileByUserId(supabase, user.id);
  if (!existing.ok) {
    return { ok: false, message: existing.message };
  }

  if (existing.profile) {
    return { ok: true };
  }

  const trimmedPreferred = preferredDisplayName?.trim();
  const displayName =
    trimmedPreferred && trimmedPreferred.length >= 2
      ? trimmedPreferred
      : getDisplayNameFromUser(user);

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
    role: DEFAULT_APP_ROLE,
  });

  if (!error) {
    return { ok: true };
  }

  if (error.code === "23505") {
    // Profile already exists due to race.
    return { ok: true };
  }

  return {
    ok: false,
    message: "Your account was created, but profile setup failed. Please try again.",
  };
}

export async function getCurrentUserProfile(
  supabase: SupabaseClient<Database>
): Promise<CurrentAuthProfileResult> {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return {
      ok: false,
      message: "Unable to read your account session.",
    };
  }

  const existing = await fetchProfileByUserId(supabase, user.id);
  if (!existing.ok) {
    return {
      ok: false,
      message: existing.message,
    };
  }

  if (existing.profile) {
    return {
      ok: true,
      user,
      profile: existing.profile,
      created: false,
    };
  }

  const ensureResult = await ensureProfileForCurrentUser(supabase);
  if (!ensureResult.ok) {
    return {
      ok: false,
      message: ensureResult.message ?? "Profile setup failed.",
    };
  }

  const refreshed = await fetchProfileByUserId(supabase, user.id);
  if (!refreshed.ok || !refreshed.profile) {
    return {
      ok: false,
      message:
        "Profile setup completed but profile retrieval failed. Please refresh and try again.",
    };
  }

  return {
    ok: true,
    user,
    profile: refreshed.profile,
    created: true,
  };
}
