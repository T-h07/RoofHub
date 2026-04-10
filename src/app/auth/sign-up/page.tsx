import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isOAuthStatus } from "@/lib/auth/oauth";
import { AUTH_DEFAULT_REDIRECT_PATH, resolveAuthenticatedRedirect } from "@/lib/auth/routing";

type SignUpPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : null;
  const oauthParam = typeof params.oauth === "string" ? params.oauth : null;
  const oauthStatus = isOAuthStatus(oauthParam) ? oauthParam : null;
  const nextPath = resolveAuthenticatedRedirect(nextParam, AUTH_DEFAULT_REDIRECT_PATH);

  return (
    <AuthShell
      badge="Create account"
      title="Start your RoofHub account"
      description="Set up access for listing discovery, provider workflows, and messaging as those surfaces land."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}
            className="text-primary"
          >
            Sign in
          </Link>
          .
        </>
      }
    >
      <SignUpForm nextPath={nextPath} oauthStatus={oauthStatus} />
    </AuthShell>
  );
}
