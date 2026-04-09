import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_DEFAULT_REDIRECT_PATH,
  type AuthRedirectReason,
  isGuestOnlyAuthPath,
  isProtectedPath,
  resolveAuthenticatedRedirect,
  toSignInPath,
} from "@/lib/auth/routing";
import type { Database } from "@/types/database";

import { getSupabaseEnv } from "./env";

function applyRelativePath(url: URL, relativePath: string) {
  const target = new URL(relativePath, url.origin);
  url.pathname = target.pathname;
  url.search = target.search;
}

function isSupabaseAuthCookieName(cookieName: string) {
  return cookieName.startsWith("sb-") && cookieName.includes("-auth-token");
}

function getSupabaseAuthCookieNames(request: NextRequest) {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(isSupabaseAuthCookieName);
}

function clearSupabaseAuthCookies(response: NextResponse, cookieNames: string[]) {
  cookieNames.forEach((cookieName) => {
    response.cookies.delete(cookieName);
  });
}

function resolveUnauthenticatedReason(
  hasSupabaseAuthCookies: boolean,
  authErrorMessage: string | null
): AuthRedirectReason {
  if (!hasSupabaseAuthCookies) {
    return "auth_required";
  }

  const normalizedError = authErrorMessage?.toLowerCase() ?? "";
  if (
    normalizedError.includes("revoked") ||
    normalizedError.includes("invalid refresh token") ||
    normalizedError.includes("refresh token")
  ) {
    return "session_revoked";
  }

  return "session_expired";
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: { id: string } | null = null;
  let authErrorMessage: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    authErrorMessage = error?.message ?? null;
  } catch (error) {
    authErrorMessage = error instanceof Error ? error.message : "Unable to validate auth session.";
  }

  const pathname = request.nextUrl.pathname;
  const currentPath = `${pathname}${request.nextUrl.search}`;
  const supabaseAuthCookieNames = getSupabaseAuthCookieNames(request);
  const hasSupabaseAuthCookies = supabaseAuthCookieNames.length > 0;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    const reason = resolveUnauthenticatedReason(hasSupabaseAuthCookies, authErrorMessage);
    const signInPath = toSignInPath(currentPath, reason);

    applyRelativePath(redirectUrl, signInPath);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    if (hasSupabaseAuthCookies) {
      clearSupabaseAuthCookies(redirectResponse, supabaseAuthCookieNames);
    }

    return redirectResponse;
  }

  if (user && isGuestOnlyAuthPath(pathname)) {
    const requestedNext = resolveAuthenticatedRedirect(
      request.nextUrl.searchParams.get("next"),
      AUTH_DEFAULT_REDIRECT_PATH
    );
    const redirectUrl = request.nextUrl.clone();
    applyRelativePath(redirectUrl, requestedNext);

    return NextResponse.redirect(redirectUrl);
  }

  if (!user && hasSupabaseAuthCookies && isGuestOnlyAuthPath(pathname)) {
    clearSupabaseAuthCookies(response, supabaseAuthCookieNames);
  }

  return response;
}
