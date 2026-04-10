"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  enforceTrafficControl,
  TRAFFIC_CONTROL_RULES,
  type TrafficControlResult,
} from "@/lib/security/traffic-control";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  hashAuditIdentifier,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { createServerSupabaseClient } from "@/lib/supabase";

import { ensureProfileForCurrentUser } from "./profile";
import {
  AUTH_CALLBACK_ROUTE,
  AUTH_DEFAULT_REDIRECT_PATH,
  AUTH_RESET_PASSWORD_ROUTE,
  resolveAuthenticatedRedirect,
  toSignInPath,
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

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function rollbackSessionAfterProfileBootstrapFailure(supabase: ServerSupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best effort rollback to avoid partial auth state after bootstrap failures.
  }
}

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

function categorizeAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "rate_limited";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "invalid_credentials";
  }

  if (normalized.includes("email not confirmed")) {
    return "email_not_confirmed";
  }

  if (normalized.includes("already registered")) {
    return "already_registered";
  }

  if (normalized.includes("password")) {
    return "password_validation";
  }

  if (normalized.includes("session") || normalized.includes("token")) {
    return "session_or_token_invalid";
  }

  return "provider_error";
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

function toTrafficErrorState(
  result: Extract<TrafficControlResult, { ok: false }>
): AuthActionState {
  return {
    status: "error",
    message: result.message,
  };
}

export async function signInAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const requestFingerprint = await getAuditRequestFingerprint();
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
  const ipControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authSignInPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many sign-in attempts from this connection.",
    unavailableMessage: "Sign-in is temporarily unavailable. Please try again shortly.",
  });
  if (!ipControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignInFailed,
        targetType: "auth",
        targetId: "sign_in",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "ip",
          email_hash: hashAuditIdentifier(credentials.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(ipControl);
  }

  const emailControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authSignInPerEmail,
    identity: { email: credentials.email, includeIp: false },
    throttledMessage: "Too many sign-in attempts for this account.",
    unavailableMessage: "Sign-in is temporarily unavailable. Please try again shortly.",
  });
  if (!emailControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignInFailed,
        targetType: "auth",
        targetId: "sign_in",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "email",
          email_hash: hashAuditIdentifier(credentials.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(emailControl);
  }

  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignInFailed,
        targetType: "auth",
        targetId: "sign_in",
        metadata: {
          outcome: "failed",
          reason_category: categorizeAuthError(error.message),
          email_hash: hashAuditIdentifier(credentials.email),
          ...requestFingerprint,
        },
      },
    });
    return {
      status: "error",
      message: toSignInError(error.message),
    };
  }

  const profileResult = await ensureProfileForCurrentUser(supabase);
  if (!profileResult.ok) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authProfileBootstrapFailed,
        actorUserId: user?.id ?? null,
        targetType: "auth",
        targetId: "sign_in",
        metadata: {
          phase: "sign_in",
          email_hash: hashAuditIdentifier(credentials.email),
          ...requestFingerprint,
        },
      },
    });
    await rollbackSessionAfterProfileBootstrapFailure(supabase);
    return {
      status: "error",
      message: "We could not finalize your account session. Please sign in again.",
    };
  }

  const {
    data: { user: signedInUser },
  } = await supabase.auth.getUser();
  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authSignInSucceeded,
      actorUserId: signedInUser?.id ?? null,
      targetType: "auth",
      targetId: "sign_in",
      metadata: {
        outcome: "success",
        email_hash: hashAuditIdentifier(credentials.email),
        ...requestFingerprint,
      },
    },
  });

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
  const requestFingerprint = await getAuditRequestFingerprint();
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
  const ipControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authSignUpPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many sign-up attempts from this connection.",
    unavailableMessage: "Sign-up is temporarily unavailable. Please try again shortly.",
  });
  if (!ipControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignUpFailed,
        targetType: "auth",
        targetId: "sign_up",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "ip",
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(ipControl);
  }

  const emailControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authSignUpPerEmail,
    identity: { email: input.email, includeIp: false },
    throttledMessage: "Too many sign-up attempts for this email.",
    unavailableMessage: "Sign-up is temporarily unavailable. Please try again shortly.",
  });
  if (!emailControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignUpFailed,
        targetType: "auth",
        targetId: "sign_up",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "email",
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(emailControl);
  }

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
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignUpFailed,
        targetType: "auth",
        targetId: "sign_up",
        metadata: {
          outcome: "failed",
          reason_category: categorizeAuthError(error.message),
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return {
      status: "error",
      message: toSignUpError(error.message),
    };
  }

  if (data.session) {
    const profileResult = await ensureProfileForCurrentUser(supabase, input.displayName);
    if (!profileResult.ok) {
      await recordSecurityAuditEvent({
        supabase,
        event: {
          eventType: AUDIT_EVENT_TYPES.authProfileBootstrapFailed,
          actorUserId: data.user?.id ?? null,
          targetType: "auth",
          targetId: "sign_up",
          metadata: {
            phase: "sign_up",
            email_hash: hashAuditIdentifier(input.email),
            ...requestFingerprint,
          },
        },
      });
      await rollbackSessionAfterProfileBootstrapFailure(supabase);
      return {
        status: "error",
        message: "Account created, but session setup was incomplete. Please sign in again.",
      };
    }

    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authSignUpCompleted,
        actorUserId: data.user?.id ?? null,
        targetType: "auth",
        targetId: "sign_up",
        metadata: {
          outcome: "session_created",
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });

    revalidatePath("/", "layout");

    return {
      status: "success",
      message: "Account created successfully.",
      redirectTo: nextPath,
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authSignUpPendingVerification,
      actorUserId: data.user?.id ?? null,
      targetType: "auth",
      targetId: "sign_up",
      metadata: {
        outcome: "pending_verification",
        email_hash: hashAuditIdentifier(input.email),
        ...requestFingerprint,
      },
    },
  });

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
  const requestFingerprint = await getAuditRequestFingerprint();
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
  const ipControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authPasswordResetPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many password reset requests from this connection.",
    unavailableMessage: "Password reset is temporarily unavailable. Please try again shortly.",
  });
  if (!ipControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authPasswordResetRequested,
        targetType: "auth",
        targetId: "password_reset_request",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "ip",
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(ipControl);
  }

  const emailControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authPasswordResetPerEmail,
    identity: { email: input.email, includeIp: false },
    throttledMessage: "Too many password reset requests for this email.",
    unavailableMessage: "Password reset is temporarily unavailable. Please try again shortly.",
  });
  if (!emailControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authPasswordResetRequested,
        targetType: "auth",
        targetId: "password_reset_request",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "email",
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return toTrafficErrorState(emailControl);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: resetRedirectTo,
  });

  if (error) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authPasswordResetRequested,
        targetType: "auth",
        targetId: "password_reset_request",
        metadata: {
          outcome: "failed",
          reason_category: categorizeAuthError(error.message),
          email_hash: hashAuditIdentifier(input.email),
          ...requestFingerprint,
        },
      },
    });
    return {
      status: "error",
      message: toForgotPasswordError(error.message),
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authPasswordResetRequested,
      targetType: "auth",
      targetId: "password_reset_request",
      metadata: {
        outcome: "accepted",
        email_hash: hashAuditIdentifier(input.email),
        ...requestFingerprint,
      },
    },
  });

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
  const requestFingerprint = await getAuditRequestFingerprint();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authPasswordResetCompleted,
        actorUserId: user?.id ?? null,
        targetType: "auth",
        targetId: "password_reset_complete",
        metadata: {
          outcome: "failed",
          reason_category: categorizeAuthError(error.message),
          ...requestFingerprint,
        },
      },
    });
    return {
      status: "error",
      message: toResetPasswordError(error.message),
    };
  }

  const {
    data: { user: resetUser },
  } = await supabase.auth.getUser();
  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authPasswordResetCompleted,
      actorUserId: resetUser?.id ?? null,
      targetType: "auth",
      targetId: "password_reset_complete",
      metadata: {
        outcome: "success",
        ...requestFingerprint,
      },
    },
  });

  revalidatePath("/", "layout");

  return {
    status: "success",
    message: "Password updated. You can continue to your dashboard.",
    redirectTo: AUTH_DEFAULT_REDIRECT_PATH,
  };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  const requestFingerprint = await getAuditRequestFingerprint();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut({ scope: "local" });
  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authSignOut,
      actorUserId: user?.id ?? null,
      targetType: "auth",
      targetId: "sign_out",
      metadata: {
        outcome: "success",
        ...requestFingerprint,
      },
    },
  });
  revalidatePath("/", "layout");
  redirect(toSignInPath(AUTH_DEFAULT_REDIRECT_PATH, "signed_out"));
}
