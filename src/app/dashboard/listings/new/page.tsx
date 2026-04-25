import Link from "next/link";
import { PlusSquare } from "lucide-react";

import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { PageIntro, PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { MainContainer } from "@/components/layout/main-container";
import { ProviderListingWizard } from "@/components/listings/provider-listing-wizard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMapStyleUrl } from "@/lib/config/map";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { PROVIDER_WIZARD_DEFAULT_VALUES } from "@/lib/listings/provider-wizard/types";
import { loadProviderContactSettings } from "@/lib/listings/provider-wizard/queries";

export default async function NewDashboardListingPage() {
  const context = await getProviderRouteContext("/dashboard/listings/new");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <PageState
          icon={PlusSquare}
          title="Listing workflow unavailable"
          description={context.message}
        />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return <ProviderAccessRequired />;
  }

  const listingCreationContextResult = await resolveProviderListingCreationContext(
    context.supabase,
    context.profile
  );

  if (
    !listingCreationContextResult.ok &&
    listingCreationContextResult.reason === "company_workspace_selection_required" &&
    listingCreationContextResult.company
  ) {
    return (
      <MainContainer size="content" className="space-y-5">
        <CompanyWorkspaceSwitcher
          workspaceOptions={listingCreationContextResult.company.workspaceOptions}
          activeOrganizationId={listingCreationContextResult.company.activeOrganizationId}
          redirectTo="/dashboard/listings/new"
          title="Choose the company context for new listings"
          description="New company-owned listings must be created inside one explicit active RoofHub company context. Select it first so draft ownership and routing are deterministic."
          submitLabel="Start listing in selected context"
        />
      </MainContainer>
    );
  }

  if (!listingCreationContextResult.ok) {
    return (
      <MainContainer size="content">
        <PageState
          icon={PlusSquare}
          title="Listing creation workspace unavailable"
          description={listingCreationContextResult.message}
        />
      </MainContainer>
    );
  }

  const listingCreationContext = listingCreationContextResult.context;
  const contactSettings = await loadProviderContactSettings(context.supabase, context.profile.id);
  const initialValues = {
    ...PROVIDER_WIZARD_DEFAULT_VALUES,
    preferredContactMethod: contactSettings.settings.preferredContactMethod,
    contactMethods: contactSettings.settings.contactMethods,
    contactEmail: contactSettings.settings.contactEmail,
    contactPhone: contactSettings.settings.phone,
    whatsappPhone: contactSettings.settings.whatsappPhone,
    viberPhone: contactSettings.settings.viberPhone,
  };
  const mapStyleUrl = getMapStyleUrl();

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Listing workflow</Badge>}
          title="Create a listing draft in guided steps."
          description="Build listing identity, pricing, facts, map pin placement, media, and publish readiness in sequence."
          meta={
            <span className="border-border/70 bg-muted/25 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1.5 text-xs">
              {listingCreationContext.ownershipMode === "company"
                ? `New listings will be owned by ${listingCreationContext.organizationName ?? "your company"}.`
                : "New listings will be created as individual listings for this account."}
            </span>
          }
          actions={
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Back to dashboard
              </Link>
              <Link
                href="/dashboard/listings"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                My listings
              </Link>
            </>
          }
        />

        <PageSection
          eyebrow={<Badge variant="outline">Guided flow</Badge>}
          title="Listing draft editor"
          description="Complete each step and save progress continuously while keeping ownership and workflow state deterministic."
          contentClassName="pt-4"
        >
          <ProviderListingWizard
            key="provider-new-wizard"
            mode="new"
            initialStep="basics"
            initialDraftId={null}
            initialListingStatus="draft"
            initialValues={initialValues}
            initialImages={[]}
            providerOwnerId={context.profile.id}
            providerEmail={context.userEmail}
            mapStyleUrl={mapStyleUrl}
          />
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
