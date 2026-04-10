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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REQUIRED_CONTACT_METHODS = new Set(["phone", "whatsapp", "viber"]);
const CONTACT_METHOD_OPTIONS: PreferredContactMethod[] = [
  "in_app",
  "phone",
  "email",
  "whatsapp",
  "viber",
];

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
  const contactEmail = toNullable(normalizeTrimmed(formData.get("contactEmail")))?.toLowerCase() ?? null;
  const whatsappPhone = toNullable(normalizeTrimmed(formData.get("whatsappPhone")));
  const viberPhone = toNullable(normalizeTrimmed(formData.get("viberPhone")));

  const rawContactMethods = formData
    .getAll("contactMethods")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  const contactMethods = Array.from(
    new Set(
      rawContactMethods.filter((method): method is PreferredContactMethod =>
        isPreferredContactMethod(method)
      )
    )
  );

  const preferredContactMethodValue = normalizeTrimmed(formData.get("preferredContactMethod"));
  const preferredContactMethod = preferredContactMethodValue
    ? isPreferredContactMethod(preferredContactMethodValue)
      ? preferredContactMethodValue
      : null
    : null;
  const effectiveContactMethods =
    preferredContactMethod && !contactMethods.includes(preferredContactMethod)
      ? Array.from(new Set([preferredContactMethod, ...contactMethods]))
      : contactMethods;

  const roleValue = normalizeTrimmed(formData.get("role"));
  const role =
    roleValue && isEditableAppRole(roleValue)
      ? roleValue
      : (currentRole as ProfileFormInput["role"]);

  return {
    displayName,
    bio,
    phone,
    contactMethods: effectiveContactMethods,
    preferredContactMethod,
    contactEmail,
    whatsappPhone,
    viberPhone,
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

  if (!Array.isArray(input.contactMethods) || input.contactMethods.length === 0) {
    errors.contactMethods = "Choose at least one contact channel.";
  } else {
    const hasInvalidContactMethod = input.contactMethods.some(
      (method) => !CONTACT_METHOD_OPTIONS.includes(method)
    );
    if (hasInvalidContactMethod) {
      errors.contactMethods = "Contact channels contain an invalid selection.";
    }
  }

  if (input.preferredContactMethod && !isPreferredContactMethod(input.preferredContactMethod)) {
    errors.preferredContactMethod = "Select a valid contact method.";
  }

  if (
    input.preferredContactMethod &&
    input.contactMethods.length > 0 &&
    !input.contactMethods.includes(input.preferredContactMethod)
  ) {
    errors.preferredContactMethod =
      "Primary contact method must also be enabled in contact channels.";
  }

  if (
    input.preferredContactMethod &&
    PHONE_REQUIRED_CONTACT_METHODS.has(input.preferredContactMethod) &&
    !input.phone
  ) {
    errors.phone = "Phone is required when phone, WhatsApp, or Viber is preferred.";
  }

  if (
    input.contactMethods.some((method) => PHONE_REQUIRED_CONTACT_METHODS.has(method)) &&
    !input.phone &&
    !input.whatsappPhone &&
    !input.viberPhone
  ) {
    errors.phone = "Add at least one phone-based contact number for enabled channels.";
  }

  if (input.contactEmail && !EMAIL_PATTERN.test(input.contactEmail)) {
    errors.contactEmail = "Enter a valid contact email address.";
  }

  if (input.contactMethods.includes("email") && !input.contactEmail) {
    errors.contactEmail = "Contact email is required when email contact is enabled.";
  }

  if (input.whatsappPhone && !PHONE_PATTERN.test(input.whatsappPhone)) {
    errors.whatsappPhone =
      "WhatsApp number should include digits and optional +, spaces, parentheses, dots, or dashes.";
  }

  if (input.viberPhone && !PHONE_PATTERN.test(input.viberPhone)) {
    errors.viberPhone =
      "Viber number should include digits and optional +, spaces, parentheses, dots, or dashes.";
  }

  if (input.contactMethods.includes("whatsapp") && !input.whatsappPhone && !input.phone) {
    errors.whatsappPhone = "Add a WhatsApp number or fallback phone number.";
  }

  if (input.contactMethods.includes("viber") && !input.viberPhone && !input.phone) {
    errors.viberPhone = "Add a Viber number or fallback phone number.";
  }

  if (!isEditableAppRole(input.role) && input.role !== "admin") {
    errors.role = "Role selection is invalid.";
  }

  return errors;
}
