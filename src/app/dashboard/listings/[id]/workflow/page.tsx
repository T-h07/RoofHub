import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, ShieldAlert } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { CompanyListingWorkflowPanel } from "@/components/listings/company-listing-workflow-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
        <EmptyState
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
          <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
            <Badge variant="outline">Workflow</Badge>
            <h1 className="type-page-title mt-2">Company workflow applies to company-owned listings only</h1>
            <p className="type-body-muted mt-2">This listing uses the individual lifecycle flow and does not require company review states.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/dashboard/listings/${id}/edit?step=review`} className={buttonVariants({ size: "sm" })}>
                Open listing editor
              </Link>
              <Link href="/dashboard/listings" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to listings
              </Link>
            </div>
          </section>
        </MainContainer>
      );
    }

    const title = workflowResult.reason === "forbidden" ? "Workflow access restricted" : "Workflow temporarily unavailable";
    const icon = workflowResult.reason === "forbidden" ? ShieldAlert : ClipboardCheck;

    return (
      <MainContainer size="content">
        <EmptyState icon={icon} title={title} description={workflowResult.message} />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Company listing workflow</Badge>
        <h1 className="type-page-title mt-2 max-w-4xl">Review, approve, and publish company listings with persisted timeline history.</h1>
        <p className="type-body-muted mt-2 max-w-3xl">
          Agent-created company listings remain private until review and publish actions are completed by trusted company workflow roles.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      </section>

      <CompanyListingWorkflowPanel
        listingId={workflowResult.listing.id}
        listingTitle={workflowResult.listing.title}
        listingStatus={workflowResult.listing.listing_status}
        viewerRole={workflowResult.viewerRole}
        capabilities={workflowResult.capabilities}
        timeline={workflowResult.timeline}
      />
    </MainContainer>
  );
}
