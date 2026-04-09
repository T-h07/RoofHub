"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getRoleDescription, getRoleLabel, isAdminRole, type AppRole } from "@/lib/auth/roles";
import { updateProfileAction } from "@/lib/profile/actions";
import { PROFILE_ACTION_IDLE_STATE } from "@/lib/profile/types";
import type { PreferredContactMethod } from "@/lib/auth/roles";

type ProfileFormProps = {
  profile: {
    displayName: string;
    role: AppRole;
    bio: string | null;
    phone: string | null;
    avatarUrl: string | null;
    preferredContactMethod: PreferredContactMethod | null;
  };
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateProfileAction, PROFILE_ACTION_IDLE_STATE);
  const adminRole = isAdminRole(profile.role);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && state.message ? (
        <AuthStatusMessage tone="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <AuthStatusMessage tone="success" message={state.message} />
      ) : null}

      <Field>
        <Label htmlFor="profile-display-name">Display name</Label>
        <Input
          id="profile-display-name"
          name="displayName"
          defaultValue={profile.displayName}
          maxLength={80}
          required
          aria-invalid={Boolean(state.errors?.displayName)}
        />
        {state.errors?.displayName ? <FieldError>{state.errors.displayName}</FieldError> : null}
      </Field>

      <Field>
        <Label htmlFor="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          name="bio"
          defaultValue={profile.bio ?? ""}
          placeholder="Tell users what kind of properties or neighborhoods you focus on."
          maxLength={600}
          aria-invalid={Boolean(state.errors?.bio)}
        />
        {state.errors?.bio ? <FieldError>{state.errors.bio}</FieldError> : null}
        <FieldHelp>Up to 600 characters.</FieldHelp>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            placeholder="+49 123 456 789"
            inputMode="tel"
            aria-invalid={Boolean(state.errors?.phone)}
          />
          {state.errors?.phone ? <FieldError>{state.errors.phone}</FieldError> : null}
          <FieldHelp>Required when preferred contact method is phone, WhatsApp, or Viber.</FieldHelp>
        </Field>

        <Field>
          <Label htmlFor="profile-contact-method">Preferred contact method</Label>
          <Select
            id="profile-contact-method"
            name="preferredContactMethod"
            defaultValue={profile.preferredContactMethod ?? ""}
            aria-invalid={Boolean(state.errors?.preferredContactMethod)}
          >
            <option value="">No preference</option>
            <option value="in_app">In-app messages</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="viber">Viber</option>
            <option value="email">Email</option>
          </Select>
          {state.errors?.preferredContactMethod ? (
            <FieldError>{state.errors.preferredContactMethod}</FieldError>
          ) : null}
        </Field>
      </div>

      <Field>
        <Label htmlFor="profile-avatar-url">Avatar URL</Label>
        <Input
          id="profile-avatar-url"
          name="avatarUrl"
          type="url"
          defaultValue={profile.avatarUrl ?? ""}
          placeholder="https://example.com/avatar.jpg"
          aria-invalid={Boolean(state.errors?.avatarUrl)}
        />
        {state.errors?.avatarUrl ? <FieldError>{state.errors.avatarUrl}</FieldError> : null}
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="profile-role">Account role</Label>
          <Badge
            variant={adminRole ? "warning" : profile.role === "provider" ? "primary" : "neutral"}
          >
            {getRoleLabel(profile.role)}
          </Badge>
        </div>
        {adminRole ? (
          <>
            <input type="hidden" name="role" value="admin" />
            <p className="text-muted-foreground text-sm leading-6">
              {getRoleDescription(profile.role)}
            </p>
          </>
        ) : (
          <>
            <Select
              id="profile-role"
              name="role"
              defaultValue={profile.role}
              aria-invalid={Boolean(state.errors?.role)}
            >
              <option value="seeker">Seeker</option>
              <option value="provider">Provider</option>
            </Select>
            {state.errors?.role ? <FieldError>{state.errors.role}</FieldError> : null}
            <FieldHelp>{getRoleDescription(profile.role)}</FieldHelp>
          </>
        )}
      </Field>

      <AuthSubmitButton
        label="Save profile"
        pendingLabel="Saving..."
        className="sm:w-auto sm:px-6"
      />
    </form>
  );
}
