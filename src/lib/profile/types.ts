import type { AppRole, PreferredContactMethod } from "@/lib/auth/roles";

export type ProfileFieldName =
  | "displayName"
  | "bio"
  | "phone"
  | "contactMethods"
  | "preferredContactMethod"
  | "contactEmail"
  | "whatsappPhone"
  | "viberPhone"
  | "role"
  | "form";

export type ProfileFormErrors = Partial<Record<ProfileFieldName, string>>;

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: ProfileFormErrors;
};

export type ProfileFormInput = {
  displayName: string;
  bio: string | null;
  phone: string | null;
  contactMethods: PreferredContactMethod[];
  preferredContactMethod: PreferredContactMethod | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  viberPhone: string | null;
  role: AppRole;
};

export const PROFILE_ACTION_IDLE_STATE: ProfileActionState = {
  status: "idle",
};

export type ProfileAvatarActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const PROFILE_AVATAR_ACTION_IDLE_STATE: ProfileAvatarActionState = {
  status: "idle",
};

export type ProfileDeleteActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

export const PROFILE_DELETE_ACTION_IDLE_STATE: ProfileDeleteActionState = {
  status: "idle",
};
