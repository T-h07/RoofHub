"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  type AppRole,
  isAdminRole,
  type PreferredContactMethod,
  type ProviderAccountType,
} from "@/lib/auth/roles";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  isMissingSupabaseAdminUrlError,
  isMissingSupabaseServiceRoleError,
  SUPABASE_SERVICE_ROLE_ENV,
  SUPABASE_SERVER_URL_ENV,
} from "@/lib/supabase/admin";
import { hardDeleteAccount } from "@/lib/profile/account-deletion";
import {
  removeProfileAvatarByPath,
  removeProfileAvatarByUrl,
  uploadProfileAvatar,
} from "@/lib/supabase/storage/profile-avatars";

import type {
  ProfileActionState,
  ProfileAvatarActionState,
  ProfileDeleteActionState,
} from "./types";
import { readProfileFormInput, validateProfileFormInput } from "./validation";

type ProfileUpdatePayload = {
  display_name: string;
  bio: string | null;
  phone: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  role: AppRole;
  provider_account_type?: ProviderAccountType;
  contact_methods?: PreferredContactMethod[];
  contact_email?: string | null;
  whatsapp_phone?: string | null;
  viber_phone?: string | null;
};

function toValidationErrorState(errors: ProfileActionState["errors"]): ProfileActionState {
  return {
    status: "error",
    errors,
    message: "Check the highlighted profile fields and try again.",
  };
}

function toProfileSaveError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to update this profile.";
  }

  if (normalized.includes("check constraint")) {
    return "One or more profile values are invalid. Review your inputs and try again.";
  }

  if (isMissingContactColumnsError(message)) {
    return "Profile schema is out of date. Apply the latest Supabase migrations and retry.";
  }

  if (isMissingProviderAccountTypeColumnError(message)) {
    return "Profile schema is out of date. Apply the latest Supabase migrations and retry.";
  }

  if (isUnsupportedExtendedContactMethodEnumError(message)) {
    return "Profile schema is out of date for WhatsApp/Viber contact options. Apply latest Supabase migrations and retry.";
  }

  return "Profile update failed. Please try again.";
}

function toAvatarUploadError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("unsupported profile photo")) {
    return "Use a JPEG, PNG, or WEBP image for your profile photo.";
  }

  if (normalized.includes("exceeds max size")) {
    return "Profile photo is too large. Max allowed size is 5MB.";
  }

  if (normalized.includes("mime type does not match")) {
    return "Profile photo format could not be verified. Please choose a different image.";
  }

  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return "Profile photo storage is not configured yet. Run the latest Supabase migrations and retry.";
  }

  if (
    normalized.includes("violates row-level security") ||
    normalized.includes("new row violates")
  ) {
    return "Profile photo storage permissions are not ready yet. Apply the latest storage policies and retry.";
  }

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "You do not have permission to update this profile photo.";
  }

  return "Profile photo upload failed. Please retry.";
}

function toAvatarRemoveError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return "Profile photo storage is not configured yet.";
  }

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "You do not have permission to remove this profile photo.";
  }

  return "Profile photo removal failed. Please retry.";
}

function toDeleteAccountError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVICE_ROLE_ENV.toLowerCase())
  ) {
    return process.env.NODE_ENV === "production"
      ? "Account deletion is temporarily unavailable because server configuration is incomplete. Contact support and retry."
      : `Account deletion requires ${SUPABASE_SERVICE_ROLE_ENV} in server runtime. Add it to .env.local and restart the dev server.`;
  }

  if (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVER_URL_ENV.toLowerCase())
  ) {
    return process.env.NODE_ENV === "production"
      ? "Account deletion is temporarily unavailable because server configuration is incomplete. Contact support and retry."
      : `Account deletion requires ${SUPABASE_SERVER_URL_ENV} or NEXT_PUBLIC_SUPABASE_URL in server runtime. Configure it in .env.local and restart the dev server.`;
  }

  if (normalized.includes("failed to remove") || normalized.includes("storage")) {
    return "Account deletion failed while removing linked files. Please retry shortly.";
  }

  if (normalized.includes("audit history")) {
    return "Account deletion failed while removing audit history. Please retry shortly.";
  }

  if (normalized.includes("permanently delete account")) {
    return "Account deletion failed at final account-removal step. Please retry.";
  }

  return "Account deletion failed. Please retry.";
}

function getDeleteAccountReasonCategory(error: unknown) {
  if (isMissingSupabaseServiceRoleError(error)) {
    return "missing_service_role_env";
  }
  if (isMissingSupabaseAdminUrlError(error)) {
    return "missing_supabase_url_env";
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("failed to remove") || message.includes("storage")) {
    return "storage_cleanup_failed";
  }

  if (message.includes("audit history")) {
    return "audit_cleanup_failed";
  }

  if (message.includes("failed to permanently delete account")) {
    return "auth_user_delete_failed";
  }

  if (message.includes("failed to load")) {
    return "linked_data_lookup_failed";
  }

  return "unknown_delete_failure";
}

function readConfirmationValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function clearAuthCookies() {
  const cookieStore = await cookies();
  const authCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-") && name.includes("-auth-token"));

  for (const cookieName of authCookieNames) {
    cookieStore.delete(cookieName);
  }
}

function isMissingContactColumnsError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_methods") ||
      normalized.includes("contact_email") ||
      normalized.includes("whatsapp_phone") ||
      normalized.includes("viber_phone"))
  );
}

function isMissingProviderAccountTypeColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("provider_account_type") &&
    (normalized.includes("does not exist") || normalized.includes("column"))
  );
}

function isMissingColumnError(message: string | undefined, columnName: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("column") && normalized.includes(columnName.toLowerCase());
}

function isUnsupportedExtendedContactMethodEnumError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid input value for enum preferred_contact_method") &&
    (normalized.includes("whatsapp") || normalized.includes("viber"))
  );
}

function buildCompatibilityRetryPayload(
  currentPayload: ProfileUpdatePayload,
  errorMessage: string | undefined
) {
  let changed = false;
  const nextPayload: ProfileUpdatePayload = { ...currentPayload };

  if (isMissingProviderAccountTypeColumnError(errorMessage) && "provider_account_type" in nextPayload) {
    delete nextPayload.provider_account_type;
    changed = true;
  }

  if (isMissingColumnError(errorMessage, "contact_methods") && "contact_methods" in nextPayload) {
    delete nextPayload.contact_methods;
    changed = true;
  }

  if (isMissingColumnError(errorMessage, "contact_email") && "contact_email" in nextPayload) {
    delete nextPayload.contact_email;
    changed = true;
  }

  if (isMissingColumnError(errorMessage, "whatsapp_phone") && "whatsapp_phone" in nextPayload) {
    delete nextPayload.whatsapp_phone;
    changed = true;
  }

  if (isMissingColumnError(errorMessage, "viber_phone") && "viber_phone" in nextPayload) {
    delete nextPayload.viber_phone;
    changed = true;
  }

  if (isUnsupportedExtendedContactMethodEnumError(errorMessage)) {
    const currentMethods = nextPayload.contact_methods ?? [];
    const supportedMethods = currentMethods.filter(
      (method) => method !== "whatsapp" && method !== "viber"
    );
    const normalizedMethods: PreferredContactMethod[] =
      supportedMethods.length > 0 ? supportedMethods : ["in_app"];

    if (
      currentMethods.length !== normalizedMethods.length ||
      currentMethods.some((method, index) => method !== normalizedMethods[index])
    ) {
      nextPayload.contact_methods = normalizedMethods;
      changed = true;
    }

    if (
      nextPayload.preferred_contact_method === "whatsapp" ||
      nextPayload.preferred_contact_method === "viber"
    ) {
      nextPayload.preferred_contact_method = normalizedMethods[0] ?? null;
      changed = true;
    }

    if ("whatsapp_phone" in nextPayload) {
      delete nextPayload.whatsapp_phone;
      changed = true;
    }

    if ("viber_phone" in nextPayload) {
      delete nextPayload.viber_phone;
      changed = true;
    }
  }

  return changed ? nextPayload : null;
}

export async function updateProfileAction(
  _: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  const currentProfile = profileResult.profile;
  const input = readProfileFormInput(formData, currentProfile.role);
  const validationErrors = validateProfileFormInput(input);

  if (Object.keys(validationErrors).length > 0) {
    return toValidationErrorState(validationErrors);
  }

  const ownsCompanyWorkspace = currentProfile.provider_account_type === "company";

  if (ownsCompanyWorkspace && input.role !== "provider") {
    return toValidationErrorState({
      role: "Company workspace owners must keep provider role enabled.",
    });
  }

  const nextRole = isAdminRole(currentProfile.role) ? currentProfile.role : input.role;
  const nextProviderAccountType: ProviderAccountType =
    nextRole === "provider"
      ? ownsCompanyWorkspace
        ? "company"
        : "individual"
      : "individual";
  const normalizedContactMethods: PreferredContactMethod[] =
    input.contactMethods.length > 0 ? input.contactMethods : ["in_app"];
  const normalizedPreferredContactMethod =
    input.preferredContactMethod && normalizedContactMethods.includes(input.preferredContactMethod)
      ? input.preferredContactMethod
      : null;
  const normalizedWhatsappPhone =
    input.whatsappPhone ?? (normalizedContactMethods.includes("whatsapp") ? input.phone : null);
  const normalizedViberPhone =
    input.viberPhone ?? (normalizedContactMethods.includes("viber") ? input.phone : null);

  const baseUpdatePayload = {
    display_name: input.displayName,
    bio: input.bio,
    phone: input.phone,
    preferred_contact_method: normalizedPreferredContactMethod,
    role: nextRole,
  } satisfies ProfileUpdatePayload;
  const extendedUpdatePayload = {
    ...baseUpdatePayload,
    provider_account_type: nextProviderAccountType,
    contact_methods: normalizedContactMethods,
    contact_email: input.contactEmail,
    whatsapp_phone: normalizedWhatsappPhone,
    viber_phone: normalizedViberPhone,
  } satisfies ProfileUpdatePayload;

  let payloadForAttempt: ProfileUpdatePayload = extendedUpdatePayload;
  let attemptCount = 0;
  let usedCompatibilityFallback = false;
  const compatibilityFallbackReasons: string[] = [];
  let updatedProfile: { id: string } | null = null;
  let error: { code?: string | null; message: string } | null = null;

  while (attemptCount < 6) {
    const attemptResult = await supabase
      .from("profiles")
      .update(payloadForAttempt)
      .eq("id", currentProfile.id)
      .select("id")
      .limit(1)
      .maybeSingle();

    updatedProfile = attemptResult.data;
    error = attemptResult.error;

    if (!error) {
      break;
    }

    const retryPayload = buildCompatibilityRetryPayload(payloadForAttempt, error.message);
    if (!retryPayload) {
      break;
    }

    usedCompatibilityFallback = true;
    compatibilityFallbackReasons.push(error.message);
    payloadForAttempt = retryPayload;
    attemptCount += 1;
  }

  if (error) {
    console.error("[Profile] update failed", {
      user_id: currentProfile.id,
      error_code: error.code ?? null,
      error_message: error.message,
      used_compatibility_fallback: usedCompatibilityFallback,
    });

    return {
      status: "error",
      message: toProfileSaveError(error.message),
    };
  }

  if (!updatedProfile) {
    return {
      status: "error",
      message: "Profile update was rejected for this account. Refresh and retry.",
    };
  }

  if (usedCompatibilityFallback) {
    console.warn("[Profile] update used compatibility fallback", {
      user_id: currentProfile.id,
      fallback_reasons: compatibilityFallbackReasons,
    });
  }

  if (nextRole !== currentProfile.role) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.profileRoleChanged,
        actorUserId: currentProfile.id,
        actorRole: nextRole,
        targetType: "profile",
        targetId: currentProfile.id,
        metadata: {
          previous_role: currentProfile.role,
          next_role: nextRole,
        },
      },
    });
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");

  return {
    status: "success",
    message: usedCompatibilityFallback
      ? "Profile saved. Some advanced fields may require latest Supabase migrations to persist everywhere."
      : "Profile saved successfully.",
  };
}

export async function uploadProfileAvatarAction(
  _: ProfileAvatarActionState,
  formData: FormData
): Promise<ProfileAvatarActionState> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  const file = formData.get("avatarFile");
  if (!(file instanceof File) || file.size <= 0) {
    return {
      status: "error",
      message: "Choose a profile photo before uploading.",
    };
  }

  try {
    const uploaded = await uploadProfileAvatar(supabase, {
      userId: profileResult.profile.id,
      file,
    });

    const previousAvatarUrl = profileResult.profile.avatar_url;
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: uploaded.publicUrl,
      })
      .eq("id", profileResult.profile.id)
      .select("id")
      .limit(1)
      .maybeSingle();

    if (updateError) {
      try {
        await removeProfileAvatarByPath(supabase, {
          userId: profileResult.profile.id,
          storagePath: uploaded.storagePath,
        });
      } catch {
        // Best effort rollback of uploaded object when profile row update fails.
      }

      return {
        status: "error",
        message: toAvatarUploadError(updateError.message),
      };
    }

    if (!updatedProfile) {
      try {
        await removeProfileAvatarByPath(supabase, {
          userId: profileResult.profile.id,
          storagePath: uploaded.storagePath,
        });
      } catch {
        // Best effort rollback of uploaded object when profile row update fails.
      }

      return {
        status: "error",
        message: "Profile photo update was rejected for this account. Refresh and retry.",
      };
    }

    if (previousAvatarUrl && previousAvatarUrl !== uploaded.publicUrl) {
      try {
        await removeProfileAvatarByUrl(supabase, {
          userId: profileResult.profile.id,
          avatarUrl: previousAvatarUrl,
        });
      } catch {
        // Non-fatal cleanup only.
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/profile");

    return {
      status: "success",
      message: "Profile photo updated.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toAvatarUploadError(error instanceof Error ? error.message : ""),
    };
  }
}

export async function removeProfileAvatarAction(
  state: ProfileAvatarActionState
): Promise<ProfileAvatarActionState> {
  void state;
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  const currentAvatarUrl = profileResult.profile.avatar_url;
  if (!currentAvatarUrl) {
    return {
      status: "success",
      message: "No profile photo to remove.",
    };
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
    })
    .eq("id", profileResult.profile.id)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (updateError) {
    return {
      status: "error",
      message: toAvatarRemoveError(updateError.message),
    };
  }

  if (!updatedProfile) {
    return {
      status: "error",
      message: "Profile photo removal was rejected for this account. Refresh and retry.",
    };
  }

  try {
    await removeProfileAvatarByUrl(supabase, {
      userId: profileResult.profile.id,
      avatarUrl: currentAvatarUrl,
    });
  } catch {
    // Non-fatal cleanup; avatar is already detached from the profile row.
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");

  return {
    status: "success",
    message: "Profile photo removed.",
  };
}

export async function deleteAccountAction(
  _: ProfileDeleteActionState,
  formData: FormData
): Promise<ProfileDeleteActionState> {
  const confirmDeleteText = readConfirmationValue(formData, "confirmDeleteText");
  const confirmEmail = readConfirmationValue(formData, "confirmEmail").toLowerCase();

  if (confirmDeleteText !== "DELETE") {
    return {
      status: "error",
      message: 'Type "DELETE" exactly to confirm permanent account removal.',
    };
  }

  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  const userEmail = profileResult.user.email?.trim().toLowerCase() ?? null;
  if (userEmail && confirmEmail !== userEmail) {
    return {
      status: "error",
      message: "Email confirmation does not match your current account email.",
    };
  }

  try {
    await hardDeleteAccount({
      userId: profileResult.profile.id,
    });

    await clearAuthCookies();
    revalidatePath("/", "layout");
    revalidatePath("/profile");

    return {
      status: "success",
      message: "Your account has been permanently deleted.",
      redirectTo: "/",
    };
  } catch (error) {
    console.error("[Profile][DeleteAccount] hard delete failed", {
      user_id: profileResult.profile.id,
      reason_category: getDeleteAccountReasonCategory(error),
    });

    return {
      status: "error",
      message: toDeleteAccountError(error instanceof Error ? error.message : ""),
    };
  }
}
