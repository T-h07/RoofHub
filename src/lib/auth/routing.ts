export const AUTH_DEFAULT_REDIRECT_PATH = "/dashboard";
export const AUTH_SIGN_IN_ROUTE = "/auth/sign-in";
export const AUTH_SIGN_UP_ROUTE = "/auth/sign-up";
export const AUTH_FORGOT_PASSWORD_ROUTE = "/auth/forgot-password";
export const AUTH_CALLBACK_ROUTE = "/auth/callback";
export const AUTH_RESET_PASSWORD_ROUTE = "/auth/reset-password";
export const AUTH_REDIRECT_REASON_VALUES = [
  "auth_required",
  "session_expired",
  "session_revoked",
  "signed_out",
  "callback_invalid",
  "profile_unavailable",
] as const;

export type AuthRedirectReason = (typeof AUTH_REDIRECT_REASON_VALUES)[number];

export const AUTH_GUEST_ROUTES = [
  AUTH_SIGN_IN_ROUTE,
  AUTH_SIGN_UP_ROUTE,
  AUTH_FORGOT_PASSWORD_ROUTE,
] as const;

const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/favorites", "/messages", "/profile", "/admin"] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isGuestOnlyAuthPath(pathname: string) {
  return AUTH_GUEST_ROUTES.some((route) => pathname === route);
}

export function isAuthRedirectReason(
  value: string | null | undefined
): value is AuthRedirectReason {
  return typeof value === "string" && AUTH_REDIRECT_REASON_VALUES.includes(value as AuthRedirectReason);
}

export function toSignInPath(nextPath?: string | null, reason?: AuthRedirectReason | null) {
  const fallback = AUTH_DEFAULT_REDIRECT_PATH;
  const normalizedNext = getSafeRedirectPath(nextPath, fallback);
  const params = new URLSearchParams({
    next: normalizedNext,
  });

  if (reason) {
    params.set("reason", reason);
  }

  return `${AUTH_SIGN_IN_ROUTE}?${params.toString()}`;
}

export function resolveAuthenticatedRedirect(
  nextPath: string | null | undefined,
  fallback = AUTH_DEFAULT_REDIRECT_PATH
) {
  const normalized = getSafeRedirectPath(nextPath, fallback);
  const pathname = normalized.split("?")[0] ?? normalized;

  if (isGuestOnlyAuthPath(pathname) || pathname === AUTH_CALLBACK_ROUTE) {
    return fallback;
  }

  return normalized;
}

export function getSafeRedirectPath(path: string | null | undefined, fallback = "/") {
  if (!path) {
    return fallback;
  }

  const normalized = path.trim();
  if (!normalized.startsWith("/")) {
    return fallback;
  }

  if (normalized.startsWith("//")) {
    return fallback;
  }

  if (normalized.includes("\\")) {
    return fallback;
  }

  if (/[\u0000-\u001f]/.test(normalized)) {
    return fallback;
  }

  try {
    const parsed = new URL(normalized, "https://roofhub.local");
    if (parsed.origin !== "https://roofhub.local") {
      return fallback;
    }

    if (!parsed.pathname.startsWith("/")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
