import {
  isEditableAppRole,
  isPreferredContactMethod,
  type AppRole,
  type PreferredContactMethod,
} from "@/lib/auth/roles";

import type { ProfileFormErrors, ProfileFormInput } from "./types";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;
const BIO_MAX = 600;
const PHONE_PATTERN = /^[+0-9().\-\s]{6,24}$/;

function normalizeTrimmed(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: string) {
  return value.length > 0 ? value : null;
}

export function readProfileFormInput(formData: FormData, currentRole: AppRole): ProfileFormInput {
  const displayName = normalizeTrimmed(formData.get("displayName"));
  const bio = toNullable(normalizeTrimmed(formData.get("bio")));
  const phone = toNullable(normalizeTrimmed(formData.get("phone")));
  const avatarUrl = toNullable(normalizeTrimmed(formData.get("avatarUrl")));

  const preferredContactMethodValue = normalizeTrimmed(formData.get("preferredContactMethod"));
  const preferredContactMethod = preferredContactMethodValue
    ? (preferredContactMethodValue as PreferredContactMethod)
    : null;

  const roleValue = normalizeTrimmed(formData.get("role"));
  const role =
    roleValue && isEditableAppRole(roleValue)
      ? roleValue
      : (currentRole as ProfileFormInput["role"]);

  return {
    displayName,
    bio,
    phone,
    avatarUrl,
    preferredContactMethod,
    role,
  };
}

export function validateProfileFormInput(input: ProfileFormInput) {
  const errors: ProfileFormErrors = {};

  if (
    !input.displayName ||
    input.displayName.length < DISPLAY_NAME_MIN ||
    input.displayName.length > DISPLAY_NAME_MAX
  ) {
    errors.displayName = `Display name must be ${DISPLAY_NAME_MIN}-${DISPLAY_NAME_MAX} characters.`;
  }

  if (input.bio && input.bio.length > BIO_MAX) {
    errors.bio = `Bio must be ${BIO_MAX} characters or fewer.`;
  }

  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    errors.phone =
      "Phone should include digits and optional +, spaces, parentheses, dots, or dashes.";
  }

  if (input.avatarUrl) {
    try {
      const url = new URL(input.avatarUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.avatarUrl = "Avatar URL must start with http:// or https://.";
      }
    } catch {
      errors.avatarUrl = "Avatar URL must be a valid URL.";
    }
  }

  if (input.preferredContactMethod && !isPreferredContactMethod(input.preferredContactMethod)) {
    errors.preferredContactMethod = "Select a valid contact method.";
  }

  if (!isEditableAppRole(input.role) && input.role !== "admin") {
    errors.role = "Role selection is invalid.";
  }

  return errors;
}
