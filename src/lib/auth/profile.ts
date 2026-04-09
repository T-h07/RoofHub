import type { SupabaseClient, User } from "@supabase/supabase-js";

import { DEFAULT_APP_ROLE, isPreferredContactMethod } from "@/lib/auth/roles";
import type { Database, Tables } from "@/types/database";

const PROFILE_SELECT =
  "id, role, display_name, avatar_url, phone, bio, preferred_contact_method, contact_methods, contact_email, whatsapp_phone, viber_phone, created_at, updated_at";
const LEGACY_PROFILE_SELECT =
  "id, role, display_name, avatar_url, phone, bio, preferred_contact_method, created_at, updated_at";

export type AppProfile = Tables<"profiles">;
type LegacyAppProfileRow = Omit<AppProfile, "contact_methods">;
type CompatibleAppProfileRow = LegacyAppProfileRow & {
  contact_methods?: unknown;
};

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

function isMissingContactMethodsColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("contact_methods") &&
    (normalized.includes("does not exist") || normalized.includes("column"))
  );
}

function isMissingContactChannelColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_email") ||
      normalized.includes("whatsapp_phone") ||
      normalized.includes("viber_phone"))
  );
}

function normalizeProfileRow(row: CompatibleAppProfileRow): AppProfile {
  const normalizedPreferredMethod = isPreferredContactMethod(row.preferred_contact_method)
    ? row.preferred_contact_method
    : null;
  const normalizedContactMethods = Array.isArray(row.contact_methods)
    ? row.contact_methods.filter((method): method is AppProfile["contact_methods"][number] =>
        isPreferredContactMethod(method)
      )
    : [];
  const fallbackContactMethods =
    normalizedContactMethods.length > 0
      ? normalizedContactMethods
      : normalizedPreferredMethod
        ? [normalizedPreferredMethod]
        : ["in_app"];

  return {
    ...row,
    preferred_contact_method: normalizedPreferredMethod,
    contact_methods: fallbackContactMethods,
    contact_email:
      typeof row.contact_email === "string" && row.contact_email.trim().length > 0
        ? row.contact_email.trim().toLowerCase()
        : null,
    whatsapp_phone:
      typeof row.whatsapp_phone === "string" && row.whatsapp_phone.trim().length > 0
        ? row.whatsapp_phone.trim()
        : null,
    viber_phone:
      typeof row.viber_phone === "string" && row.viber_phone.trim().length > 0
        ? row.viber_phone.trim()
        : null,
  } as AppProfile;
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

  if (error && isMissingContactChannelColumnError(error.message)) {
    const { data: channelCompatibleData, error: channelCompatibleError } = await supabase
      .from("profiles")
      .select(
        "id, role, display_name, avatar_url, phone, bio, preferred_contact_method, contact_methods, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (channelCompatibleError && !isMissingContactMethodsColumnError(channelCompatibleError.message)) {
      return {
        ok: false,
        message: "Could not load your profile. Please refresh and try again.",
      };
    }

    if (channelCompatibleData) {
      return {
        ok: true,
        profile: normalizeProfileRow({
          ...(channelCompatibleData as CompatibleAppProfileRow),
          contact_email: null,
          whatsapp_phone: null,
          viber_phone: null,
        }),
      };
    }
  }

  if (error && isMissingContactMethodsColumnError(error.message)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("profiles")
      .select(LEGACY_PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (legacyError) {
      return {
        ok: false,
        message: "Could not load your profile. Please refresh and try again.",
      };
    }

    return {
      ok: true,
      profile: legacyData
        ? normalizeProfileRow({
            ...(legacyData as CompatibleAppProfileRow),
            contact_email: null,
            whatsapp_phone: null,
            viber_phone: null,
          })
        : null,
    };
  }

  if (error) {
    return {
      ok: false,
      message: "Could not load your profile. Please refresh and try again.",
    };
  }

  return {
    ok: true,
    profile: data ? normalizeProfileRow(data as CompatibleAppProfileRow) : null,
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
