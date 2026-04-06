import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_DEFAULT_REDIRECT_PATH,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const currentPath = `${pathname}${request.nextUrl.search}`;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();

    const signInPath = toSignInPath(currentPath);
    applyRelativePath(redirectUrl, signInPath);

    return NextResponse.redirect(redirectUrl);
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

  return response;
}
