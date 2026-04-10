"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAdminRole } from "@/lib/auth/roles";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { createServerSupabaseClient } from "@/lib/supabase";

import type { ProfileActionState } from "./types";
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

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      bio: input.bio,
      phone: input.phone,
      avatar_url: input.avatarUrl,
      preferred_contact_method: input.preferredContactMethod,
      role: nextRole,
    })
    .eq("id", currentProfile.id);

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
