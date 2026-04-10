import { NextResponse } from "next/server";

import {
  buildOAuthCallbackPath,
  buildOAuthEntryPath,
  GOOGLE_OAUTH_PROVIDER,
  normalizeOAuthIntent,
} from "@/lib/auth/oauth";
import { AUTH_DEFAULT_REDIRECT_PATH, resolveAuthenticatedRedirect } from "@/lib/auth/routing";
import { buildAbsolutePath } from "@/lib/auth/url";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";

function toRedirectUrl(request: Request, path: string) {
  return new URL(path, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = normalizeOAuthIntent(url.searchParams.get("intent"));
  const nextPath = resolveAuthenticatedRedirect(
    url.searchParams.get("next"),
    AUTH_DEFAULT_REDIRECT_PATH
  );
  const requestFingerprint = await getAuditRequestFingerprint();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.redirect(toRedirectUrl(request, nextPath));
  }

  const trafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authSignInPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many sign-in attempts from this connection.",
    unavailableMessage: "Google sign-in request limits are temporarily unavailable.",
  });
  if (!trafficControl.ok && trafficControl.reason === "throttled") {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authOAuthStartFailed,
        targetType: "auth",
        targetId: "oauth_google_start",
        metadata: {
          provider: GOOGLE_OAUTH_PROVIDER,
          intent,
          outcome: trafficControl.reason,
          ...requestFingerprint,
        },
      },
    });

    return NextResponse.redirect(
      toRedirectUrl(
        request,
        buildOAuthEntryPath({
          intent,
          nextPath,
          status: "start_rate_limited",
        })
      )
    );
  }

  if (!trafficControl.ok && trafficControl.reason === "unavailable") {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authOAuthStartFailed,
        targetType: "auth",
        targetId: "oauth_google_start",
        metadata: {
          provider: GOOGLE_OAUTH_PROVIDER,
          intent,
          outcome: "rate_limiter_unavailable_bypassed",
          ...requestFingerprint,
        },
      },
    });
  }

  const callbackPath = buildOAuthCallbackPath({ nextPath, intent });
  const redirectTo = await buildAbsolutePath(callbackPath);
  if (!redirectTo) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authOAuthStartFailed,
        targetType: "auth",
        targetId: "oauth_google_start",
        metadata: {
          provider: GOOGLE_OAUTH_PROVIDER,
          intent,
          outcome: "origin_not_trusted",
          ...requestFingerprint,
        },
      },
    });

    return NextResponse.redirect(
      toRedirectUrl(
        request,
        buildOAuthEntryPath({
          intent,
          nextPath,
          status: "origin_not_trusted",
        })
      )
    );
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: GOOGLE_OAUTH_PROVIDER,
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.authOAuthStartFailed,
        targetType: "auth",
        targetId: "oauth_google_start",
        metadata: {
          provider: GOOGLE_OAUTH_PROVIDER,
          intent,
          outcome: "provider_not_ready",
          reason_category: error ? "provider_error" : "missing_redirect_url",
          ...requestFingerprint,
        },
      },
    });

    return NextResponse.redirect(
      toRedirectUrl(
        request,
        buildOAuthEntryPath({
          intent,
          nextPath,
          status: "provider_not_ready",
        })
      )
    );
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.authOAuthStartInitiated,
      targetType: "auth",
      targetId: "oauth_google_start",
      metadata: {
        provider: GOOGLE_OAUTH_PROVIDER,
        intent,
        outcome: "redirected",
        ...requestFingerprint,
      },
    },
  });

  return NextResponse.redirect(data.url);
}
