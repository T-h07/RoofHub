import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CircleCheck, LayoutTemplate, Megaphone, ShieldCheck } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { MainContainer } from "@/components/layout/main-container";
import { PageIntro, PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { loadPendingCompanyInvitesForCurrentUser } from "@/lib/company/team-queries";
import { ORGANIZATION_MEMBER_ROLE_LABELS } from "@/lib/company/team-types";
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
      <MainContainer size="content" className="space-y-5">
        <PageState
          icon={Building2}
          title="Company workspace unavailable"
          description={companyContextResult.message}
        />
      </MainContainer>
    );
  }

  const status = readStatus(resolvedSearchParams);
  const pendingInvitesResult = await loadPendingCompanyInvitesForCurrentUser();
  const pendingInvites = pendingInvitesResult.ok ? pendingInvitesResult.pendingInvites : [];
  const company = companyContextResult.company;

  if (company.workspaceState === "selection_required") {
    return (
      <MainContainer size="content" className="space-y-5">
        <CompanyWorkspaceSwitcher
          workspaceOptions={company.workspaceOptions}
          activeOrganizationId={company.activeOrganizationId}
          redirectTo="/profile/company"
          title="Choose the company workspace you want to use"
          description="This account belongs to more than one RoofHub company workspace. Pick the active workspace once, and RoofHub will use it consistently for company governance, team management, and operational routing."
        />
      </MainContainer>
    );
  }

  if (!company.activeOrganization || !company.activeMembership) {
    return (
      <MainContainer size="content" className="space-y-5">
        <PageShell>
          {status === "invite-accepted" ? (
            <AuthStatusMessage
              tone="success"
              message="Company invite accepted. Choose a workspace if needed or continue setting up company mode."
            />
          ) : null}

          <PageIntro
            eyebrow={<Badge variant="outline">Company workspace</Badge>}
            title="Set up your RoofHub company account foundation"
            description="Create a company workspace to represent your team under a shared identity while your account remains the trusted owner for workspace access and membership management."
            actions={
              <>
                <Link href="/profile/company/new" className={buttonVariants({ size: "sm" })}>
                  <Building2 className="size-4" />
                  Create company workspace
                </Link>
                <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Back to profile
                </Link>
              </>
            }
          />

          <PageState
            icon={LayoutTemplate}
            title="No active company workspace yet"
            description="This account is not currently operating inside a company workspace. Create one or accept a pending invite to continue in company mode."
          />

          {pendingInvites.length > 0 ? (
            <PageSection
              eyebrow={<Badge variant="outline">Pending invites</Badge>}
              title="Accept your company invites"
              description="Accept a pending invite to activate company membership for this account."
            >
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
            </PageSection>
          ) : null}
        </PageShell>
      </MainContainer>
    );
  }

  const organization = company.activeOrganization;
  const membership = company.activeMembership;
  const logoUrl = toCompanyLogoPublicUrl(supabase, organization.logo_path);
  const completion = buildProfileCompletionChecklist(organization);
  const governanceCapabilities = [
    {
      key: "profile-edit",
      label: "Company profile editing",
      enabled: company.canEditProfile,
      detail: company.canEditProfile
        ? "You can edit branding, contact details, and company identity."
        : "Owner membership is required to edit company profile fields.",
    },
    {
      key: "team-management",
      label: "Team and invite management",
      enabled: company.canManageTeam,
      detail: company.canManageTeam
        ? "You can invite members and manage role or status changes."
        : "Owner or admin membership is required for team and invite controls.",
    },
  ] as const;

  let activeMemberCount: number | null = null;
  let pendingInviteCount: number | null = null;

  if (company.canManageTeam) {
    const [activeMembersResult, pendingInvitesResult] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("member_status", "active"),
      supabase
        .from("organization_member_invites")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("invite_status", "pending"),
    ]);

    if (!activeMembersResult.error) {
      activeMemberCount = activeMembersResult.count ?? 0;
    }

    if (!pendingInvitesResult.error) {
      pendingInviteCount = pendingInvitesResult.count ?? 0;
    }
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
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
            name: organization.name,
            slug: organization.slug,
            description: organization.description,
            logoUrl,
            contactEmail: organization.contact_email,
            contactPhone: organization.contact_phone,
            websiteUrl: organization.website_url,
            coverageArea: organization.coverage_area,
          }}
          contextLabel="Company governance workspace"
          supportingLabel={`Active role: ${ORGANIZATION_MEMBER_ROLE_LABELS[membership.role]}. This page is dedicated to company governance: profile identity, team administration, invites, and public presence.`}
          actions={
            <>
              {company.canEditProfile ? (
                <Link href="/profile/company/edit" className={buttonVariants({ size: "sm" })}>
                  Edit company profile
                </Link>
              ) : null}
              {company.canManageTeam ? (
                <Link
                  href="/profile/company/team"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open team and invites
                </Link>
              ) : null}
              <Link
                href={`/companies/${organization.slug}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                View public company page
              </Link>
            </>
          }
        />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <PageSection
              eyebrow={<Badge variant="outline">Company profile</Badge>}
              title="Identity and branding governance"
              description="Maintain a complete company profile so your team identity and public presence stay accurate."
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    Completion {completion.completed}/{completion.total}
                  </p>
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
                    Company profile is complete.
                  </p>
                )}

                {company.canEditProfile ? (
                  <Link href="/profile/company/edit" className={buttonVariants({ size: "sm" })}>
                    Edit company profile
                  </Link>
                ) : (
                  <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                    <ShieldCheck className="text-primary size-4" />
                    Profile editing is limited to owner membership.
                  </p>
                )}
              </div>
            </PageSection>

            <PageSection
              eyebrow={<Badge variant="outline">Team and invites</Badge>}
              title="Membership administration"
              description="Manage workspace members and invitation lifecycle from one governance surface."
            >
              {company.canManageTeam ? (
                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Active members</p>
                      <p className="mt-1 text-xl font-semibold tracking-tight">
                        {activeMemberCount ?? "—"}
                      </p>
                    </div>
                    <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Pending invites</p>
                      <p className="mt-1 text-xl font-semibold tracking-tight">
                        {pendingInviteCount ?? "—"}
                      </p>
                    </div>
                  </div>

                  <p className="type-body-muted">
                    Owner and admin members can invite teammates, assign roles, and manage membership status.
                  </p>

                  <Link href="/profile/company/team" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open team and invites
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                    <ShieldCheck className="text-primary size-4" />
                    Team and invite administration is limited to owner or admin membership.
                  </p>
                </div>
              )}
            </PageSection>
          </div>

          <div className="space-y-5">
            <PageSection
              eyebrow={<Badge variant="outline">Public presence</Badge>}
              title="External company page"
              description="Use your public company page to verify how RoofHub presents your brand and contact identity."
            >
              <div className="space-y-3">
                <Link
                  href={`/companies/${organization.slug}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View public company page
                </Link>
                <p className="type-body-muted">
                  This is a public reference surface, not an operational workflow area.
                </p>
              </div>
            </PageSection>

            <PageSection
              eyebrow={<Badge variant="outline">Governance scope</Badge>}
              title="Role-based governance access"
              description="Company governance visibility is intentionally scoped by membership role."
            >
              <ul className="space-y-2.5">
                {governanceCapabilities.map((capability) => (
                  <li
                    key={capability.key}
                    className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{capability.label}</p>
                      <Badge variant={capability.enabled ? "success" : "outline"}>
                        {capability.enabled ? "Available" : "Restricted"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">{capability.detail}</p>
                  </li>
                ))}
              </ul>

              <p className="type-body-muted pt-2">
                Operational listing workflow, review queue actions, and inbox routing stay in the dedicated
                operational surfaces.
              </p>
            </PageSection>
          </div>
        </section>
      </PageShell>
    </MainContainer>
  );
}
