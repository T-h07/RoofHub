"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/lib/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/lib/auth/types";

type SignUpFormProps = {
  nextPath: string;
};

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(signUpAction, AUTH_ACTION_IDLE_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {state.status === "error" && state.message ? (
        <AuthStatusMessage tone="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <AuthStatusMessage tone="success" message={state.message} />
      ) : null}

      <Field>
        <Label htmlFor="sign-up-display-name">Display name</Label>
        <Input
          id="sign-up-display-name"
          name="displayName"
          type="text"
          autoComplete="name"
          placeholder="How people will see you"
          required
          aria-invalid={Boolean(state.errors?.displayName)}
        />
        {state.errors?.displayName ? <FieldError>{state.errors.displayName}</FieldError> : null}
      </Field>

      <Field>
        <Label htmlFor="sign-up-email">Email</Label>
        <Input
          id="sign-up-email"
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
        <Label htmlFor="sign-up-password">Password</Label>
        <Input
          id="sign-up-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          required
          aria-invalid={Boolean(state.errors?.password)}
        />
        {state.errors?.password ? <FieldError>{state.errors.password}</FieldError> : null}
      </Field>

      <Field>
        <Label htmlFor="sign-up-confirm-password">Confirm password</Label>
        <Input
          id="sign-up-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          required
          aria-invalid={Boolean(state.errors?.confirmPassword)}
        />
        {state.errors?.confirmPassword ? (
          <FieldError>{state.errors.confirmPassword}</FieldError>
        ) : null}
      </Field>

      <AuthSubmitButton label="Create account" pendingLabel="Creating account..." />

      <FieldHelp>
        Already registered?{" "}
        <Link href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`} className="text-primary">
          Sign in
        </Link>
        .
      </FieldHelp>
    </form>
  );
}
