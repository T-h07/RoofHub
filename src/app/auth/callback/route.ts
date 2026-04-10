import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { ensureProfileForCurrentUser } from "@/lib/auth/profile";
import {
  AUTH_DEFAULT_REDIRECT_PATH,
  resolveAuthenticatedRedirect,
  toSignInPath,
} from "@/lib/auth/routing";
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

async function handleProfileBootstrapAfterCallback(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  request: Request,
  nextPath: string
) {
  const profileResult = await ensureProfileForCurrentUser(supabase);
  if (!profileResult.ok) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      toRedirectUrl(request, toSignInPath(nextPath, "profile_unavailable"))
    );
  }

  return NextResponse.redirect(toRedirectUrl(request, nextPath));
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
  const callbackTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.authCallbackPerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many callback attempts. Please wait before retrying sign-in.",
    unavailableMessage: "Authentication callback is temporarily unavailable. Please retry shortly.",
  });
  if (!callbackTrafficControl.ok) {
    const throttledRedirect = NextResponse.redirect(
      toRedirectUrl(request, toSignInPath(nextPath, "callback_invalid"))
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
      return handleProfileBootstrapAfterCallback(supabase, request, nextPath);
    }
  }

  if (tokenHash && otpType && SUPPORTED_OTP_TYPES.has(otpType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });

    if (!error) {
      return handleProfileBootstrapAfterCallback(supabase, request, nextPath);
    }
  }

  return NextResponse.redirect(
    toRedirectUrl(request, toSignInPath(nextPath, "callback_invalid"))
  );
}
