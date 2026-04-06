export type AuthFieldName = "displayName" | "email" | "password" | "confirmPassword" | "form";

export type AuthFormErrors = Partial<Record<AuthFieldName, string>>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: AuthFormErrors;
  redirectTo?: string;
};

export const AUTH_ACTION_IDLE_STATE: AuthActionState = {
  status: "idle",
};
