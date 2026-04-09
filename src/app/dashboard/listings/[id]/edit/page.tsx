import { notFound } from "next/navigation";
import Link from "next/link";
import { FilePenLine } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { ProviderListingWizard } from "@/components/listings/provider-listing-wizard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { buildWizardValuesFromDraft } from "@/lib/listings/provider-wizard/mapping";
import { parseProviderWizardStep } from "@/lib/listings/provider-wizard/steps";
import {
  loadProviderContactSettings,
  loadProviderDraftForEditor,
  loadProviderDraftImages,
} from "@/lib/listings/provider-wizard/queries";

type EditDashboardListingPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStepParam(searchParams: Record<string, string | string[] | undefined>) {
  const rawStep = searchParams.step;
  if (typeof rawStep === "string") {
    return rawStep;
  }

  if (Array.isArray(rawStep)) {
    return rawStep[0] ?? null;
  }

  return null;
}

export default async function EditDashboardListingPage({
  params,
  searchParams,
}: EditDashboardListingPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const context = await getProviderRouteContext(`/dashboard/listings/${id}/edit`);

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={FilePenLine} title="Draft workflow unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return <ProviderAccessRequired />;
  }

  const [draftResult, contactResult, imagesResult] = await Promise.all([
    loadProviderDraftForEditor(context.supabase, context.profile.id, id, context.isAdmin),
    loadProviderContactSettings(context.supabase, context.profile.id),
    loadProviderDraftImages(context.supabase, id),
  ]);

  if (!draftResult.ok || !draftResult.draft) {
    notFound();
  }

  const step = parseProviderWizardStep(readStepParam(resolvedSearchParams), "basics");
  const values = buildWizardValuesFromDraft(draftResult.draft, contactResult.settings);
  const mapStyleUrl = getMapStyleUrl();

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Draft editor</Badge>
        <h1 className="type-page-title max-w-4xl">Continue editing your listing draft.</h1>
        <p className="type-body-muted max-w-3xl">
          Progress is stored step by step. Keep location pin and privacy mode updated before moving into
          photos, readiness checks, and final publish.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to dashboard
          </Link>
          <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
            Create another draft
          </Link>
        </div>
      </section>

      <ProviderListingWizard
        key={`${draftResult.draft.id}-${step}`}
        mode="edit"
        initialStep={step}
        initialDraftId={draftResult.draft.id}
        initialValues={values}
        initialImages={imagesResult.ok ? imagesResult.images : []}
        providerOwnerId={context.profile.id}
        mapStyleUrl={mapStyleUrl}
      />
    </MainContainer>
  );
}
