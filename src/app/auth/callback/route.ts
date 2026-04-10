import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

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
import { createServerSupabaseClient } from "@/lib/supabase";

const SUPPORTED_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "magiclink",
  "invite",
  "recovery",
  "email_change",
  "email",
]);

function toRedirectUrl(request: Request, path: string) {
  return new URL(path, request.url);
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

async function handleProfileBootstrapAfterCallback(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  request: Request,
  nextPath: string,
  requestFingerprint: Awaited<ReturnType<typeof getAuditRequestFingerprint>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileResult = await ensureProfileForCurrentUser(supabase);
  if (!profileResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authProfileBootstrapFailed,
        actorUserId: user?.id ?? null,
        targetType: "auth",
        targetId: "callback",
        metadata: {
          phase: "callback",
          ...requestFingerprint,
        },
      },
    });

    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      toRedirectUrl(request, toSignInPath(nextPath, "profile_unavailable"))
    );
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authCallbackSucceeded,
      actorUserId: user?.id ?? null,
      targetType: "auth",
      targetId: "callback",
      metadata: {
        outcome: "success",
        ...requestFingerprint,
      },
    },
  });

  return NextResponse.redirect(toRedirectUrl(request, nextPath));
}

export async function GET(request: Request) {
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

  const supabase = await createServerSupabaseClient();
  let callbackFailureLogged = false;
  const callbackTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authCallbackPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many callback attempts. Please wait before retrying sign-in.",
    unavailableMessage: "Authentication callback is temporarily unavailable. Please retry shortly.",
  });
  if (!callbackTrafficControl.ok) {
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
    const throttledRedirect = NextResponse.redirect(
      toRedirectUrl(
        request,
        getCallbackFailurePath({
          hasOAuthIntent,
          intent,
          nextPath,
          oauthStatus: "callback_exchange_failed",
        })
      )
    );
    throttledRedirect.headers.set(
      "Retry-After",
      String(Math.max(1, callbackTrafficControl.retryAfterSeconds))
    );
    return throttledRedirect;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return handleProfileBootstrapAfterCallback(
        supabase,
        request,
        nextPath,
        requestFingerprint
      );
    }

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
      return handleProfileBootstrapAfterCallback(
        supabase,
        request,
        nextPath,
        requestFingerprint
      );
    }

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

  return NextResponse.redirect(toRedirectUrl(request, getCallbackFailurePath({
    hasOAuthIntent,
    intent,
    nextPath,
    oauthStatus: providerError ? "callback_provider_error" : "callback_exchange_failed",
  })));
}
