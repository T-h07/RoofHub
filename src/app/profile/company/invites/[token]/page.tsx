import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CircleCheck, MailX, TriangleAlert } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyInviteAcceptanceForm } from "@/components/company/company-invite-acceptance-form";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { loadCompanyInviteByTokenForCurrentUser } from "@/lib/company/team-queries";
import { ORGANIZATION_INVITE_STATUS_LABELS } from "@/lib/company/team-types";
import { isUuid } from "@/lib/company/team-validation";
import { createServerSupabaseClient } from "@/lib/supabase";

type CompanyInviteTokenPageProps = {
  params: Promise<{ token: string }>;
};

export default async function CompanyInviteTokenPage({ params }: CompanyInviteTokenPageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token?.trim() ?? "";

  if (!isUuid(token)) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={MailX}
          title="Invite link is invalid"
          description="Check the invite link and try again from your latest company invite message."
        />
      </MainContainer>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath(`/profile/company/invites/${token}`));
  }

  const inviteResult = await loadCompanyInviteByTokenForCurrentUser(token);

  if (!inviteResult.ok) {
    return (
      <MainContainer size="content" className="space-y-4">
        <EmptyState
          icon={TriangleAlert}
          title="Invite unavailable"
          description={inviteResult.message}
          action={
            <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
              Open company workspace
            </Link>
          }
        />
      </MainContainer>
    );
  }

  const { invite } = inviteResult;
  const organization = invite.organization;

  if (!organization) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company workspace unavailable"
          description="The organization for this invite is not currently available."
        />
      </MainContainer>
    );
  }

  const inviteStatusLabel = ORGANIZATION_INVITE_STATUS_LABELS[invite.invite_status];

  return (
    <MainContainer size="content" className="space-y-5">
      <section className="border-border bg-card rounded-3xl border p-5 sm:p-7">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Company invite</Badge>
            <Badge variant="outline">Status: {inviteStatusLabel}</Badge>
          </div>
          <h1 className="type-page-title">{organization.name} team invitation</h1>
          <p className="type-body-muted max-w-3xl">
            Review invite details and accept from the account this invite was sent to.
          </p>
        </div>
      </section>

      {invite.invite_status === "pending" ? (
        <CompanyInviteAcceptanceForm
          inviteToken={invite.invite_token}
          companyName={organization.name}
          companySlug={organization.slug}
          role={invite.role}
        />
      ) : invite.invite_status === "accepted" ? (
        <section className="space-y-4">
          <AuthStatusMessage tone="success" message="This invite has already been accepted." />
          <div className="border-border bg-card rounded-2xl border p-4 sm:p-5">
            <p className="text-muted-foreground text-sm leading-6">
              Your membership is already active. Continue in the company workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
                Open company workspace
              </Link>
              <Link
                href={`/companies/${organization.slug}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View public company page
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <AuthStatusMessage
            tone="error"
            message={
              invite.invite_status === "revoked"
                ? "This invite was revoked by the company workspace."
                : "This invite is no longer active."
            }
          />
          <div className="border-border bg-card rounded-2xl border p-4 sm:p-5">
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm leading-6">
              <CircleCheck className="size-4" />
              Ask a company owner or admin to send a new invite if you still need access.
            </p>
          </div>
        </section>
      )}
    </MainContainer>
  );
}
