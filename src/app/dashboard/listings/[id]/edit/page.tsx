import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, FilePenLine } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { ProviderListingLifecycleActions } from "@/components/dashboard/provider-listing-lifecycle-actions";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { MainContainer } from "@/components/layout/main-container";
import { ProviderListingWizard } from "@/components/listings/provider-listing-wizard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
import { getListingOwnershipMode } from "@/lib/listings/ownership";
import { getListingPublicVisibilityLabel, isPublicDiscoveryListing } from "@/lib/listings/visibility";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

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
    loadProviderDraftForEditor(context.supabase, context.profile.id, id),
    loadProviderContactSettings(context.supabase, context.profile.id),
    loadProviderDraftImages(context.supabase, id),
  ]);

  if (!draftResult.ok || !draftResult.draft) {
    notFound();
  }

  const step = parseProviderWizardStep(readStepParam(resolvedSearchParams), "basics");
  const values = buildWizardValuesFromDraft(draftResult.draft, contactResult.settings);
  const mapStyleUrl = getMapStyleUrl();
  const isHiddenByAdmin = draftResult.draft.listing_status === "hidden_by_admin";
  const isPubliclyVisible = isPublicDiscoveryListing(draftResult.draft);
  const ownershipMode = getListingOwnershipMode(draftResult.draft);
  const ownershipLabel = ownershipMode === "company" ? "Company listing" : "Individual listing";
  const isCompanyListing = ownershipMode === "company";

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Listing editor</Badge>
        <h1 className="type-page-title max-w-4xl">Maintain listing details, photos, and lifecycle state.</h1>
        <p className="type-body-muted max-w-3xl">
          Updates are saved step-by-step through the shared provider workflow. Status controls and visibility
          consequences are handled explicitly so public discovery state stays reliable.
        </p>
        <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/25 px-3 py-1.5 text-xs text-muted-foreground">
          {ownershipLabel}
        </div>
        <div className="border-border/70 bg-muted/25 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Current status</span>
            <ProviderListingStatusBadge status={draftResult.draft.listing_status} />
            <span className="text-muted-foreground text-xs">
              Public visibility:{" "}
              {isPubliclyVisible
                ? "Visible on explore, map, and listing detail."
                : getListingPublicVisibilityLabel(draftResult.draft.listing_status)}
            </span>
          </div>
          {isCompanyListing ? (
            <Link
              href={`/dashboard/listings/${draftResult.draft.id}/workflow`}
              className={buttonVariants({ size: "sm" })}
            >
              Open workflow
            </Link>
          ) : (
            <ProviderListingLifecycleActions
              listingId={draftResult.draft.id}
              listingType={draftResult.draft.listing_type}
              currentStatus={draftResult.draft.listing_status}
              hideEditAction
              showUnsavedWarning
            />
          )}
        </div>
        {isCompanyListing ? (
          <div className="border-border/70 bg-surface-soft rounded-lg border px-3.5 py-3 text-xs text-muted-foreground">
            Company listings use dedicated review workflow actions for submit, approve, publish, and unpublish.
          </div>
        ) : null}
        {isHiddenByAdmin ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive-foreground rounded-lg border px-3.5 py-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              This listing is hidden by admin moderation.
            </p>
            <p className="mt-1 text-xs">
              You can still update listing details and photos, but you cannot clear this moderation status from the
              provider workflow.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to dashboard
          </Link>
          <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            My listings
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
        initialListingStatus={draftResult.draft.listing_status}
        initialValues={values}
        initialImages={imagesResult.ok ? imagesResult.images : []}
        providerOwnerId={context.profile.id}
        providerEmail={context.userEmail}
        mapStyleUrl={mapStyleUrl}
      />
    </MainContainer>
  );
}
