import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { ensureProfileForCurrentUser } from "@/lib/auth/profile";
import {
  buildOAuthEntryPath,
  isOAuthIntent,
  normalizeOAuthIntent,
  type OAuthStatus,
} from "@/lib/auth/oauth";
import {
  AUTH_DEFAULT_REDIRECT_PATH,
  resolveAuthenticatedRedirect,
  toSignInPath,
} from "@/lib/auth/routing";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { getSupabaseEnv } from "@/lib/supabase";
import type { Database } from "@/types/database";

const SUPPORTED_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "magiclink",
  "invite",
  "recovery",
  "email_change",
  "email",
]);

function toRedirectUrl(request: NextRequest, path: string) {
  return new URL(path, request.url);
}

function withSessionCookies(target: NextResponse, sessionResponse: NextResponse) {
  for (const cookie of sessionResponse.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  return target;
}

function buildRedirectResponse(request: NextRequest, path: string, sessionResponse: NextResponse) {
  return withSessionCookies(NextResponse.redirect(toRedirectUrl(request, path)), sessionResponse);
}

function createCallbackSupabaseContext(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
}

function logCallbackFailure(
  stage:
    | "rate_limited"
    | "rate_limiter_unavailable"
    | "session_missing_after_exchange"
    | "exchange_failed"
    | "provider_error"
    | "otp_verify_failed"
    | "profile_bootstrap_failed"
    | "invalid_payload",
  details: Record<string, unknown>
) {
  console.error("[Auth][Callback] callback finalization issue", {
    stage,
    ...details,
  });
}

function getCallbackFailurePath(input: {
  hasOAuthIntent: boolean;
  intent: ReturnType<typeof normalizeOAuthIntent>;
  nextPath: string;
  oauthStatus?: OAuthStatus;
}) {
  if (!input.hasOAuthIntent) {
    return toSignInPath(input.nextPath, "callback_invalid");
  }

  return buildOAuthEntryPath({
    intent: input.intent,
    nextPath: input.nextPath,
    status: input.oauthStatus ?? "callback_exchange_failed",
  });
}

function getProfileBootstrapFailurePath(input: {
  hasOAuthIntent: boolean;
  intent: ReturnType<typeof normalizeOAuthIntent>;
  nextPath: string;
}) {
  if (!input.hasOAuthIntent) {
    return toSignInPath(input.nextPath, "profile_unavailable");
  }

  return buildOAuthEntryPath({
    intent: input.intent,
    nextPath: input.nextPath,
    status: "profile_bootstrap_failed",
  });
}

function categorizeCallbackError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "invalid_or_expired";
  }

  if (normalized.includes("too many") || normalized.includes("rate")) {
    return "rate_limited";
  }

  if (normalized.includes("session") || normalized.includes("token")) {
    return "session_or_token_error";
  }

  return "provider_error";
}

async function handleProfileBootstrapAfterCallback(input: {
  supabase: ReturnType<typeof createServerClient<Database>>;
  request: NextRequest;
  sessionResponse: NextResponse;
  nextPath: string;
  hasOAuthIntent: boolean;
  intent: ReturnType<typeof normalizeOAuthIntent>;
  requestFingerprint: Awaited<ReturnType<typeof getAuditRequestFingerprint>>;
}) {
  const {
    supabase,
    request,
    sessionResponse,
    nextPath,
    hasOAuthIntent,
    intent,
    requestFingerprint,
  } = input;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "failed",
          callback_mode: "post_exchange_user_read",
          reason_category: "session_missing_after_exchange",
          ...requestFingerprint,
        },
      },
    });
    logCallbackFailure("session_missing_after_exchange", {
      has_user: Boolean(user),
      has_user_error: Boolean(userError),
      next_path: nextPath,
    });

    return buildRedirectResponse(
      request,
      getCallbackFailurePath({
        hasOAuthIntent,
        intent,
        nextPath,
        oauthStatus: "callback_exchange_failed",
      }),
      sessionResponse
    );
  }

  const profileResult = await ensureProfileForCurrentUser(supabase);
  if (!profileResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authProfileBootstrapFailed,
        actorUserId: user.id,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          phase: "callback",
          reason: profileResult.reason,
          error_code: profileResult.details?.errorCode ?? null,
          fetch_reason_category: profileResult.details?.fetchReasonCategory ?? null,
          ...requestFingerprint,
        },
      },
    });
    logCallbackFailure("profile_bootstrap_failed", {
      user_id: user.id,
      next_path: nextPath,
      reason: profileResult.reason,
      error_code: profileResult.details?.errorCode ?? null,
      fetch_reason_category: profileResult.details?.fetchReasonCategory ?? null,
    });

    await supabase.auth.signOut({ scope: "local" });
    return buildRedirectResponse(
      request,
      getProfileBootstrapFailurePath({
        hasOAuthIntent,
        intent,
        nextPath,
      }),
      sessionResponse
    );
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authCallbackSucceeded,
      actorUserId: user.id,
      targetType: "auth",
      targetId: "callback",
      metadata: {
        outcome: "success",
        ...requestFingerprint,
      },
    },
  });

  return buildRedirectResponse(request, nextPath, sessionResponse);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const providerError = url.searchParams.get("error");
  const rawIntent = url.searchParams.get("intent");
  const intent = normalizeOAuthIntent(rawIntent);
  const hasOAuthIntent = isOAuthIntent(rawIntent);
  const nextPath = resolveAuthenticatedRedirect(
    url.searchParams.get("next"),
    AUTH_DEFAULT_REDIRECT_PATH
  );
  const requestFingerprint = await getAuditRequestFingerprint();

  const { supabase, response: sessionResponse } = createCallbackSupabaseContext(request);
  let callbackFailureLogged = false;
  const callbackTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authCallbackPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many callback attempts. Please wait before retrying sign-in.",
    unavailableMessage: "Authentication callback is temporarily unavailable. Please retry shortly.",
  });

  if (!callbackTrafficControl.ok && callbackTrafficControl.reason === "throttled") {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "rate_limited",
          reason_category: "rate_limited",
          ...requestFingerprint,
        },
      },
    });
    logCallbackFailure("rate_limited", {
      retry_after_seconds: callbackTrafficControl.retryAfterSeconds,
      has_code: Boolean(code),
      has_token_hash: Boolean(tokenHash),
    });

    const throttledRedirect = buildRedirectResponse(
      request,
      getCallbackFailurePath({
        hasOAuthIntent,
        intent,
        nextPath,
        oauthStatus: "callback_exchange_failed",
      }),
      sessionResponse
    );
    throttledRedirect.headers.set(
      "Retry-After",
      String(Math.max(1, callbackTrafficControl.retryAfterSeconds))
    );
    return throttledRedirect;
  }

  if (!callbackTrafficControl.ok && callbackTrafficControl.reason === "unavailable") {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "rate_limiter_unavailable_bypassed",
          reason_category: "rate_limiter_unavailable",
          ...requestFingerprint,
        },
      },
    });
    logCallbackFailure("rate_limiter_unavailable", {
      has_code: Boolean(code),
      has_token_hash: Boolean(tokenHash),
    });
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return handleProfileBootstrapAfterCallback({
        supabase,
        request,
        sessionResponse,
        nextPath,
        hasOAuthIntent,
        intent,
        requestFingerprint,
      });
    }

    logCallbackFailure("exchange_failed", {
      reason_category: categorizeCallbackError(error.message),
      next_path: nextPath,
    });
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "failed",
          callback_mode: "code_exchange",
          reason_category: categorizeCallbackError(error.message),
          ...requestFingerprint,
        },
      },
    });
    callbackFailureLogged = true;
  }

  if (providerError) {
    logCallbackFailure("provider_error", {
      reason_category: "provider_error",
      next_path: nextPath,
    });
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "failed",
          callback_mode: "provider_error_param",
          provider_error: providerError.toLowerCase(),
          reason_category: "provider_error",
          ...requestFingerprint,
        },
      },
    });
    callbackFailureLogged = true;
  }

  if (tokenHash && otpType && SUPPORTED_OTP_TYPES.has(otpType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });

    if (!error) {
      return handleProfileBootstrapAfterCallback({
        supabase,
        request,
        sessionResponse,
        nextPath,
        hasOAuthIntent,
        intent,
        requestFingerprint,
      });
    }

    logCallbackFailure("otp_verify_failed", {
      reason_category: categorizeCallbackError(error.message),
      otp_type: otpType,
      next_path: nextPath,
    });
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "failed",
          callback_mode: "otp_verify",
          otp_type: otpType,
          reason_category: categorizeCallbackError(error.message),
          ...requestFingerprint,
        },
      },
    });
    callbackFailureLogged = true;
  }

  if (!callbackFailureLogged) {
    logCallbackFailure("invalid_payload", {
      has_code: Boolean(code),
      has_provider_error: Boolean(providerError),
      has_token_hash: Boolean(tokenHash),
      otp_type: otpType ?? null,
      has_oauth_intent: hasOAuthIntent,
      next_path: nextPath,
    });
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authCallbackFailed,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          outcome: "failed",
          callback_mode: "invalid_payload",
          reason_category: "invalid_or_missing_callback_params",
          ...requestFingerprint,
        },
      },
    });
  }

  return buildRedirectResponse(
    request,
    getCallbackFailurePath({
      hasOAuthIntent,
      intent,
      nextPath,
      oauthStatus: providerError ? "callback_provider_error" : "callback_exchange_failed",
    }),
    sessionResponse
  );
}
