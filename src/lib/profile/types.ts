import type { AppRole, PreferredContactMethod } from "@/lib/auth/roles";

export type ProfileFieldName =
  | "displayName"
  | "bio"
  | "phone"
  | "avatarUrl"
  | "preferredContactMethod"
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
  avatarUrl: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  role: AppRole;
};

export const PROFILE_ACTION_IDLE_STATE: ProfileActionState = {
  status: "idle",
};
