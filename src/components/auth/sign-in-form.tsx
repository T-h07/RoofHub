"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ACTION_IDLE_STATE } from "@/lib/auth/types";
import { signInAction } from "@/lib/auth/actions";

type SignInFormProps = {
  nextPath: string;
  callbackError?: string | null;
};

export function SignInForm({ nextPath, callbackError }: SignInFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(signInAction, AUTH_ACTION_IDLE_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  const formErrorMessage =
    callbackError === "callback"
      ? "Your link is invalid or expired. Sign in again to continue."
      : state.status === "error"
        ? state.message
        : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {formErrorMessage ? <AuthStatusMessage tone="error" message={formErrorMessage} /> : null}

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
