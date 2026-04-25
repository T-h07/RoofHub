"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  isAdminRole,
  isEditableAppRole,
  type AppRole,
  type PreferredContactMethod,
  type ProviderAccountType,
} from "@/lib/auth/roles";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
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
  AccountModeActionState,
  ContactPreferencesActionState,
  ProfileAvatarActionState,
  ProfileDeleteActionState,
  PublicProfileActionState,
} from "./types";
import {
  readAccountModeFormInput,
  readContactPreferencesFormInput,
  readPublicProfileFormInput,
  validateAccountModeFormInput,
  validateContactPreferencesFormInput,
  validatePublicProfileFormInput,
} from "./validation";

type ProfileUpdatePayload = {
  display_name?: string;
  bio?: string | null;
  phone?: string | null;
  preferred_contact_method?: PreferredContactMethod | null;
  role?: AppRole;
  provider_account_type?: ProviderAccountType;
  contact_methods?: PreferredContactMethod[];
  contact_email?: string | null;
  whatsapp_phone?: string | null;
  viber_phone?: string | null;
  avatar_url?: string | null;
};

function toProfileUpdateError(message: string, fallbackMessage: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to update this account setting.";
  }

  if (normalized.includes("check constraint")) {
    return "One or more values are invalid. Review the section and try again.";
  }

  return fallbackMessage;
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
    return "Profile photo storage is not configured yet. Apply the latest Supabase migrations and retry.";
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

  if (
    normalized.includes("transfer company ownership") ||
    normalized.includes("transfer ownership first") ||
    normalized.includes("company ownership") ||
    normalized.includes("ownership transfer member") ||
    normalized.includes("company profile")
  ) {
    return message;
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

  if (
    message.includes("transfer ownership") ||
    message.includes("company profile") ||
    message.includes("last active owner")
  ) {
    return "company_ownership_resolution_failed";
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

async function getProfileMutationContext() {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false as const,
      message: profileResult.message,
    };
  }

  return {
    ok: true as const,
    supabase,
    profile: profileResult.profile,
    user: profileResult.user,
  };
}

async function persistProfileUpdate(
  userId: string,
  payload: ProfileUpdatePayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Profile] update failed", {
      user_id: userId,
      error_code: error.code ?? null,
      error_message: error.message,
      payload_keys: Object.keys(payload),
    });

    return {
      ok: false,
      message: error.message,
    };
  }

  if (!data) {
    return {
      ok: false,
      message: "Profile update was rejected for this account. Refresh and retry.",
    };
  }

  return { ok: true };
}

function revalidateProfileSurface() {
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
}

export async function updatePublicProfileAction(
  _: PublicProfileActionState,
  formData: FormData
): Promise<PublicProfileActionState> {
  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
    };
  }

  const input = readPublicProfileFormInput(formData);
  const validationErrors = validatePublicProfileFormInput(input);
  if (Object.keys(validationErrors).length > 0) {
    return {
      status: "error",
      errors: validationErrors,
      message: "Check the highlighted public profile fields and try again.",
    };
  }

  const result = await persistProfileUpdate(context.profile.id, {
    display_name: input.displayName,
    bio: input.bio,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: toProfileUpdateError(
        result.message,
        "Public profile update failed. Please try again."
      ),
    };
  }

  revalidateProfileSurface();

  return {
    status: "success",
    message: "Public profile saved.",
  };
}

export async function updateContactPreferencesAction(
  _: ContactPreferencesActionState,
  formData: FormData
): Promise<ContactPreferencesActionState> {
  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
    };
  }

  const input = readContactPreferencesFormInput(formData);
  const validationErrors = validateContactPreferencesFormInput(input);
  if (Object.keys(validationErrors).length > 0) {
    return {
      status: "error",
      errors: validationErrors,
      message: "Check the highlighted contact preference fields and try again.",
    };
  }

  const normalizedContactMethods = input.contactMethods;
  const normalizedPreferredContactMethod =
    input.preferredContactMethod && normalizedContactMethods.includes(input.preferredContactMethod)
      ? input.preferredContactMethod
      : null;
  const normalizedWhatsappPhone =
    input.whatsappPhone ?? (normalizedContactMethods.includes("whatsapp") ? input.phone : null);
  const normalizedViberPhone =
    input.viberPhone ?? (normalizedContactMethods.includes("viber") ? input.phone : null);

  const result = await persistProfileUpdate(context.profile.id, {
    phone: input.phone,
    preferred_contact_method: normalizedPreferredContactMethod,
    contact_methods: normalizedContactMethods,
    contact_email: input.contactEmail,
    whatsapp_phone: normalizedWhatsappPhone,
    viber_phone: normalizedViberPhone,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: toProfileUpdateError(
        result.message,
        "Contact preferences update failed. Please try again."
      ),
    };
  }

  revalidateProfileSurface();

  return {
    status: "success",
    message: "Contact preferences saved.",
  };
}

export async function updateAccountModeAction(
  _: AccountModeActionState,
  formData: FormData
): Promise<AccountModeActionState> {
  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
    };
  }

  const input = readAccountModeFormInput(formData);
  const validationErrors = validateAccountModeFormInput(input);
  if (Object.keys(validationErrors).length > 0) {
    return {
      status: "error",
      errors: validationErrors,
      message: "Check the account mode selection and try again.",
    };
  }

  if (!isEditableAppRole(input.role) && !isAdminRole(context.profile.role)) {
    return {
      status: "error",
      errors: {
        role: "Role selection is invalid.",
      },
      message: "Check the account mode selection and try again.",
    };
  }

  const companyContextResult = await getCurrentUserCompanyContext(context.supabase);
  if (!companyContextResult.ok) {
    return {
      status: "error",
      message: companyContextResult.message,
    };
  }

  const hasCompanyMembership = companyContextResult.company.activeMemberships.length > 0;
  const hasCompanyProviderMode = context.profile.provider_account_type === "company";

  if ((hasCompanyMembership || hasCompanyProviderMode) && input.role !== "provider") {
    return {
      status: "error",
      errors: {
        role: "Company workspace owners must keep provider role enabled.",
      },
      message: "Company-linked accounts must remain in provider mode.",
    };
  }

  const nextRole = isAdminRole(context.profile.role)
    ? context.profile.role
    : (input.role as AppRole);
  const nextProviderAccountType: ProviderAccountType =
    nextRole === "provider"
      ? hasCompanyMembership || hasCompanyProviderMode
        ? "company"
        : "individual"
      : "individual";

  const result = await persistProfileUpdate(context.profile.id, {
    role: nextRole,
    provider_account_type: nextProviderAccountType,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: toProfileUpdateError(
        result.message,
        "Account mode update failed. Please try again."
      ),
    };
  }

  if (nextRole !== context.profile.role) {
    await recordSecurityAuditEvent({
      supabase: context.supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.profileRoleChanged,
        actorUserId: context.profile.id,
        actorRole: nextRole,
        targetType: "profile",
        targetId: context.profile.id,
        metadata: {
          previous_role: context.profile.role,
          next_role: nextRole,
        },
      },
    });
  }

  revalidateProfileSurface();

  return {
    status: "success",
    message: "Account mode saved.",
  };
}

export async function uploadProfileAvatarAction(
  _: ProfileAvatarActionState,
  formData: FormData
): Promise<ProfileAvatarActionState> {
  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
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
    const uploaded = await uploadProfileAvatar(context.supabase, {
      userId: context.profile.id,
      file,
    });

    const previousAvatarUrl = context.profile.avatar_url;
    const updateResult = await persistProfileUpdate(context.profile.id, {
      avatar_url: uploaded.publicUrl,
    });

    if (!updateResult.ok) {
      try {
        await removeProfileAvatarByPath(context.supabase, {
          userId: context.profile.id,
          storagePath: uploaded.storagePath,
        });
      } catch {
        // Best effort rollback of uploaded object when profile row update fails.
      }

      return {
        status: "error",
        message: toAvatarUploadError(updateResult.message),
      };
    }

    if (previousAvatarUrl && previousAvatarUrl !== uploaded.publicUrl) {
      try {
        await removeProfileAvatarByUrl(context.supabase, {
          userId: context.profile.id,
          avatarUrl: previousAvatarUrl,
        });
      } catch {
        // Non-fatal cleanup only.
      }
    }

    revalidateProfileSurface();

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
  currentState: ProfileAvatarActionState
): Promise<ProfileAvatarActionState> {
  void currentState;
  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
    };
  }

  const currentAvatarUrl = context.profile.avatar_url;
  if (!currentAvatarUrl) {
    return {
      status: "success",
      message: "No profile photo to remove.",
    };
  }

  const updateResult = await persistProfileUpdate(context.profile.id, {
    avatar_url: null,
  });

  if (!updateResult.ok) {
    return {
      status: "error",
      message: toAvatarRemoveError(updateResult.message),
    };
  }

  try {
    await removeProfileAvatarByUrl(context.supabase, {
      userId: context.profile.id,
      avatarUrl: currentAvatarUrl,
    });
  } catch {
    // Non-fatal cleanup; avatar is already detached from the profile row.
  }

  revalidateProfileSurface();

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
  const organizationMode = readConfirmationValue(formData, "organizationDeleteMode");
  const transferTargetUserId = readConfirmationValue(formData, "transferTargetUserId");

  if (confirmDeleteText !== "DELETE") {
    return {
      status: "error",
      message: 'Type "DELETE" exactly to confirm permanent account removal.',
    };
  }

  const context = await getProfileMutationContext();
  if (!context.ok) {
    return {
      status: "error",
      message: context.message,
    };
  }

  const userEmail = context.user.email?.trim().toLowerCase() ?? null;
  if (userEmail && confirmEmail !== userEmail) {
    return {
      status: "error",
      message: "Email confirmation does not match your current account email.",
    };
  }

  try {
    await hardDeleteAccount({
      userId: context.profile.id,
      organizationMode: organizationMode || null,
      transferTargetUserId: transferTargetUserId || null,
    });

    await clearAuthCookies();
    revalidateProfileSurface();

    return {
      status: "success",
      message: "Your account has been permanently deleted.",
      redirectTo: "/",
    };
  } catch (error) {
    console.error("[Profile][DeleteAccount] hard delete failed", {
      user_id: context.profile.id,
      reason_category: getDeleteAccountReasonCategory(error),
      error_message: error instanceof Error ? error.message : "unknown_error",
    });

    return {
      status: "error",
      message: toDeleteAccountError(error instanceof Error ? error.message : ""),
    };
  }
}
