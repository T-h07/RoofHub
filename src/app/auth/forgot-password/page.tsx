import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      badge="Password recovery"
      title="Reset your RoofHub password"
      description="Request a secure reset link to regain access without losing your account session history."
      footer={
        <>
          Back to{" "}
          <Link href="/auth/sign-in" className="text-primary">
            sign in
          </Link>
          .
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
