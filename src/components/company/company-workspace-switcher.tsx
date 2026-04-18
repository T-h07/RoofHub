"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Building2, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldHelp } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { setActiveCompanyWorkspaceAction } from "@/lib/company/actions";
import type { CompanyWorkspaceOption } from "@/lib/company/context";
import { ORGANIZATION_MEMBER_ROLE_LABELS } from "@/lib/company/team-types";
import { COMPANY_WORKSPACE_SELECTION_IDLE_STATE } from "@/lib/company/types";

type CompanyWorkspaceSwitcherProps = {
  workspaceOptions: CompanyWorkspaceOption[];
  activeOrganizationId: string | null;
  redirectTo: string;
  title: string;
  description: string;
  submitLabel?: string;
};

export function CompanyWorkspaceSwitcher({
  workspaceOptions,
  activeOrganizationId,
  redirectTo,
  title,
  description,
  submitLabel = "Continue in workspace",
}: CompanyWorkspaceSwitcherProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    setActiveCompanyWorkspaceAction,
    COMPANY_WORKSPACE_SELECTION_IDLE_STATE
  );

  const defaultOrganizationId = useMemo(() => {
    return activeOrganizationId ?? workspaceOptions[0]?.organization.id ?? "";
  }, [activeOrganizationId, workspaceOptions]);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_9%,transparent)_0%,transparent_58%),linear-gradient(320deg,color-mix(in_oklch,var(--accent)_10%,transparent)_0%,transparent_72%)] opacity-55" />
      <div className="relative space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Active workspace</Badge>
            <Badge variant="outline">Company context required</Badge>
          </div>
          <div className="space-y-2">
            <h1 className="type-page-title">{title}</h1>
            <p className="type-body-muted max-w-3xl">{description}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {workspaceOptions.map((option) => (
            <div
              key={option.organization.id}
              className="border-border/70 bg-surface-soft rounded-2xl border px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{option.organization.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {ORGANIZATION_MEMBER_ROLE_LABELS[option.membership.role]}
                  </p>
                </div>
                {option.isActive ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3.5" />
                    Active
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1">
                  <Building2 className="size-3.5" />
                  /companies/{option.organization.slug}
                </span>
                {option.canManageTeam ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1">
                    <ShieldCheck className="size-3.5" />
                    Team access
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {state.status === "error" && state.message ? (
          <AuthStatusMessage tone="error" message={state.message} />
        ) : null}
        {state.status === "success" && state.message ? (
          <AuthStatusMessage tone="success" message={state.message} />
        ) : null}

        <form action={formAction} className="space-y-4 rounded-2xl border border-border/70 bg-card/94 p-4">
          <input type="hidden" name="nextPath" value={redirectTo} />
          <Field>
            <Label htmlFor="active-organization-id">Choose workspace</Label>
            <Select
              id="active-organization-id"
              name="organizationId"
              defaultValue={defaultOrganizationId}
              disabled={isPending}
            >
              {workspaceOptions.map((option) => (
                <option key={option.organization.id} value={option.organization.id}>
                  {option.organization.name} - {ORGANIZATION_MEMBER_ROLE_LABELS[option.membership.role]}
                </option>
              ))}
            </Select>
            <FieldHelp>
              RoofHub uses this workspace as the trusted company context for dashboard, team,
              listing, and activity flows.
            </FieldHelp>
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm leading-6">
              Workspace selection is persisted to your account so company routes stop guessing.
            </p>
            <Button type="submit" disabled={isPending} className="sm:min-w-56">
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="size-4" />
              )}
              {isPending ? "Switching workspace..." : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
