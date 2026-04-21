import {
  isEditableAppRole,
  isPreferredContactMethod,
  type PreferredContactMethod,
} from "@/lib/auth/roles";

import type {
  AccountModeActionState,
  AccountModeFormInput,
  ContactPreferencesActionState,
  ContactPreferencesFormInput,
  PublicProfileActionState,
  PublicProfileFormInput,
} from "./types";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;
const BIO_MAX = 600;
const PHONE_PATTERN = /^[+0-9().\-\s]{6,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REQUIRED_CONTACT_METHODS = new Set<PreferredContactMethod>([
  "phone",
  "whatsapp",
  "viber",
]);
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

export function readPublicProfileFormInput(formData: FormData): PublicProfileFormInput {
  return {
    displayName: normalizeTrimmed(formData.get("displayName")),
    bio: toNullable(normalizeTrimmed(formData.get("bio"))),
  };
}

export function validatePublicProfileFormInput(input: PublicProfileFormInput) {
  const errors: PublicProfileActionState["errors"] = {};

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

  return errors;
}

export function readContactPreferencesFormInput(
  formData: FormData
): ContactPreferencesFormInput {
  const rawContactMethods = formData
    .getAll("contactMethods")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  const rawPreferredContactMethod = toNullable(
    normalizeTrimmed(formData.get("preferredContactMethod"))
  );

  return {
    phone: toNullable(normalizeTrimmed(formData.get("phone"))),
    rawContactMethods,
    contactMethods: Array.from(
      new Set(
        rawContactMethods.filter((method): method is PreferredContactMethod =>
          isPreferredContactMethod(method)
        )
      )
    ),
    rawPreferredContactMethod,
    preferredContactMethod:
      rawPreferredContactMethod && isPreferredContactMethod(rawPreferredContactMethod)
        ? rawPreferredContactMethod
        : null,
    contactEmail:
      toNullable(normalizeTrimmed(formData.get("contactEmail")))?.toLowerCase() ?? null,
    whatsappPhone: toNullable(normalizeTrimmed(formData.get("whatsappPhone"))),
    viberPhone: toNullable(normalizeTrimmed(formData.get("viberPhone"))),
  };
}

export function validateContactPreferencesFormInput(input: ContactPreferencesFormInput) {
  const errors: ContactPreferencesActionState["errors"] = {};

  if (input.rawContactMethods.length === 0) {
    errors.contactMethods = "Choose at least one contact channel.";
  }

  if (input.rawContactMethods.length !== input.contactMethods.length) {
    errors.contactMethods = "Contact channels contain an invalid selection.";
  }

  if (
    input.rawPreferredContactMethod &&
    !isPreferredContactMethod(input.rawPreferredContactMethod)
  ) {
    errors.preferredContactMethod = "Select a valid contact method.";
  }

  if (
    input.preferredContactMethod &&
    !input.contactMethods.includes(input.preferredContactMethod)
  ) {
    errors.preferredContactMethod =
      "Primary contact method must also be enabled in contact channels.";
  }

  if (input.phone && !PHONE_PATTERN.test(input.phone)) {
    errors.phone =
      "Phone should include digits and optional +, spaces, parentheses, dots, or dashes.";
  }

  if (
    input.preferredContactMethod &&
    PHONE_REQUIRED_CONTACT_METHODS.has(input.preferredContactMethod) &&
    !input.phone &&
    !input.whatsappPhone &&
    !input.viberPhone
  ) {
    errors.phone = "Add at least one phone-based contact number for the primary channel.";
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

  return errors;
}

export function readAccountModeFormInput(formData: FormData): AccountModeFormInput {
  return {
    role: normalizeTrimmed(formData.get("role")),
  };
}

export function validateAccountModeFormInput(input: AccountModeFormInput) {
  const errors: AccountModeActionState["errors"] = {};

  if (!isEditableAppRole(input.role) && input.role !== "admin") {
    errors.role = "Role selection is invalid.";
  }

  return errors;
}

export { CONTACT_METHOD_OPTIONS };
