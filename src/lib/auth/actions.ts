"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { ensureProfileForCurrentUser } from "./profile";
import {
  AUTH_CALLBACK_ROUTE,
  AUTH_DEFAULT_REDIRECT_PATH,
  AUTH_RESET_PASSWORD_ROUTE,
  resolveAuthenticatedRedirect,
} from "./routing";
import type { AuthActionState } from "./types";
import { buildAbsolutePath } from "./url";
import {
  readAuthCredentials,
  readResetPasswordFields,
  readSignUpFields,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateSignInInput,
  validateSignUpInput,
} from "./validation";

function toSignInError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed") ||
    normalized.includes("invalid credentials")
  ) {
    return "Email or password is incorrect.";
  }

  if (normalized.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return "Could not sign you in. Please try again.";
}

function toSignUpError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered")) {
    return "An account with that email already exists. Sign in instead.";
  }

  if (normalized.includes("password")) {
    return "Password does not meet requirements. Use at least 8 characters.";
  }

  return "Could not create your account. Please try again.";
}

function toForgotPasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Please wait before requesting another reset email.";
  }

  return "Could not send reset instructions right now. Please try again.";
}

function toResetPasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("session") || normalized.includes("token")) {
    return "Your reset session has expired. Request a new reset link.";
  }

  if (normalized.includes("password")) {
    return "Password update failed. Use at least 8 characters and try again.";
  }

  return "Could not update your password. Please try again.";
}

function getRequestedNextPath(formData: FormData) {
  const next = formData.get("next");
  return typeof next === "string" ? next : null;
}

function toValidationErrorState(errors: AuthActionState["errors"]): AuthActionState {
  return {
    status: "error",
    errors,
    message: "Check the highlighted fields and try again.",
  };
}

export async function signInAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const nextPath = resolveAuthenticatedRedirect(
    getRequestedNextPath(formData),
    AUTH_DEFAULT_REDIRECT_PATH
  );
  const credentials = readAuthCredentials(formData);
  const errors = validateSignInInput(credentials);

  if (Object.keys(errors).length > 0) {
    return toValidationErrorState(errors);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return {
      status: "error",
      message: toSignInError(error.message),
    };
  }

  const profileResult = await ensureProfileForCurrentUser(supabase);
  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  revalidatePath("/", "layout");

  return {
    status: "success",
    redirectTo: nextPath,
  };
}

export async function signUpAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const requestedNextPath = getRequestedNextPath(formData);
  const nextPath = resolveAuthenticatedRedirect(requestedNextPath, AUTH_DEFAULT_REDIRECT_PATH);
  const input = readSignUpFields(formData);
  const errors = validateSignUpInput(input);

  if (Object.keys(errors).length > 0) {
    return toValidationErrorState(errors);
  }

  const emailRedirectTo = await buildAbsolutePath(
    `${AUTH_CALLBACK_ROUTE}?next=${encodeURIComponent(nextPath)}`
  );
  if (!emailRedirectTo) {
    return {
      status: "error",
      message: "Could not determine this environment URL. Set NEXT_PUBLIC_SITE_URL and try again.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        display_name: input.displayName,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: toSignUpError(error.message),
    };
  }

  if (data.session) {
    const profileResult = await ensureProfileForCurrentUser(supabase, input.displayName);
    if (!profileResult.ok) {
      return {
        status: "error",
        message: profileResult.message,
      };
    }

    revalidatePath("/", "layout");

    return {
      status: "success",
      message: "Account created successfully.",
      redirectTo: nextPath,
    };
  }

  return {
    status: "success",
    message:
      "Check your email to confirm your account. After confirmation, you can continue in RoofHub.",
  };
}

export async function requestPasswordResetAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const input = readAuthCredentials(formData);
  const errors = validateForgotPasswordInput({ email: input.email });

  if (Object.keys(errors).length > 0) {
    return toValidationErrorState(errors);
  }

  const resetRedirectTo = await buildAbsolutePath(
    `${AUTH_CALLBACK_ROUTE}?next=${encodeURIComponent(AUTH_RESET_PASSWORD_ROUTE)}`
  );
  if (!resetRedirectTo) {
    return {
      status: "error",
      message: "Could not determine this environment URL. Set NEXT_PUBLIC_SITE_URL and try again.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: resetRedirectTo,
  });

  if (error) {
    return {
      status: "error",
      message: toForgotPasswordError(error.message),
    };
  }

  return {
    status: "success",
    message:
      "If that email exists in RoofHub, a reset link has been sent. Check your inbox and spam folder.",
  };
}

export async function resetPasswordAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const input = readResetPasswordFields(formData);
  const errors = validateResetPasswordInput(input);

  if (Object.keys(errors).length > 0) {
    return toValidationErrorState(errors);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password: input.password,
  });

  if (error) {
    return {
      status: "error",
      message: toResetPasswordError(error.message),
    };
  }

  revalidatePath("/", "layout");

  return {
    status: "success",
    message: "Password updated. You can continue to your dashboard.",
    redirectTo: AUTH_DEFAULT_REDIRECT_PATH,
  };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
