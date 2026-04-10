"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOAuthStatusMessage, type OAuthStatus } from "@/lib/auth/oauth";
import type { AuthRedirectReason } from "@/lib/auth/routing";
import { AUTH_ACTION_IDLE_STATE } from "@/lib/auth/types";
import { signInAction } from "@/lib/auth/actions";

type SignInFormProps = {
  nextPath: string;
  reason?: AuthRedirectReason | null;
  oauthStatus?: OAuthStatus | null;
};

function getReasonMessage(reason: AuthRedirectReason | null | undefined) {
  switch (reason) {
    case "auth_required":
      return "Sign in to continue to that page.";
    case "session_expired":
      return "Your session expired. Sign in again to continue.";
    case "session_revoked":
      return "This session is no longer valid. Sign in again to continue.";
    case "signed_out":
      return "You have been signed out.";
    case "profile_unavailable":
      return "Your account authenticated, but profile setup did not complete. Please sign in again.";
    case "callback_invalid":
      return "Your sign-in link is invalid or expired. Sign in again to continue.";
    default:
      return null;
  }
}

export function SignInForm({ nextPath, reason, oauthStatus }: SignInFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(signInAction, AUTH_ACTION_IDLE_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  const reasonMessage = getReasonMessage(reason);
  const oauthMessage = oauthStatus ? getOAuthStatusMessage(oauthStatus) : null;
  const formErrorMessage =
    state.status === "error" ? state.message : (oauthMessage ?? reasonMessage ?? undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {formErrorMessage ? <AuthStatusMessage tone="error" message={formErrorMessage} /> : null}

      <GoogleAuthButton nextPath={nextPath} intent="sign_in" />

      <div className="text-muted-foreground/90 flex items-center gap-3 text-xs tracking-[0.12em] uppercase">
        <span className="bg-border h-px flex-1" />
        <span>Or continue with email</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <Field>
        <Label htmlFor="sign-in-email">Email</Label>
        <Input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.errors?.email)}
        />
        {state.errors?.email ? <FieldError>{state.errors.email}</FieldError> : null}
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sign-in-password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-primary text-xs font-medium hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          aria-invalid={Boolean(state.errors?.password)}
        />
        {state.errors?.password ? <FieldError>{state.errors.password}</FieldError> : null}
      </Field>

      <AuthSubmitButton label="Sign in" pendingLabel="Signing in..." />

      <FieldHelp>
        New to RoofHub?{" "}
        <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`} className="text-primary">
          Create an account
        </Link>
        .
      </FieldHelp>
    </form>
  );
}
