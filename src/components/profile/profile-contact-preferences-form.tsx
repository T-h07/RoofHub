"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CONTACT_PREFERENCES_ACTION_IDLE_STATE } from "@/lib/profile/types";
import { updateContactPreferencesAction } from "@/lib/profile/actions";
import { type PreferredContactMethod } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

import { ProfileSectionShell } from "./profile-section-shell";
import type { ProfileAccountSnapshot, ProfileSnapshot } from "./types";

const CONTACT_METHOD_OPTIONS: Array<{
  value: PreferredContactMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "in_app",
    label: "In-app",
    hint: "Keeps communication inside RoofHub threads.",
  },
  {
    value: "phone",
    label: "Phone",
    hint: "Expose a direct call channel.",
  },
  {
    value: "email",
    label: "Email",
    hint: "Share a dedicated public contact mailbox.",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    hint: "Allow quick follow-up in WhatsApp.",
  },
  {
    value: "viber",
    label: "Viber",
    hint: "Allow Viber follow-up for supported markets.",
  },
];

function formatContactMethodLabel(method: PreferredContactMethod | "") {
  if (method === "in_app") {
    return "In-app message";
  }

  if (method === "phone") {
    return "Phone";
  }

  if (method === "email") {
    return "Email";
  }

  if (method === "whatsapp") {
    return "WhatsApp";
  }

  if (method === "viber") {
    return "Viber";
  }

  return "No primary method";
}

function areSameMethods(left: PreferredContactMethod[], right: PreferredContactMethod[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

type ContactPreferencesDraft = {
  selectedContactMethods: PreferredContactMethod[];
  preferredContactMethod: PreferredContactMethod | "";
  phone: string;
  contactEmail: string;
  whatsappPhone: string;
  viberPhone: string;
};

function buildInitialDraft(
  profile: ProfileSnapshot,
  account: ProfileAccountSnapshot
): ContactPreferencesDraft {
  return {
    selectedContactMethods: profile.contactMethods,
    preferredContactMethod: profile.preferredContactMethod ?? "",
    phone: profile.phone ?? "",
    contactEmail: profile.contactEmail ?? account.email ?? "",
    whatsappPhone: profile.whatsappPhone ?? "",
    viberPhone: profile.viberPhone ?? "",
  };
}

type ProfileContactPreferencesFormProps = {
  profile: ProfileSnapshot;
  account: ProfileAccountSnapshot;
};

export function ProfileContactPreferencesForm({
  profile,
  account,
}: ProfileContactPreferencesFormProps) {
  const router = useRouter();
  const [state, formAction, isSaving] = useActionState(
    updateContactPreferencesAction,
    CONTACT_PREFERENCES_ACTION_IDLE_STATE
  );
  const [draft, setDraft] = useState(() => buildInitialDraft(profile, account));

  const selectedContactMethodSet = useMemo(
    () => new Set(draft.selectedContactMethods),
    [draft.selectedContactMethods]
  );
  const initialDraft = useMemo(() => buildInitialDraft(profile, account), [profile, account]);
  const isDirty =
    draft.phone !== initialDraft.phone ||
    draft.contactEmail !== initialDraft.contactEmail ||
    draft.whatsappPhone !== initialDraft.whatsappPhone ||
    draft.viberPhone !== initialDraft.viberPhone ||
    draft.preferredContactMethod !== initialDraft.preferredContactMethod ||
    !areSameMethods(draft.selectedContactMethods, initialDraft.selectedContactMethods);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  function toggleContactMethod(method: PreferredContactMethod, checked: boolean) {
    setDraft((currentDraft) => {
      const nextMethods = checked
        ? Array.from(new Set([...currentDraft.selectedContactMethods, method]))
        : currentDraft.selectedContactMethods.filter((entry) => entry !== method);

      const nextPreferredContactMethod =
        currentDraft.preferredContactMethod && !nextMethods.includes(currentDraft.preferredContactMethod)
          ? (nextMethods[0] ?? "")
          : currentDraft.preferredContactMethod;

      return {
        ...currentDraft,
        selectedContactMethods: nextMethods,
        preferredContactMethod: nextPreferredContactMethod,
      };
    });
  }

  return (
    <ProfileSectionShell
      eyebrow="Contact preferences"
      title="Response channels and contact routing"
      description="Keep the channels RoofHub should expose and order them the way conversations should lead with them."
    >
      <form action={formAction} className="space-y-5">
        {state.status === "error" && state.message ? (
          <AuthStatusMessage tone="error" message={state.message} />
        ) : null}
        {state.status === "success" && state.message && !isDirty ? (
          <AuthStatusMessage tone="success" message={state.message} />
        ) : null}

        <div className="space-y-4">
          <Field>
            <Label>Enabled contact channels</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {CONTACT_METHOD_OPTIONS.map((option) => {
                const checked = selectedContactMethodSet.has(option.value);

                return (
                  <label
                    key={option.value}
                    className={cn(
                      "border-border/75 hover:border-border flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      checked ? "border-primary/55 bg-primary/10" : "bg-surface-soft"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="contactMethods"
                      value={option.value}
                      checked={checked}
                      onChange={(event) =>
                        toggleContactMethod(option.value, event.currentTarget.checked)
                      }
                      className="mt-0.5 size-4"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="text-muted-foreground block text-xs leading-5">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {state.errors?.contactMethods ? (
              <FieldError>{state.errors.contactMethods}</FieldError>
            ) : null}
          </Field>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field>
              <Label htmlFor="profile-contact-method">Primary contact method</Label>
              <Select
                id="profile-contact-method"
                name="preferredContactMethod"
                value={draft.preferredContactMethod}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    preferredContactMethod:
                      event.currentTarget.value as PreferredContactMethod | "",
                  }))
                }
                aria-invalid={Boolean(state.errors?.preferredContactMethod)}
              >
                <option value="">No primary method</option>
                {draft.selectedContactMethods.map((method) => (
                  <option key={method} value={method}>
                    {formatContactMethodLabel(method)}
                  </option>
                ))}
              </Select>
              {state.errors?.preferredContactMethod ? (
                <FieldError>{state.errors.preferredContactMethod}</FieldError>
              ) : null}
              <FieldHelp>The first channel RoofHub should emphasize in messaging context.</FieldHelp>
            </Field>

            <Field>
              <Label htmlFor="profile-phone">Primary phone number</Label>
              <Input
                id="profile-phone"
                name="phone"
                value={draft.phone}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    phone: event.currentTarget.value,
                  }))
                }
                placeholder="+49 123 456 789"
                inputMode="tel"
                aria-invalid={Boolean(state.errors?.phone)}
              />
              {state.errors?.phone ? <FieldError>{state.errors.phone}</FieldError> : null}
            </Field>

            {selectedContactMethodSet.has("email") ? (
              <Field>
                <Label htmlFor="profile-contact-email">Contact email</Label>
                <Input
                  id="profile-contact-email"
                  name="contactEmail"
                  type="email"
                  value={draft.contactEmail}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      contactEmail: event.currentTarget.value,
                    }))
                  }
                  placeholder={account.email ?? "contact@yourdomain.com"}
                  aria-invalid={Boolean(state.errors?.contactEmail)}
                />
                {state.errors?.contactEmail ? (
                  <FieldError>{state.errors.contactEmail}</FieldError>
                ) : null}
              </Field>
            ) : null}

            {selectedContactMethodSet.has("whatsapp") ? (
              <Field>
                <Label htmlFor="profile-whatsapp-phone">WhatsApp number</Label>
                <Input
                  id="profile-whatsapp-phone"
                  name="whatsappPhone"
                  value={draft.whatsappPhone}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      whatsappPhone: event.currentTarget.value,
                    }))
                  }
                  placeholder={draft.phone || "+49 123 456 789"}
                  inputMode="tel"
                  aria-invalid={Boolean(state.errors?.whatsappPhone)}
                />
                {state.errors?.whatsappPhone ? (
                  <FieldError>{state.errors.whatsappPhone}</FieldError>
                ) : null}
              </Field>
            ) : null}

            {selectedContactMethodSet.has("viber") ? (
              <Field>
                <Label htmlFor="profile-viber-phone">Viber number</Label>
                <Input
                  id="profile-viber-phone"
                  name="viberPhone"
                  value={draft.viberPhone}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      viberPhone: event.currentTarget.value,
                    }))
                  }
                  placeholder={draft.phone || "+49 123 456 789"}
                  inputMode="tel"
                  aria-invalid={Boolean(state.errors?.viberPhone)}
                />
                {state.errors?.viberPhone ? (
                  <FieldError>{state.errors.viberPhone}</FieldError>
                ) : null}
              </Field>
            ) : null}
          </div>
        </div>

        <div className="border-border/70 bg-surface-soft/72 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm leading-6">
            {isDirty
              ? "Unsaved contact preference changes."
              : "Contact routing is up to date."}
          </p>
          <Button type="submit" disabled={!isDirty || isSaving} className="sm:min-w-44">
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : "Save contact preferences"}
          </Button>
        </div>
      </form>
    </ProfileSectionShell>
  );
}
