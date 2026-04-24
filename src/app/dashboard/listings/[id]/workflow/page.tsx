import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ShieldAlert } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import {
  PageIntro,
  PageNotice,
  PageSection,
  PageShell,
  PageState,
} from "@/components/layout/page-shell";
import { MainContainer } from "@/components/layout/main-container";
import { CompanyListingWorkflowPanel } from "@/components/listings/company-listing-workflow-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { loadCompanyListingWorkflowContextForViewer } from "@/lib/listings/company-workflow/queries";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";

type DashboardListingWorkflowPageProps = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DashboardListingWorkflowPage({ params }: DashboardListingWorkflowPageProps) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const context = await getProviderRouteContext(`/dashboard/listings/${id}/workflow`);

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <PageState
          icon={ClipboardCheck}
          title="Listing workflow unavailable"
          description={context.message}
        />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return <ProviderAccessRequired />;
  }

  const workflowResult = await loadCompanyListingWorkflowContextForViewer(context.supabase, {
    listingId: id,
    viewerId: context.profile.id,
    viewerAppRole: context.profile.role,
    timelineLimit: 36,
  });

  if (!workflowResult.ok) {
    if (workflowResult.reason === "not_found") {
      notFound();
    }

    if (workflowResult.reason === "not_company_listing") {
      return (
        <MainContainer size="content" className="space-y-5">
          <PageShell>
            <PageIntro
              eyebrow={<Badge variant="outline">Workflow</Badge>}
              title="Company workflow applies to company-owned listings only"
              description="This listing uses the individual lifecycle flow and does not require company review states."
              actions={
                <>
                  <Link
                    href={`/dashboard/listings/${id}/edit?step=review`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Open listing editor
                  </Link>
                  <Link
                    href="/dashboard/listings"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Back to listings
                  </Link>
                </>
              }
            />
            <PageNotice
              tone="warning"
              title="Review controls are not required on this listing"
              description="Continue lifecycle actions from the listing editor where publish and unpublish are managed directly."
            />
          </PageShell>
        </MainContainer>
      );
    }

    const title = workflowResult.reason === "forbidden" ? "Workflow access restricted" : "Workflow temporarily unavailable";
    const icon = workflowResult.reason === "forbidden" ? ShieldAlert : ClipboardCheck;

    return (
      <MainContainer size="content">
        <PageState icon={icon} title={title} description={workflowResult.message} />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Company listing workflow</Badge>}
          title={
            workflowResult.viewerRole === "owner" ||
            workflowResult.viewerRole === "admin" ||
            workflowResult.viewerRole === "manager"
              ? "Review, approve, and publish company listings with persisted timeline history."
              : "Track live workflow state and submit listing updates for company review."
          }
          description={
            workflowResult.viewerRole === "owner" ||
            workflowResult.viewerRole === "admin" ||
            workflowResult.viewerRole === "manager"
              ? "Agent-created company listings remain private until review and publish actions are completed by trusted company workflow roles."
              : "Company-owned listings stay controlled by reviewer roles after submission while you continue edits and follow workflow outcomes."
          }
          actions={
            <>
              <Link href="/dashboard/listings" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to listings
              </Link>
              {(workflowResult.viewerRole === "owner" ||
                workflowResult.viewerRole === "admin" ||
                workflowResult.viewerRole === "manager") ? (
                <Link href="/dashboard/activity" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Open activity log
                </Link>
              ) : null}
            </>
          }
        />

        <PageSection
          eyebrow={<Badge variant="outline">Workflow controls</Badge>}
          title="Review timeline and transitions"
          description="Complete review actions, monitor stage history, and maintain deterministic listing workflow outcomes."
          contentClassName="pt-4"
        >
          <CompanyListingWorkflowPanel
            listingId={workflowResult.listing.id}
            listingTitle={workflowResult.listing.title}
            listingStatus={workflowResult.listing.listing_status}
            viewerRole={workflowResult.viewerRole}
            capabilities={workflowResult.capabilities}
            timeline={workflowResult.timeline}
            activeEditSubmission={workflowResult.activeEditSubmission}
          />
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
