import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { ensureProfileForCurrentUser } from "@/lib/auth/profile";
import {
  AUTH_DEFAULT_REDIRECT_PATH,
  AUTH_SIGN_IN_ROUTE,
  resolveAuthenticatedRedirect,
} from "@/lib/auth/routing";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const nextPath = resolveAuthenticatedRedirect(
    url.searchParams.get("next"),
    AUTH_DEFAULT_REDIRECT_PATH
  );

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await ensureProfileForCurrentUser(supabase);
      return NextResponse.redirect(toRedirectUrl(request, nextPath));
    }
  }

  if (tokenHash && otpType && SUPPORTED_OTP_TYPES.has(otpType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });

    if (!error) {
      await ensureProfileForCurrentUser(supabase);
      return NextResponse.redirect(toRedirectUrl(request, nextPath));
    }
  }

  const signInUrl = toRedirectUrl(request, AUTH_SIGN_IN_ROUTE);
  signInUrl.searchParams.set("error", "callback");

  return NextResponse.redirect(signInUrl);
}
