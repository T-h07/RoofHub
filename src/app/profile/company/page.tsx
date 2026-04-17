import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CircleCheck, LayoutTemplate, Megaphone } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { loadPendingCompanyInvitesForCurrentUser } from "@/lib/company/team-queries";
import { ORGANIZATION_MEMBER_ROLE_LABELS } from "@/lib/company/team-types";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";
import { createServerSupabaseClient } from "@/lib/supabase";

type CompanyWorkspacePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStatus(
  searchParams: Record<string, string | string[] | undefined>
): "created" | "saved" | "invite-accepted" | null {
  const rawStatus = searchParams.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (status === "created" || status === "saved" || status === "invite-accepted") {
    return status;
  }

  return null;
}

function buildProfileCompletionChecklist(organization: {
  description: string | null;
  logo_path: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  coverage_area: string | null;
}) {
  const checks = [
    {
      label: "Company logo",
      complete: Boolean(organization.logo_path),
    },
    {
      label: "Company description",
      complete: Boolean(organization.description?.trim()),
    },
    {
      label: "Contact channel",
      complete: Boolean(organization.contact_email?.trim() || organization.contact_phone?.trim()),
    },
    {
      label: "Coverage summary",
      complete: Boolean(organization.coverage_area?.trim()),
    },
    {
      label: "Website link",
      complete: Boolean(organization.website_url?.trim()),
    },
  ];

  const completed = checks.filter((check) => check.complete).length;

  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
    missing: checks.filter((check) => !check.complete),
  };
}

export default async function CompanyWorkspacePage({ searchParams }: CompanyWorkspacePageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile/company"));
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (!companyContextResult.ok) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company workspace is unavailable"
          description={companyContextResult.message}
        />
      </MainContainer>
    );
  }

  const status = readStatus(resolvedSearchParams);
  const ownerOrganization = companyContextResult.company.ownerOrganization;
  const primaryOrganization = companyContextResult.company.primaryOrganization;
  const managementMembership = companyContextResult.company.managementMembership;

  const pendingInvitesResult = await loadPendingCompanyInvitesForCurrentUser();
  const pendingInvites = pendingInvitesResult.ok ? pendingInvitesResult.pendingInvites : [];

  if (!ownerOrganization) {
    return (
      <MainContainer size="content" className="space-y-5">
        {status === "invite-accepted" ? (
          <AuthStatusMessage
            tone="success"
            message="Company invite accepted. Your membership is now active."
          />
        ) : null}

        {primaryOrganization ? (
          <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_8%,transparent)_0%,transparent_58%),linear-gradient(325deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_68%)] opacity-55" />
            <div className="relative space-y-3">
              <Badge variant="outline">Company membership active</Badge>
              <h1 className="type-page-title">You are already part of a RoofHub company workspace</h1>
              <p className="type-body-muted max-w-3xl">
                Membership role:{" "}
                {companyContextResult.company.primaryMembership
                  ? ORGANIZATION_MEMBER_ROLE_LABELS[companyContextResult.company.primaryMembership.role]
                  : "Member"}
                . Continue in the workspace and public profile.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                  Open operations dashboard
                </Link>
                {managementMembership ? (
                  <Link href="/profile/company/team" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open team management
                  </Link>
                ) : null}
                <Link
                  href={`/companies/${primaryOrganization.slug}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View public company page
                </Link>
                <Link href="/profile" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Back to profile
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_8%,transparent)_0%,transparent_58%),linear-gradient(325deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_68%)] opacity-55" />
              <div className="relative space-y-3">
                <Badge variant="outline">Company workspace</Badge>
                <h1 className="type-page-title">Set up your RoofHub company account foundation</h1>
                <p className="type-body-muted max-w-3xl">
                  Create a company workspace to represent your team under a shared identity while your
                  current account remains the owner of that workspace.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/profile/company/new" className={buttonVariants({ size: "sm" })}>
                    <Building2 className="size-4" />
                    Create company workspace
                  </Link>
                  <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Back to profile
                  </Link>
                </div>
              </div>
            </section>

            <EmptyState
              icon={LayoutTemplate}
              title="No company workspace yet"
              description="Your account currently operates as an individual profile. Create a company workspace to unlock company branding, public profile, and team-ready foundations."
            />
          </>
        )}

        {pendingInvites.length > 0 ? (
          <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
            <header className="border-border/70 mb-4 space-y-2 border-b pb-4">
              <p className="type-label">Pending invites</p>
              <h2 className="type-section-title">Accept your company invites</h2>
              <p className="type-body-muted">
                Accept a pending invite to activate company membership for this account.
              </p>
            </header>

            <ul className="space-y-3">
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {invite.organization?.name ?? "Company workspace"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Role: {ORGANIZATION_MEMBER_ROLE_LABELS[invite.role]} • Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/profile/company/invites/${invite.invite_token}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Review invite
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </MainContainer>
    );
  }

  const logoUrl = toCompanyLogoPublicUrl(supabase, ownerOrganization.logo_path);
  const completion = buildProfileCompletionChecklist(ownerOrganization);
  const { count: publishedListingCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
    .or(
      `organization_id.eq.${ownerOrganization.id},and(organization_id.is.null,owner_id.eq.${user.id})`
    );

  return (
    <MainContainer size="wide" className="space-y-5">
      {status === "created" ? (
        <AuthStatusMessage
          tone="success"
          message="Company workspace created. Next step: complete your company profile and branding."
        />
      ) : null}
      {status === "saved" ? (
        <AuthStatusMessage tone="success" message="Company profile changes are now live." />
      ) : null}
      {status === "invite-accepted" ? (
        <AuthStatusMessage tone="success" message="Company invite accepted successfully." />
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
        contextLabel="Company workspace"
        supportingLabel="Manage branding, contact context, and your public company presence from this workspace."
        listingCount={publishedListingCount ?? 0}
        actions={
          <>
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Open operations dashboard
            </Link>
            <Link href="/profile/company/edit" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Complete company profile
            </Link>
            <Link
              href="/profile/company/team"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Team management
            </Link>
            <Link
              href={`/companies/${ownerOrganization.slug}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View public company page
            </Link>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-4 space-y-2 border-b pb-4">
            <p className="type-label">Profile readiness</p>
            <h2 className="type-section-title">Brand and contact completeness</h2>
            <p className="type-body-muted">
              A complete profile improves trust and gives seekers enough context before first
              contact.
            </p>
          </header>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Completion</p>
              <Badge variant={completion.percent >= 80 ? "success" : "warning"}>
                {completion.percent}%
              </Badge>
            </div>

            <div className="bg-border/55 h-2 rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${Math.max(8, completion.percent)}%` }}
              />
            </div>

            {completion.missing.length > 0 ? (
              <ul className="space-y-2">
                {completion.missing.map((item) => (
                  <li
                    key={`company-profile-missing-${item.label}`}
                    className="border-border/70 bg-surface-soft text-muted-foreground inline-flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                  >
                    <Megaphone className="text-primary size-4" />
                    Add {item.label.toLowerCase()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                <CircleCheck className="text-success size-4" />
                Company profile is fully complete for this foundation phase.
              </p>
            )}
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-4 space-y-2 border-b pb-4">
            <p className="type-label">Next actions</p>
            <h2 className="type-section-title">Keep company presence up to date</h2>
            <p className="type-body-muted">
              Use these shortcuts to manage how your company appears publicly.
            </p>
          </header>

          <div className="space-y-3">
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Open operations dashboard
            </Link>
            <Link href="/profile/company/edit" className={buttonVariants({ size: "sm" })}>
              Edit company profile
            </Link>
            <Link
              href={`/companies/${ownerOrganization.slug}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open public company page
            </Link>
            <Link
              href="/dashboard/listings"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Review managed listings
            </Link>
            <Link
              href="/profile/company/team"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Manage team members
            </Link>
          </div>
        </div>
      </section>
    </MainContainer>
  );
}
