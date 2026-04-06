import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type EnsureProfileResult = {
  ok: boolean;
  message?: string;
};

function getDisplayNameFromUser(user: User) {
  const metadataValue =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const emailPrefix = user.email?.split("@")[0]?.trim() ?? "";
  const fallback = metadataValue || emailPrefix || "NestMap User";

  return fallback.length >= 2 ? fallback : `User ${fallback}`.slice(0, 50);
}

export async function ensureProfileForCurrentUser(
  supabase: SupabaseClient<Database>,
  preferredDisplayName?: string
): Promise<EnsureProfileResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: "Unable to read your account session.",
    };
  }

  const trimmedPreferred = preferredDisplayName?.trim();
  const displayName =
    trimmedPreferred && trimmedPreferred.length >= 2
      ? trimmedPreferred
      : getDisplayNameFromUser(user);

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
  });

  if (!error) {
    return { ok: true };
  }

  if (error.code === "23505") {
    // Profile already exists.
    return { ok: true };
  }

  return {
    ok: false,
    message: "Your account was created, but profile setup failed. Please try again.",
  };
}
