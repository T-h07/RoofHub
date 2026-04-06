import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell
      badge="Set new password"
      title="Choose your new password"
      description="Complete password recovery for your account session in this environment."
      footer={
        <>
          Need a fresh link?{" "}
          <Link href="/auth/forgot-password" className="text-primary">
            Request reset email
          </Link>
          .
        </>
      }
    >
      {!user ? (
        <AuthStatusMessage
          tone="error"
          message="This reset link is invalid or expired. Request a new password reset email to continue."
        />
      ) : (
        <ResetPasswordForm />
      )}
    </AuthShell>
  );
}
