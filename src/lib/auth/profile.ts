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

type EnsureProfileResult =
  | {
      ok: true;
      created: boolean;
    }
  | {
      ok: false;
      message: string;
      reason:
        | "session_unavailable"
        | "profile_fetch_failed"
        | "profile_insert_failed"
        | "profile_insert_verification_failed"
        | "profile_conflict_refetch_failed";
      details?: {
        errorCode?: string | null;
        fetchVariant?: ProfileSelectVariant;
        fetchReasonCategory?: "missing_column" | "query_failed";
      };
    };

type ProfileSelectVariant = "full" | "channel_compatible" | "legacy";
type ProfileFetchFailureDetails = {
  variant: ProfileSelectVariant;
  errorCode: string | null;
  reasonCategory: "missing_column" | "query_failed";
};

type ProfileFetchResult =
  | { ok: true; profile: AppProfile | null; variant: ProfileSelectVariant }
  | {
      ok: false;
      message: string;
      details: ProfileFetchFailureDetails;
    };

export type CurrentAuthProfileResult =
  | { ok: true; user: User; profile: AppProfile; created: boolean }
  | { ok: false; message: string };

function getDisplayNameFromUser(user: User) {
  const metadataValue =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const emailPrefix = user.email?.split("@")[0]?.trim() ?? "";
  const fallback = metadataValue || emailPrefix || "RoofHub User";

  return fallback.length >= 2 ? fallback : `User ${fallback}`.slice(0, 50);
}

function logProfileBootstrapFailure(
  stage:
    | "session_unavailable"
    | "profile_fetch_failed"
    | "profile_insert_failed"
    | "profile_insert_verification_failed"
    | "profile_conflict_refetch_failed",
  details: Record<string, unknown>
) {
  console.error("[Auth][ProfileBootstrap] ensure profile failed", {
    stage,
    ...details,
  });
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
  const queryVariants: Array<{
    id: ProfileSelectVariant;
    select: string;
    normalize: (row: CompatibleAppProfileRow) => AppProfile;
  }> = [
    {
      id: "full",
      select: PROFILE_SELECT,
      normalize: (row) => normalizeProfileRow(row as CompatibleAppProfileRow),
    },
    {
      id: "channel_compatible",
      select:
        "id, role, display_name, avatar_url, phone, bio, preferred_contact_method, contact_methods, created_at, updated_at",
      normalize: (row) =>
        normalizeProfileRow({
          ...(row as CompatibleAppProfileRow),
          contact_email: null,
          whatsapp_phone: null,
          viber_phone: null,
        }),
    },
    {
      id: "legacy",
      select: LEGACY_PROFILE_SELECT,
      normalize: (row) =>
        normalizeProfileRow({
          ...(row as CompatibleAppProfileRow),
          contact_email: null,
          whatsapp_phone: null,
          viber_phone: null,
        }),
    },
  ];

  let lastFailure: ProfileFetchFailureDetails = {
    variant: "full",
    errorCode: null,
    reasonCategory: "query_failed",
  };

  for (const variant of queryVariants) {
    const { data, error } = await supabase
      .from("profiles")
      .select(variant.select)
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      return {
        ok: true,
        profile: data ? variant.normalize(data as unknown as CompatibleAppProfileRow) : null,
        variant: variant.id,
      };
    }

    const isMissingColumnError =
      isMissingContactChannelColumnError(error.message) ||
      isMissingContactMethodsColumnError(error.message);

    lastFailure = {
      variant: variant.id,
      errorCode: error.code ?? null,
      reasonCategory: isMissingColumnError ? "missing_column" : "query_failed",
    };

    if (!isMissingColumnError) {
      break;
    }
  }

  return {
    ok: false,
    message: "Could not load your profile. Please refresh and try again.",
    details: lastFailure,
  };
}

export async function ensureProfileForCurrentUser(
  supabase: SupabaseClient<Database>,
  preferredDisplayName?: string
): Promise<EnsureProfileResult> {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    logProfileBootstrapFailure("session_unavailable", {});
    return {
      ok: false,
      message: "Unable to read your account session.",
      reason: "session_unavailable",
    };
  }

  const existing = await fetchProfileByUserId(supabase, user.id);
  if (!existing.ok) {
    logProfileBootstrapFailure("profile_fetch_failed", {
      user_id: user.id,
      fetch_variant: existing.details.variant,
      fetch_reason_category: existing.details.reasonCategory,
      error_code: existing.details.errorCode,
    });
    return {
      ok: false,
      message: existing.message,
      reason: "profile_fetch_failed",
      details: {
        errorCode: existing.details.errorCode,
        fetchVariant: existing.details.variant,
        fetchReasonCategory: existing.details.reasonCategory,
      },
    };
  }

  if (existing.profile) {
    return { ok: true, created: false };
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
    const createdProfile = await fetchProfileByUserId(supabase, user.id);
    if (!createdProfile.ok || !createdProfile.profile) {
      logProfileBootstrapFailure("profile_insert_verification_failed", {
        user_id: user.id,
        fetch_variant: createdProfile.ok ? "full" : createdProfile.details.variant,
        fetch_reason_category: createdProfile.ok
          ? "query_failed"
          : createdProfile.details.reasonCategory,
        error_code: createdProfile.ok ? null : createdProfile.details.errorCode,
      });
      return {
        ok: false,
        message:
          "Your account session is active, but profile setup could not be verified. Please retry.",
        reason: "profile_insert_verification_failed",
        details: createdProfile.ok
          ? undefined
          : {
              errorCode: createdProfile.details.errorCode,
              fetchVariant: createdProfile.details.variant,
              fetchReasonCategory: createdProfile.details.reasonCategory,
            },
      };
    }

    return { ok: true, created: true };
  }

  if (error.code === "23505") {
    const conflictedProfile = await fetchProfileByUserId(supabase, user.id);
    if (conflictedProfile.ok && conflictedProfile.profile) {
      return { ok: true, created: false };
    }

    logProfileBootstrapFailure("profile_conflict_refetch_failed", {
      user_id: user.id,
      fetch_variant: conflictedProfile.ok ? "full" : conflictedProfile.details.variant,
      fetch_reason_category: conflictedProfile.ok
        ? "query_failed"
        : conflictedProfile.details.reasonCategory,
      error_code: conflictedProfile.ok ? null : conflictedProfile.details.errorCode,
    });
    return {
      ok: false,
      message:
        "Your account session is active, but profile setup could not be verified. Please retry.",
      reason: "profile_conflict_refetch_failed",
      details: conflictedProfile.ok
        ? undefined
        : {
            errorCode: conflictedProfile.details.errorCode,
            fetchVariant: conflictedProfile.details.variant,
            fetchReasonCategory: conflictedProfile.details.reasonCategory,
          },
    };
  }

  logProfileBootstrapFailure("profile_insert_failed", {
    user_id: user.id,
    error_code: error.code ?? null,
  });
  return {
    ok: false,
    message: "Your account was created, but profile setup failed. Please try again.",
    reason: "profile_insert_failed",
    details: {
      errorCode: error.code ?? null,
    },
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
