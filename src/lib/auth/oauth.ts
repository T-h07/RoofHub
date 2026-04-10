import {
  AUTH_CALLBACK_ROUTE,
  AUTH_DEFAULT_REDIRECT_PATH,
  AUTH_SIGN_IN_ROUTE,
  AUTH_SIGN_UP_ROUTE,
  getSafeRedirectPath,
} from "./routing";

export const GOOGLE_OAUTH_PROVIDER = "google" as const;
export const GOOGLE_OAUTH_START_ROUTE = "/auth/oauth/google" as const;

const OAUTH_INTENT_VALUES = ["sign_in", "sign_up"] as const;
export type OAuthIntent = (typeof OAUTH_INTENT_VALUES)[number];

const OAUTH_STATUS_VALUES = [
  "provider_not_ready",
  "callback_exchange_failed",
  "callback_provider_error",
  "origin_not_trusted",
  "start_temporarily_unavailable",
] as const;
export type OAuthStatus = (typeof OAUTH_STATUS_VALUES)[number];

export function isOAuthIntent(value: string | null | undefined): value is OAuthIntent {
  return typeof value === "string" && OAUTH_INTENT_VALUES.includes(value as OAuthIntent);
}

export function normalizeOAuthIntent(value: string | null | undefined): OAuthIntent {
  return isOAuthIntent(value) ? value : "sign_in";
}

export function isOAuthStatus(value: string | null | undefined): value is OAuthStatus {
  return typeof value === "string" && OAUTH_STATUS_VALUES.includes(value as OAuthStatus);
}

export function getOAuthStatusMessage(status: OAuthStatus) {
  switch (status) {
    case "provider_not_ready":
      return "Google sign-in is not available yet. Finish provider setup and try again.";
    case "callback_exchange_failed":
      return "Google sign-in could not be completed. Please try again.";
    case "callback_provider_error":
      return "Google sign-in was cancelled or denied. You can retry or use email and password.";
    case "origin_not_trusted":
      return "This environment is not trusted for OAuth callbacks yet.";
    case "start_temporarily_unavailable":
      return "Google sign-in is temporarily unavailable. Please retry shortly.";
    default:
      return "Google sign-in is currently unavailable.";
  }
}

export function getOAuthEntryRouteByIntent(intent: OAuthIntent) {
  return intent === "sign_up" ? AUTH_SIGN_UP_ROUTE : AUTH_SIGN_IN_ROUTE;
}

export function buildOAuthEntryPath(input: {
  intent: OAuthIntent;
  nextPath?: string | null;
  status?: OAuthStatus | null;
}) {
  const params = new URLSearchParams({
    next: getSafeRedirectPath(input.nextPath, AUTH_DEFAULT_REDIRECT_PATH),
  });

  if (input.status) {
    params.set("oauth", input.status);
  }

  return `${getOAuthEntryRouteByIntent(input.intent)}?${params.toString()}`;
}

export function buildGoogleOAuthStartPath(input: {
  nextPath?: string | null;
  intent?: OAuthIntent;
}) {
  const params = new URLSearchParams({
    next: getSafeRedirectPath(input.nextPath, AUTH_DEFAULT_REDIRECT_PATH),
    intent: normalizeOAuthIntent(input.intent),
  });

  return `${GOOGLE_OAUTH_START_ROUTE}?${params.toString()}`;
}

export function buildOAuthCallbackPath(input: {
  nextPath?: string | null;
  intent?: OAuthIntent;
}) {
  const params = new URLSearchParams({
    next: getSafeRedirectPath(input.nextPath, AUTH_DEFAULT_REDIRECT_PATH),
    intent: normalizeOAuthIntent(input.intent),
  });

  return `${AUTH_CALLBACK_ROUTE}?${params.toString()}`;
}
