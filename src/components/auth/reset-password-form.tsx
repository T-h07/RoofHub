"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/lib/auth/types";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(resetPasswordAction, AUTH_ACTION_IDLE_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <AuthStatusMessage tone="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <AuthStatusMessage tone="success" message={state.message} />
      ) : null}

      <Field>
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a new password"
          required
          aria-invalid={Boolean(state.errors?.password)}
        />
        {state.errors?.password ? <FieldError>{state.errors.password}</FieldError> : null}
      </Field>

      <Field>
        <Label htmlFor="reset-confirm-password">Confirm password</Label>
        <Input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          required
          aria-invalid={Boolean(state.errors?.confirmPassword)}
        />
        {state.errors?.confirmPassword ? (
          <FieldError>{state.errors.confirmPassword}</FieldError>
        ) : null}
      </Field>

      <AuthSubmitButton label="Update password" pendingLabel="Updating..." />

      <FieldHelp>
        No valid reset session?{" "}
        <Link href="/auth/forgot-password" className="text-primary">
          Request another link
        </Link>
        .
      </FieldHelp>
    </form>
  );
}
