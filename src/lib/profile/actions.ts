"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAdminRole, type PreferredContactMethod } from "@/lib/auth/roles";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  removeProfileAvatarByPath,
  removeProfileAvatarByUrl,
  uploadProfileAvatar,
} from "@/lib/supabase/storage/profile-avatars";

import type { ProfileActionState, ProfileAvatarActionState } from "./types";
import { readProfileFormInput, validateProfileFormInput } from "./validation";

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

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "You do not have permission to update this profile photo.";
  }

  return "Profile photo upload failed. Please retry.";
}

function toAvatarRemoveError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "You do not have permission to remove this profile photo.";
  }

  return "Profile photo removal failed. Please retry.";
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

  const nextRole = isAdminRole(currentProfile.role) ? currentProfile.role : input.role;
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
  };
  const extendedUpdatePayload = {
    ...baseUpdatePayload,
    contact_methods: normalizedContactMethods,
    contact_email: input.contactEmail,
    whatsapp_phone: normalizedWhatsappPhone,
    viber_phone: normalizedViberPhone,
  };

  const { error: extendedError } = await supabase
    .from("profiles")
    .update(extendedUpdatePayload)
    .eq("id", currentProfile.id);

  const { error } =
    extendedError && isMissingContactColumnsError(extendedError.message)
      ? await supabase.from("profiles").update(baseUpdatePayload).eq("id", currentProfile.id)
      : { error: extendedError };

  if (error) {
    return {
      status: "error",
      message: toProfileSaveError(error.message),
    };
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
    message: "Profile saved successfully.",
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
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: uploaded.publicUrl,
      })
      .eq("id", profileResult.profile.id);

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

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
    })
    .eq("id", profileResult.profile.id);

  if (updateError) {
    return {
      status: "error",
      message: toAvatarRemoveError(updateError.message),
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
