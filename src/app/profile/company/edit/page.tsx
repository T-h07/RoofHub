import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { CompanyProfileForm } from "@/components/company/company-profile-form";
import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { createServerSupabaseClient } from "@/lib/supabase";

type CompanyProfileEditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStatus(searchParams: Record<string, string | string[] | undefined>) {
  const rawStatus = searchParams.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (status === "saved") {
    return "saved" as const;
  }

  return null;
}

export default async function CompanyProfileEditPage({
  searchParams,
}: CompanyProfileEditPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile/company/edit"));
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (!companyContextResult.ok) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company profile editing is unavailable"
          description={companyContextResult.message}
        />
      </MainContainer>
    );
  }

  if (companyContextResult.company.workspaceState === "selection_required") {
    return (
      <MainContainer size="content" className="space-y-5">
        <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Back to company workspace
        </Link>

        <CompanyWorkspaceSwitcher
          workspaceOptions={companyContextResult.company.workspaceOptions}
          activeOrganizationId={companyContextResult.company.activeOrganizationId}
          redirectTo="/profile/company/edit"
          title="Choose the workspace you want to edit"
          description="Company profile editing is owner-scoped. Select the active owner workspace you want RoofHub to use for company profile updates."
        />
      </MainContainer>
    );
  }

  const ownerOrganization = companyContextResult.company.activeOrganization;
  if (!ownerOrganization || !companyContextResult.company.canEditProfile) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company profile editing requires an owner workspace"
          description="Select an owner-managed company workspace before editing company profile details."
          action={
            <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
              Back to company workspace
            </Link>
          }
        />
      </MainContainer>
    );
  }

  const logoUrl = toCompanyLogoPublicUrl(supabase, ownerOrganization.logo_path);
  const status = readStatus(resolvedSearchParams);

  return (
    <MainContainer size="wide" className="space-y-5">
      <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="size-4" />
        Back to company workspace
      </Link>

      {status === "saved" ? (
        <AuthStatusMessage tone="success" message="Company profile saved successfully." />
      ) : null}

      <CompanyIdentityHeader
        company={{
          name: ownerOrganization.name,
          slug: ownerOrganization.slug,
          description: ownerOrganization.description,
          logoUrl,
          contactEmail: ownerOrganization.contact_email,
          contactPhone: ownerOrganization.contact_phone,
          websiteUrl: ownerOrganization.website_url,
          coverageArea: ownerOrganization.coverage_area,
        }}
        contextLabel="Company profile editor"
        supportingLabel="Refine how your company appears in the RoofHub marketplace before seekers view your public profile."
        actions={
          <Link
            href={`/companies/${ownerOrganization.slug}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View public company page
          </Link>
        }
      />

      <CompanyProfileForm
        key={`${ownerOrganization.updated_at}:${ownerOrganization.logo_path ?? "no-logo"}`}
        company={{
          id: ownerOrganization.id,
          name: ownerOrganization.name,
          slug: ownerOrganization.slug,
          description: ownerOrganization.description,
          logoUrl,
          logoPath: ownerOrganization.logo_path,
          contactEmail: ownerOrganization.contact_email,
          contactPhone: ownerOrganization.contact_phone,
          websiteUrl: ownerOrganization.website_url,
          coverageArea: ownerOrganization.coverage_area,
        }}
      />
    </MainContainer>
  );
}
