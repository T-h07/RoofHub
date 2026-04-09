import Link from "next/link";
import { PlusSquare } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { ProviderListingWizard } from "@/components/listings/provider-listing-wizard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { PROVIDER_WIZARD_DEFAULT_VALUES } from "@/lib/listings/provider-wizard/types";
import { loadProviderContactSettings } from "@/lib/listings/provider-wizard/queries";

export default async function NewDashboardListingPage() {
  const context = await getProviderRouteContext("/dashboard/listings/new");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={PlusSquare} title="Provider workflow unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return <ProviderAccessRequired />;
  }

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
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Provider wizard</Badge>
        <h1 className="type-page-title max-w-4xl">Create a listing draft in guided steps.</h1>
        <p className="type-body-muted max-w-3xl">
          Build listing identity, pricing, facts, map pin placement, photos, and publish readiness in
          sequence. Drafts persist incrementally and can be safely resumed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to dashboard
          </Link>
          <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            My listings
          </Link>
        </div>
      </section>

      <ProviderListingWizard
        key="provider-new-wizard"
        mode="new"
        initialStep="basics"
        initialDraftId={null}
        initialListingStatus="draft"
        initialValues={initialValues}
        initialImages={[]}
        providerOwnerId={context.profile.id}
        mapStyleUrl={mapStyleUrl}
      />
    </MainContainer>
  );
}
