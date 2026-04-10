import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PreferredContactMethod = Database["public"]["Enums"]["preferred_contact_method"];

export const APP_ROLE_VALUES = ["seeker", "provider", "admin"] as const;
export const EDITABLE_APP_ROLE_VALUES = ["seeker", "provider"] as const;
export const DEFAULT_APP_ROLE: AppRole = "seeker";

export const PREFERRED_CONTACT_METHOD_VALUES = [
  "in_app",
  "phone",
  "email",
  "whatsapp",
  "viber",
] as const;

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_VALUES.includes(value as AppRole);
}

export function isEditableAppRole(
  value: unknown
): value is (typeof EDITABLE_APP_ROLE_VALUES)[number] {
  return (
    typeof value === "string" &&
    EDITABLE_APP_ROLE_VALUES.includes(value as (typeof EDITABLE_APP_ROLE_VALUES)[number])
  );
}

export function isPreferredContactMethod(value: unknown): value is PreferredContactMethod {
  return (
    typeof value === "string" &&
    PREFERRED_CONTACT_METHOD_VALUES.includes(value as PreferredContactMethod)
  );
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "admin";
}

export function isProviderRole(role: AppRole | null | undefined) {
  return role === "provider";
}

export function getRoleLabel(role: AppRole) {
  switch (role) {
    case "provider":
      return "Provider";
    case "admin":
      return "Admin";
    case "seeker":
    default:
      return "Seeker";
  }
}

export function getRoleDescription(role: AppRole) {
  switch (role) {
    case "provider":
      return "Publish listings, manage inventory, and respond to inquiries.";
    case "admin":
      return "Admin access is managed securely and not editable from public profile settings.";
    case "seeker":
    default:
      return "Browse listings, save favorites, and message providers.";
  }
}
