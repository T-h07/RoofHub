export const AUTH_DEFAULT_REDIRECT_PATH = "/dashboard";
export const AUTH_SIGN_IN_ROUTE = "/auth/sign-in";
export const AUTH_SIGN_UP_ROUTE = "/auth/sign-up";
export const AUTH_FORGOT_PASSWORD_ROUTE = "/auth/forgot-password";
export const AUTH_CALLBACK_ROUTE = "/auth/callback";
export const AUTH_RESET_PASSWORD_ROUTE = "/auth/reset-password";

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

export function toSignInPath(nextPath?: string | null) {
  const fallback = AUTH_DEFAULT_REDIRECT_PATH;
  const normalizedNext = getSafeRedirectPath(nextPath, fallback);

  return `${AUTH_SIGN_IN_ROUTE}?next=${encodeURIComponent(normalizedNext)}`;
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

  if (!path.startsWith("/")) {
    return fallback;
  }

  if (path.startsWith("//")) {
    return fallback;
  }

  return path;
}
