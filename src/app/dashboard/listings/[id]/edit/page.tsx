import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, FilePenLine } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { ProviderListingLifecycleActions } from "@/components/dashboard/provider-listing-lifecycle-actions";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import {
  PageIntro,
  PageNotice,
  PageSection,
  PageShell,
  PageState,
  PageSummaryCard,
  PageSummaryRow,
} from "@/components/layout/page-shell";
import { MainContainer } from "@/components/layout/main-container";
import { ProviderListingWizard } from "@/components/listings/provider-listing-wizard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMapStyleUrl } from "@/lib/config/map";
import { getListingOwnershipMode } from "@/lib/listings/ownership";
import { getListingPublicVisibilityLabel, isPublicDiscoveryListing } from "@/lib/listings/visibility";
import {
  isCompanyWorkflowReviewerRole,
  loadActiveOrganizationMembershipRole,
  loadActorListingEditSubmission,
} from "@/lib/listings/company-workflow/edit-submissions";
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
        <PageState
          icon={FilePenLine}
          title="Draft workflow unavailable"
          description={context.message}
        />
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
  const isPublishedCompanyListing =
    isCompanyListing && draftResult.draft.organization_id !== null && draftResult.draft.listing_status === "published";
  let isLiveCompanyEditReviewGate = false;
  let activeLiveEditSubmissionStatus: "draft" | "pending_review" | "needs_changes" | null = null;

  if (isPublishedCompanyListing && draftResult.draft.organization_id) {
    const [membershipRole, actorSubmission] = await Promise.all([
      loadActiveOrganizationMembershipRole({
        organizationId: draftResult.draft.organization_id,
        userId: context.profile.id,
      }),
      loadActorListingEditSubmission({
        listingId: draftResult.draft.id,
        actorUserId: context.profile.id,
      }),
    ]);

    isLiveCompanyEditReviewGate =
      membershipRole !== null && !isCompanyWorkflowReviewerRole(membershipRole);
    const submissionStatus = actorSubmission?.status ?? null;
    activeLiveEditSubmissionStatus =
      submissionStatus === "draft" ||
      submissionStatus === "pending_review" ||
      submissionStatus === "needs_changes"
        ? submissionStatus
        : null;
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Listing editor</Badge>}
          title="Maintain listing details, media, and lifecycle state."
          description="Updates are saved step-by-step through the provider workflow while visibility and review consequences stay explicit."
          meta={
            <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/25 px-3 py-1.5 text-xs text-muted-foreground">
              {ownershipLabel}
            </span>
          }
          actions={
            <>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to dashboard
              </Link>
              <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                My listings
              </Link>
              <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
                Create another draft
              </Link>
            </>
          }
        />

        <PageSummaryRow className="xl:grid-cols-3">
          <PageSummaryCard
            label="Current status"
            value={<ProviderListingStatusBadge status={draftResult.draft.listing_status} />}
            detail="Lifecycle status currently applied to this listing draft."
            tone="primary"
          />
          <PageSummaryCard
            label="Public visibility"
            value={isPubliclyVisible ? "Visible" : "Not visible"}
            detail={
              isPubliclyVisible
                ? "Visible on explore, map, and listing detail routes."
                : getListingPublicVisibilityLabel(draftResult.draft.listing_status)
            }
          />
          <PageSummaryCard
            label={isCompanyListing ? "Workflow routing" : "Lifecycle controls"}
            value={isCompanyListing ? "Company review" : "Direct provider"}
            detail={
              isCompanyListing
                ? "Submit, review, approve, publish, and unpublish actions flow through company workflow."
                : "Publish and unpublish transitions are managed directly in provider lifecycle controls."
            }
          />
        </PageSummaryRow>

        {isCompanyListing ? (
          <PageNotice
            title="Company listing workflow applies here"
            description="Company listings use dedicated review transitions for submit, approve, publish, and unpublish actions."
          />
        ) : null}

        {isLiveCompanyEditReviewGate ? (
          <PageNotice
            tone="warning"
            title="Live company listing edits are review-gated"
            description="Public listing content remains unchanged until a manager, admin, or owner approves submitted edits."
          />
        ) : null}

        {isHiddenByAdmin ? (
          <PageNotice
            tone="danger"
            icon={AlertTriangle}
            title="This listing is hidden by admin moderation"
            description="You can still update listing details and photos, but moderation visibility cannot be cleared from the provider workflow."
          />
        ) : null}

        <PageSection
          eyebrow={<Badge variant="outline">Draft workflow</Badge>}
          title="Listing details and media"
          description="Continue editing across structured steps and keep workflow-ready data complete."
          action={
            isCompanyListing ? (
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
            )
          }
          contentClassName="pt-4"
        >
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
            isLiveCompanyEditReviewGate={isLiveCompanyEditReviewGate}
            activeLiveEditSubmissionStatus={activeLiveEditSubmissionStatus}
          />
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
