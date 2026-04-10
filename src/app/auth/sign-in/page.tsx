import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isOAuthStatus } from "@/lib/auth/oauth";
import {
  AUTH_DEFAULT_REDIRECT_PATH,
  isAuthRedirectReason,
  resolveAuthenticatedRedirect,
} from "@/lib/auth/routing";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : null;
  const reasonParam = typeof params.reason === "string" ? params.reason : null;
  const oauthParam = typeof params.oauth === "string" ? params.oauth : null;
  const callbackError = typeof params.error === "string" ? params.error : null;
  const reason = isAuthRedirectReason(reasonParam)
    ? reasonParam
    : callbackError === "callback"
      ? "callback_invalid"
      : null;
  const oauthStatus = isOAuthStatus(oauthParam) ? oauthParam : null;
  const nextPath = resolveAuthenticatedRedirect(nextParam, AUTH_DEFAULT_REDIRECT_PATH);

  return (
    <AuthShell
      badge="Secure sign in"
      title="Welcome back to RoofHub"
      description="Sign in to continue to your dashboard, saved listings, and conversations."
      footer={
        <>
          Need an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}
            className="text-primary"
          >
            Create one
          </Link>
          .
        </>
      }
    >
      <SignInForm nextPath={nextPath} reason={reason} oauthStatus={oauthStatus} />
    </AuthShell>
  );
}
