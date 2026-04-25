import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyWorkspaceCreateForm } from "@/components/company/company-workspace-create-form";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { PageIntro, PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
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
        <PageState
          icon={Building2}
          title="Company setup is unavailable"
          description={profileResult.message}
        />
      </MainContainer>
    );
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (companyContextResult.ok && companyContextResult.company.hasOwnedWorkspace) {
    redirect("/profile/company");
  }

  const hasProviderCompanyMode = profileResult.profile.provider_account_type === "company";

  return (
    <MainContainer size="content" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<span className="type-label">Company setup</span>}
          title="Create RoofHub company governance"
          description="Set up company identity and governance foundations before team, listings, and workflow routing are activated."
          actions={
            <Link
              href="/profile/company"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="size-4" />
              Back to governance
            </Link>
          }
        />

        {!companyContextResult.ok && hasProviderCompanyMode ? (
          <AuthStatusMessage
            tone="error"
            message="Existing company membership could not be verified right now. You can continue setup; creation remains idempotent and will route to your workspace when context is available."
          />
        ) : null}

        {companyContextResult.ok &&
        companyContextResult.company.workspaceState === "selection_required" ? (
          <CompanyWorkspaceSwitcher
            workspaceOptions={companyContextResult.company.workspaceOptions}
            activeOrganizationId={companyContextResult.company.activeOrganizationId}
            redirectTo="/profile/company"
            title="Choose the company context you are operating in now"
            description="This account already belongs to more than one RoofHub company context. Pick the active one before continuing with governance onboarding."
            submitLabel="Open selected governance"
          />
        ) : (
          <PageSection
            eyebrow={<span className="type-label">Workspace creation</span>}
            title="Company governance setup"
            description="Create company identity details once, then continue to governance and team management surfaces."
            contentClassName="pt-4"
          >
            <CompanyWorkspaceCreateForm />
          </PageSection>
        )}
      </PageShell>
    </MainContainer>
  );
}
