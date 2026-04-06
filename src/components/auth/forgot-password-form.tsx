"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/lib/auth/types";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, AUTH_ACTION_IDLE_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <AuthStatusMessage tone="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <AuthStatusMessage tone="success" message={state.message} />
      ) : null}

      <Field>
        <Label htmlFor="forgot-password-email">Email</Label>
        <Input
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.errors?.email)}
        />
        {state.errors?.email ? <FieldError>{state.errors.email}</FieldError> : null}
        <FieldHelp>
          We&apos;ll send a secure reset link. The link will continue through your current
          environment origin.
        </FieldHelp>
      </Field>

      <AuthSubmitButton label="Send reset link" pendingLabel="Sending..." />

      <FieldHelp>
        Remembered your password?{" "}
        <Link href="/auth/sign-in" className="text-primary">
          Back to sign in
        </Link>
        .
      </FieldHelp>
    </form>
  );
}
