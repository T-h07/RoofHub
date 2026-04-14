import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CircleCheck, UsersRound } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { createServerSupabaseClient } from "@/lib/supabase";

type CompanyWorkspacePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStatus(
  searchParams: Record<string, string | string[] | undefined>
): "created" | null {
  const rawStatus = searchParams.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  return status === "created" ? "created" : null;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(parsed);
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

  if (!ownerOrganization) {
    return (
      <MainContainer size="content" className="space-y-5">
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
          icon={UsersRound}
          title="No company workspace yet"
          description="Your account currently operates as an individual profile. Create a company workspace to unlock company provider foundations."
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="content" className="space-y-5">
      {status === "created" ? (
        <AuthStatusMessage
          tone="success"
          message="Company workspace created. Your account is now the active owner."
        />
      ) : null}

      <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_54%),linear-gradient(332deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_70%)] opacity-52" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Company owner</Badge>
            <Badge variant="outline">Workspace active</Badge>
          </div>
          <div className="space-y-2">
            <h1 className="type-page-title">{ownerOrganization.name}</h1>
            <p className="type-body-muted max-w-3xl">
              This workspace is now tied to your RoofHub account as the owner. Future member and
              routing capabilities can build on this ownership context without changing your current
              authentication flow.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="type-label">Workspace slug</p>
              <p className="mt-1 text-sm font-semibold tracking-tight">{ownerOrganization.slug}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Stable identifier for future company routes.
              </p>
            </div>
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="type-label">Owner status</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                <CircleCheck className="text-success size-4" />
                Active owner membership
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Created {formatDate(ownerOrganization.created_at)}
              </p>
            </div>
          </div>

          {ownerOrganization.description ? (
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="type-label">Company summary</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-sm leading-6">
                {ownerOrganization.description}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Go to dashboard
            </Link>
            <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to profile
            </Link>
          </div>
        </div>
      </section>
    </MainContainer>
  );
}
