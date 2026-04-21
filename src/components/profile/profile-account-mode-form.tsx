"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Building2, LoaderCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ACCOUNT_MODE_ACTION_IDLE_STATE } from "@/lib/profile/types";
import { updateAccountModeAction } from "@/lib/profile/actions";
import {
  getProviderAccountTypeLabel,
  getRoleDescription,
  getRoleLabel,
  isAdminRole,
  type AppRole,
} from "@/lib/auth/roles";

import { ProfileSectionShell } from "./profile-section-shell";
import type { ProfileSnapshot } from "./types";

type ProfileAccountModeFormProps = {
  profile: ProfileSnapshot;
};

export function ProfileAccountModeForm({ profile }: ProfileAccountModeFormProps) {
  const router = useRouter();
  const [state, formAction, isSaving] = useActionState(
    updateAccountModeAction,
    ACCOUNT_MODE_ACTION_IDLE_STATE
  );
  const [role, setRole] = useState<AppRole>(profile.role);

  const adminRole = isAdminRole(profile.role);
  const companyAnchored = profile.providerAccountType === "company";
  const isDirty = role !== profile.role;
  const roleDescription = useMemo(() => getRoleDescription(profile.role), [profile.role]);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <ProfileSectionShell
      eyebrow="Account mode"
      title="Provider and company boundaries"
      description="Keep your personal profile separate from workspace operations while making the current RoofHub account mode explicit."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={adminRole ? "warning" : profile.role === "provider" ? "primary" : "neutral"}>
            {getRoleLabel(profile.role)}
          </Badge>
          {profile.role === "provider" ? (
            <Badge variant="outline">{getProviderAccountTypeLabel(profile.providerAccountType)}</Badge>
          ) : null}
        </div>

        {state.status === "error" && state.message ? (
          <AuthStatusMessage tone="error" message={state.message} />
        ) : null}
        {state.status === "success" && state.message && !isDirty ? (
          <AuthStatusMessage tone="success" message={state.message} />
        ) : null}

        <div className="grid gap-4">
          {adminRole ? (
            <div className="border-border/70 bg-surface-soft rounded-2xl border px-4 py-3.5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <UserRound className="text-primary size-4" />
                Admin role is locked from profile settings
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{roleDescription}</p>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              <Field>
                <Label htmlFor="profile-role">Account role</Label>
                <Select
                  id="profile-role"
                  name="role"
                  value={role}
                  onChange={(event) => setRole(event.currentTarget.value as AppRole)}
                  disabled={companyAnchored}
                  aria-invalid={Boolean(state.errors?.role)}
                >
                  <option value="seeker">Seeker</option>
                  <option value="provider">Provider</option>
                </Select>
                {state.errors?.role ? <FieldError>{state.errors.role}</FieldError> : null}
                <FieldHelp>
                  {companyAnchored
                    ? "This account is anchored to a company workspace. Company membership is managed from the workspace, not from this personal profile surface."
                    : roleDescription}
                </FieldHelp>
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="border-border/70 bg-surface-soft rounded-2xl border px-4 py-3.5">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <UserRound className="text-primary size-4" />
                    Personal profile scope
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    Your name, summary, and contact channels stay attached to your user account and remain easier to debug when saved independently.
                  </p>
                </div>

                <div className="border-border/70 bg-surface-soft rounded-2xl border px-4 py-3.5">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Building2 className="text-primary size-4" />
                    Company workspace scope
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    Company routing, membership, and workspace actions stay outside the personal profile save path.
                  </p>
                  <Link
                    href="/profile/company"
                    className={`${buttonVariants({ variant: "ghost", size: "sm" })} mt-3 px-0`}
                  >
                    Open company workspace
                  </Link>
                </div>
              </div>

              <div className="border-border/70 bg-surface-soft/72 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm leading-6">
                  {isDirty ? "Unsaved account mode changes." : "Account mode is up to date."}
                </p>
                <Button type="submit" disabled={!isDirty || isSaving} className="sm:min-w-36">
                  {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {isSaving ? "Saving..." : "Save mode"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ProfileSectionShell>
  );
}
