"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LoaderCircle, ShieldCheck } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCompanyWorkspaceAction } from "@/lib/company/actions";
import { COMPANY_WORKSPACE_CREATE_IDLE_STATE } from "@/lib/company/types";

export function CompanyWorkspaceCreateForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createCompanyWorkspaceAction,
    COMPANY_WORKSPACE_CREATE_IDLE_STATE
  );

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-5">
      <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_55%),linear-gradient(332deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_70%)] opacity-55" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Company governance setup</Badge>
            <Badge variant="outline">RoofHub workspace</Badge>
          </div>
          <div className="space-y-2">
            <h1 className="type-page-title">Create your company governance context</h1>
            <p className="type-body-muted max-w-3xl">
              Set up the company context for RoofHub. Your account is automatically assigned as
              owner so team management and listing workflows can build on a trusted foundation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Building2 className="text-primary size-4" />
                Workspace identity
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Company name and URL-safe workspace identifier are generated in one secure setup
                step.
              </p>
            </div>
            <div className="border-border/70 bg-surface-soft rounded-xl border px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="text-primary size-4" />
                Ownership bootstrap
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Creation and owner membership are applied atomically to avoid partial company
                states.
              </p>
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

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
          <p className="type-label">Workspace details</p>
          <h2 className="type-section-title">Company profile baseline</h2>
          <p className="type-body-muted">
            Start with your core company identity now. You can refine public profile branding and
            contact coverage immediately after setup.
          </p>
        </header>

        <div className="grid gap-4">
          <Field>
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              name="name"
              placeholder="Acme Property Group"
              maxLength={120}
              required
              aria-invalid={Boolean(state.errors?.name)}
            />
            {state.errors?.name ? <FieldError>{state.errors.name}</FieldError> : null}
            <FieldHelp>This name appears as the RoofHub company identity.</FieldHelp>
          </Field>

          <Field>
            <Label htmlFor="company-description">Company summary (optional)</Label>
            <Textarea
              id="company-description"
              name="description"
              placeholder="What your company offers, where you operate, and what seekers can expect."
              maxLength={600}
              className="min-h-28"
              aria-invalid={Boolean(state.errors?.description)}
            />
            {state.errors?.description ? <FieldError>{state.errors.description}</FieldError> : null}
            <FieldHelp>Up to 600 characters.</FieldHelp>
          </Field>
        </div>
      </section>

      <section className="border-border bg-card/96 sticky bottom-4 rounded-2xl border px-4 py-3 shadow-[0_24px_44px_-30px_color-mix(in_oklch,var(--nav-background)_36%,transparent)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm leading-6">
            Company creation activates the governance context for this account.
          </p>
          <Button type="submit" disabled={isPending} className="sm:min-w-52">
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {isPending ? "Creating context..." : "Create company context"}
          </Button>
        </div>
      </section>
    </form>
  );
}
