import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyWorkspaceCreateForm } from "@/components/company/company-workspace-create-form";
import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { toSignInPath } from "@/lib/auth/routing";
import { getCompanyMembershipContextForUser } from "@/lib/company/context";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function CompanyWorkspaceCreatePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile/company/new"));
  }

  const profileResult = await getCurrentUserProfile(supabase);
  if (!profileResult.ok) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company setup is unavailable"
          description={profileResult.message}
        />
      </MainContainer>
    );
  }

  const companyContextResult = await getCompanyMembershipContextForUser(
    supabase,
    profileResult.profile.id
  );

  if (companyContextResult.ok && companyContextResult.ownsWorkspace) {
    redirect("/profile/company");
  }

  const hasProviderCompanyMode = profileResult.profile.provider_account_type === "company";

  return (
    <MainContainer size="content" className="space-y-4">
      <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="size-4" />
        Back to company workspace
      </Link>

      {!companyContextResult.ok && hasProviderCompanyMode ? (
        <AuthStatusMessage
          tone="error"
          message={
            "Existing company membership could not be verified right now. You can continue setup; creation remains idempotent and will route to your workspace when context is available."
          }
        />
      ) : null}

      <CompanyWorkspaceCreateForm />
    </MainContainer>
  );
}
