import Link from "next/link";
import { FileClock, LayoutDashboard, PlusSquare } from "lucide-react";

import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { loadProviderDraftSummaries } from "@/lib/listings/provider-wizard/queries";

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleDateString();
}

export default async function DashboardPage() {
  const context = await getProviderRouteContext("/dashboard");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={LayoutDashboard} title="Dashboard unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return (
      <ProviderAccessRequired
        title="Provider dashboard requires provider role"
        description="Switch your profile role to provider to create and manage listing drafts."
      />
    );
  }

  const draftsResult = await loadProviderDraftSummaries(
    context.supabase,
    context.profile.id,
    context.isAdmin
  );

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Provider dashboard</Badge>
        <h1 className="type-page-title max-w-4xl">Manage listing drafts and continue publishing workflows.</h1>
        <p className="type-body-muted max-w-3xl">
          Drafts stay editable across sessions. Start a new listing wizard or continue an in-progress draft.
        </p>
        <div>
          <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
            <PlusSquare className="size-4" aria-hidden="true" />
            New listing draft
          </Link>
        </div>
      </section>

      {!draftsResult.ok ? (
        <EmptyState icon={FileClock} title="Draft listings unavailable" description={draftsResult.message} />
      ) : draftsResult.drafts.length === 0 ? (
        <EmptyState
          icon={PlusSquare}
          title="No drafts yet"
          description="Create your first listing draft and complete each wizard step at your own pace."
          action={
            <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
              Start listing wizard
            </Link>
          }
        />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draftsResult.drafts.map((draft) => (
            <article key={draft.id} className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold tracking-tight">{draft.title}</p>
                <p className="text-muted-foreground text-xs">
                  {draft.listing_type} • {draft.property_type}
                </p>
              </div>
              <div className="text-muted-foreground space-y-1 text-xs">
                <p>City: {draft.city}</p>
                <p>Price: {draft.price_amount}</p>
                <p>Updated: {formatDate(draft.updated_at)}</p>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={draft.listing_status === "draft" ? "warning" : "neutral"}>
                  {draft.listing_status}
                </Badge>
                <Link
                  href={`/dashboard/listings/${draft.id}/edit?step=basics`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Continue
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </MainContainer>
  );
}

