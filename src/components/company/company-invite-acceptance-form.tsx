"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LoaderCircle, ShieldCheck } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { acceptCompanyTeamInviteAction } from "@/lib/company/team-actions";
import {
  COMPANY_TEAM_MUTATION_IDLE_STATE,
  ORGANIZATION_MEMBER_ROLE_LABELS,
  type OrganizationMemberRole,
} from "@/lib/company/team-types";

type CompanyInviteAcceptanceFormProps = {
  inviteToken: string;
  companyName: string;
  companySlug: string;
  role: OrganizationMemberRole;
};

export function CompanyInviteAcceptanceForm({
  inviteToken,
  companyName,
  companySlug,
  role,
}: CompanyInviteAcceptanceFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    acceptCompanyTeamInviteAction,
    COMPANY_TEAM_MUTATION_IDLE_STATE
  );

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="inviteToken" value={inviteToken} />

      <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_56%),linear-gradient(326deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_74%)] opacity-55" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Company invite</Badge>
            <Badge variant="outline">RoofHub team onboarding</Badge>
          </div>

          <div className="space-y-2">
            <h1 className="type-page-title">Join {companyName}</h1>
            <p className="type-body-muted max-w-3xl">
              Accept this invite to activate company workspace membership and role-based access.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="text-primary size-4" />
                Assigned role
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {ORGANIZATION_MEMBER_ROLE_LABELS[role]}
              </p>
            </div>
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Building2 className="text-primary size-4" />
                Public company profile
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">/companies/{companySlug}</p>
            </div>
          </div>
        </div>
      </section>

      {state.status === "error" && state.message ? (
        <AuthStatusMessage tone="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <AuthStatusMessage tone="success" message={state.message} />
      ) : null}

      <section className="border-border bg-card/96 sticky bottom-4 rounded-2xl border px-4 py-3 shadow-[0_24px_44px_-30px_color-mix(in_oklch,var(--nav-background)_36%,transparent)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm leading-6">
            You can only accept invites that match your signed-in RoofHub account.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/profile/company" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Review company workspace
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {isPending ? "Accepting..." : "Accept invite"}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
}
