export type ActionStatus = "idle" | "error" | "success";

type ActionState<TFieldName extends string> = {
  status: ActionStatus;
  message?: string;
  errors?: Partial<Record<TFieldName, string>>;
};

export type PublicProfileFieldName = "displayName" | "bio" | "form";
export type ContactPreferencesFieldName =
  | "phone"
  | "contactMethods"
  | "preferredContactMethod"
  | "contactEmail"
  | "whatsappPhone"
  | "viberPhone"
  | "form";
export type AccountModeFieldName = "role" | "form";

export type PublicProfileActionState = ActionState<PublicProfileFieldName>;
export type ContactPreferencesActionState = ActionState<ContactPreferencesFieldName>;
export type AccountModeActionState = ActionState<AccountModeFieldName>;

export type PublicProfileFormInput = {
  displayName: string;
  bio: string | null;
};

export type ContactPreferencesFormInput = {
  phone: string | null;
  rawContactMethods: string[];
  contactMethods: import("@/lib/auth/roles").PreferredContactMethod[];
  rawPreferredContactMethod: string | null;
  preferredContactMethod: import("@/lib/auth/roles").PreferredContactMethod | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  viberPhone: string | null;
};

export type AccountModeFormInput = {
  role: string;
};

export const PUBLIC_PROFILE_ACTION_IDLE_STATE: PublicProfileActionState = {
  status: "idle",
};

export const CONTACT_PREFERENCES_ACTION_IDLE_STATE: ContactPreferencesActionState = {
  status: "idle",
};

export const ACCOUNT_MODE_ACTION_IDLE_STATE: AccountModeActionState = {
  status: "idle",
};

export type ProfileAvatarActionState = {
  status: ActionStatus;
  message?: string;
};

export const PROFILE_AVATAR_ACTION_IDLE_STATE: ProfileAvatarActionState = {
  status: "idle",
};

export type ProfileDeleteActionState = {
  status: ActionStatus;
  message?: string;
  redirectTo?: string;
};

export const PROFILE_DELETE_ACTION_IDLE_STATE: ProfileDeleteActionState = {
  status: "idle",
};
