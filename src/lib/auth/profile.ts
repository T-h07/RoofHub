import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  DEFAULT_APP_ROLE,
  isPreferredContactMethod,
  isProviderAccountType,
} from "@/lib/auth/roles";
import {
  createSchemaDriftMessage,
  isSupabaseSchemaDriftError,
  logSupabaseSchemaDrift,
} from "@/lib/supabase/schema-drift";
import type { Database, Tables } from "@/types/database";

const PROFILE_SELECT =
  "id, role, provider_account_type, active_organization_id, display_name, avatar_url, phone, bio, preferred_contact_method, contact_methods, contact_email, whatsapp_phone, viber_phone, created_at, updated_at";

export type AppProfile = Tables<"profiles">;

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
        fetchReasonCategory?: "schema_drift" | "query_failed";
      };
    };

type ProfileFetchFailureDetails = {
  errorCode: string | null;
  reasonCategory: "schema_drift" | "query_failed";
};

type ProfileFetchResult =
  | { ok: true; profile: AppProfile | null }
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

function normalizeProfileRow(row: AppProfile): AppProfile {
  const normalizedPreferredMethod = isPreferredContactMethod(row.preferred_contact_method)
    ? row.preferred_contact_method
    : null;
  const normalizedContactMethods = Array.isArray(row.contact_methods)
    ? row.contact_methods.filter((method): method is AppProfile["contact_methods"][number] =>
        isPreferredContactMethod(method)
      )
    : [];
  const fallbackContactMethods: AppProfile["contact_methods"] =
    normalizedContactMethods.length > 0
      ? normalizedContactMethods
      : normalizedPreferredMethod
        ? [normalizedPreferredMethod]
        : ["in_app"];

  return {
    ...row,
    active_organization_id: row.active_organization_id ?? null,
    provider_account_type: isProviderAccountType(row.provider_account_type)
      ? row.provider_account_type
      : "individual",
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
  };
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

  if (!error) {
    return {
      ok: true,
      profile: data ? normalizeProfileRow(data as AppProfile) : null,
    };
  }

  const isSchemaDrift = isSupabaseSchemaDriftError(error, [
    "profiles",
    "provider_account_type",
    "active_organization_id",
    "contact_methods",
    "contact_email",
    "whatsapp_phone",
    "viber_phone",
  ]);

  if (isSchemaDrift) {
    logSupabaseSchemaDrift("profiles", error, {
      user_id: userId,
      select: PROFILE_SELECT,
    });
  }

  return {
    ok: false,
    message: isSchemaDrift
      ? createSchemaDriftMessage("Profile")
      : "Could not load your profile. Please refresh and try again.",
    details: {
      errorCode: error.code ?? null,
      reasonCategory: isSchemaDrift ? "schema_drift" : "query_failed",
    },
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
      fetch_reason_category: existing.details.reasonCategory,
      error_code: existing.details.errorCode,
    });
    return {
      ok: false,
      message: existing.message,
      reason: "profile_fetch_failed",
      details: {
        errorCode: existing.details.errorCode,
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
        fetch_reason_category: createdProfile.ok ? "query_failed" : createdProfile.details.reasonCategory,
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
