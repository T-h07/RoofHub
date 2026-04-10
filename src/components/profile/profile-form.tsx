"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Shield, Sparkles, Trash2 } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { signOutAction } from "@/lib/auth/actions";
import { getRoleDescription, getRoleLabel, isAdminRole, type AppRole } from "@/lib/auth/roles";
import {
  removeProfileAvatarAction,
  updateProfileAction,
  uploadProfileAvatarAction,
} from "@/lib/profile/actions";
import {
  PROFILE_ACTION_IDLE_STATE,
  PROFILE_AVATAR_ACTION_IDLE_STATE,
  type ProfileAvatarActionState,
} from "@/lib/profile/types";
import type { PreferredContactMethod } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

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
    hint: "Display a direct call channel.",
  },
  {
    value: "email",
    label: "Email",
    hint: "Share a public contact mailbox.",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    hint: "Enable WhatsApp follow-up.",
  },
  {
    value: "viber",
    label: "Viber",
    hint: "Enable Viber follow-up.",
  },
];

type ProfileExperienceMetric = {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "primary" | "success" | "warning";
};

export type ProfileExperience = {
  heroTitle: string;
  heroDescription: string;
  roleDescriptor: string;
  previewTitle: string;
  previewDescription: string;
  completionPercent: number;
  completionSummary: string;
  missingItems: string[];
  metrics: ProfileExperienceMetric[];
};

type ProfileFormProps = {
  profile: {
    id: string;
    displayName: string;
    role: AppRole;
    bio: string | null;
    phone: string | null;
    avatarUrl: string | null;
    preferredContactMethod: PreferredContactMethod | null;
    contactMethods: PreferredContactMethod[];
    contactEmail: string | null;
    whatsappPhone: string | null;
    viberPhone: string | null;
  };
  account: {
    email: string | null;
    createdAt: string;
    updatedAt: string;
  };
  experience: ProfileExperience;
};

function toInitials(displayName: string, role: AppRole) {
  const segments = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return role === "provider" ? "RP" : "RH";
  }

  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

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

function resolveInitialContactMethods(profile: ProfileFormProps["profile"]) {
  const options = new Set(CONTACT_METHOD_OPTIONS.map((option) => option.value));
  const fromProfile = profile.contactMethods.filter((method) => options.has(method));

  if (fromProfile.length > 0) {
    return Array.from(new Set(fromProfile));
  }

  if (profile.preferredContactMethod && options.has(profile.preferredContactMethod)) {
    return [profile.preferredContactMethod];
  }

  return ["in_app"] satisfies PreferredContactMethod[];
}

function pickMetricToneClass(tone: ProfileExperienceMetric["tone"]) {
  if (tone === "primary") {
    return "border-primary/45 bg-primary/10";
  }

  if (tone === "success") {
    return "border-emerald-500/45 bg-emerald-500/10";
  }

  if (tone === "warning") {
    return "border-amber-500/45 bg-amber-500/10";
  }

  return "border-border/70 bg-background/50";
}

function getAvatarStatusMessage(
  uploadState: ProfileAvatarActionState,
  removeState: ProfileAvatarActionState
) {
  if (uploadState.status === "error" && uploadState.message) {
    return {
      tone: "error" as const,
      message: uploadState.message,
    };
  }

  if (removeState.status === "error" && removeState.message) {
    return {
      tone: "error" as const,
      message: removeState.message,
    };
  }

  if (uploadState.status === "success" && uploadState.message) {
    return {
      tone: "success" as const,
      message: uploadState.message,
    };
  }

  if (removeState.status === "success" && removeState.message) {
    return {
      tone: "success" as const,
      message: removeState.message,
    };
  }

  return null;
}

export function ProfileForm({ profile, account, experience }: ProfileFormProps) {
  const router = useRouter();
  const [profileState, profileFormAction, isProfileSaving] = useActionState(
    updateProfileAction,
    PROFILE_ACTION_IDLE_STATE
  );
  const [avatarUploadState, avatarUploadAction, isAvatarUploading] = useActionState(
    uploadProfileAvatarAction,
    PROFILE_AVATAR_ACTION_IDLE_STATE
  );
  const [avatarRemoveState, avatarRemoveAction, isAvatarRemoving] = useActionState(
    removeProfileAvatarAction,
    PROFILE_AVATAR_ACTION_IDLE_STATE
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);

  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProvider = profile.role === "provider";
  const adminRole = isAdminRole(profile.role);
  const avatarActionBusy = isAvatarUploading || isAvatarRemoving;
  const profileImageInitials = toInitials(profile.displayName, profile.role);
  const accountSince = formatDate(account.createdAt);
  const lastUpdated = formatDate(account.updatedAt);

  const [selectedContactMethods, setSelectedContactMethods] = useState<PreferredContactMethod[]>(
    () => resolveInitialContactMethods(profile)
  );
  const [preferredContactMethodDraft, setPreferredContactMethodDraft] = useState<
    PreferredContactMethod | ""
  >(() => profile.preferredContactMethod ?? resolveInitialContactMethods(profile)[0] ?? "");

  const avatarStatus = getAvatarStatusMessage(avatarUploadState, avatarRemoveState);

  useEffect(() => {
    if (profileState.status === "success") {
      router.refresh();
    }
  }, [router, profileState.status]);

  useEffect(() => {
    if (avatarUploadState.status === "success" || avatarRemoveState.status === "success") {
      router.refresh();
    }
  }, [avatarRemoveState.status, avatarUploadState.status, router]);

  useEffect(() => {
    if (avatarUploadState.status !== "idle" && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [avatarUploadState.status]);

  const displayedAvatarUrl =
    profile.avatarUrl && brokenAvatarUrl !== profile.avatarUrl ? profile.avatarUrl : null;
  const selectedContactMethodSet = useMemo(
    () => new Set(selectedContactMethods),
    [selectedContactMethods]
  );

  function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    if (!selectedFile) {
      return;
    }

    uploadFormRef.current?.requestSubmit();
  }

  function toggleContactMethod(method: PreferredContactMethod, checked: boolean) {
    setHasUnsavedChanges(true);
    setSelectedContactMethods((currentMethods) => {
      const nextMethods = checked
        ? Array.from(new Set([...currentMethods, method]))
        : currentMethods.filter((entry) => entry !== method);

      if (nextMethods.length === 0) {
        setPreferredContactMethodDraft("");
        return [];
      }

      if (preferredContactMethodDraft && !nextMethods.includes(preferredContactMethodDraft)) {
        setPreferredContactMethodDraft(nextMethods[0] ?? "");
      }

      return nextMethods;
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="border-border/80 bg-card/72 relative overflow-hidden rounded-3xl border p-5 shadow-[0_30px_54px_-36px_rgba(2,6,20,0.98)] sm:p-7">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-80",
            isProvider
              ? "bg-[radial-gradient(circle_at_88%_8%,rgba(64,173,255,0.2),transparent_42%),radial-gradient(circle_at_0%_100%,rgba(52,211,153,0.16),transparent_36%)]"
              : "bg-[radial-gradient(circle_at_88%_8%,rgba(64,173,255,0.17),transparent_42%),radial-gradient(circle_at_0%_100%,rgba(251,191,36,0.14),transparent_36%)]"
          )}
        />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-label">Profile hub</p>
              <Badge variant={isProvider ? "primary" : "neutral"}>{getRoleLabel(profile.role)}</Badge>
              <Badge variant="outline">NM-PT profile overhaul</Badge>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className={cn(
                  "border-border/80 bg-background/55 relative size-26 shrink-0 overflow-hidden rounded-full border shadow-[0_14px_28px_-18px_rgba(3,8,26,0.95)]",
                  isProvider
                    ? "ring-2 ring-color-mix(in_oklch,var(--primary)_34%,transparent)"
                    : "ring-2 ring-color-mix(in_oklch,var(--accent)_36%,transparent)"
                )}
              >
                {displayedAvatarUrl ? (
                  <Image
                    src={displayedAvatarUrl}
                    alt={`Profile photo for ${profile.displayName}`}
                    fill
                    unoptimized
                    sizes="120px"
                    className="h-full w-full object-cover"
                    onError={() => setBrokenAvatarUrl(profile.avatarUrl)}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex size-full items-center justify-center text-xl font-semibold tracking-tight",
                      isProvider
                        ? "bg-gradient-to-br from-sky-500/24 to-emerald-400/14 text-sky-100"
                        : "bg-gradient-to-br from-amber-400/20 to-sky-400/14 text-amber-100"
                    )}
                  >
                    {profileImageInitials}
                  </div>
                )}
                {avatarActionBusy ? (
                  <div className="bg-background/75 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                    <LoaderCircle className="text-primary size-5 animate-spin" />
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="type-page-title">{profile.displayName}</h1>
                <p className="type-body-muted max-w-2xl">{experience.heroDescription}</p>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="border-border/70 bg-background/55 rounded-full border px-2.5 py-1">
                    {experience.roleDescriptor}
                  </span>
                  <span className="border-border/70 bg-background/55 rounded-full border px-2.5 py-1">
                    Member since {accountSince}
                  </span>
                  <span className="border-border/70 bg-background/55 rounded-full border px-2.5 py-1">
                    Updated {lastUpdated}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <form ref={uploadFormRef} action={avatarUploadAction}>
                <input
                  ref={fileInputRef}
                  name="avatarFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onAvatarFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarActionBusy}
                  className="gap-2"
                >
                  <Camera className="size-4" />
                  {displayedAvatarUrl ? "Change photo" : "Upload photo"}
                </Button>
              </form>

              <form action={avatarRemoveAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={avatarActionBusy || !displayedAvatarUrl}
                  className="text-muted-foreground hover:text-foreground gap-2"
                >
                  <Trash2 className="size-4" />
                  Remove photo
                </Button>
              </form>
            </div>

            {avatarStatus ? (
              <AuthStatusMessage tone={avatarStatus.tone} message={avatarStatus.message} />
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="border-border/75 bg-background/40">
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="type-label">Profile completion</p>
                    <p className="text-sm font-semibold">{experience.completionSummary}</p>
                  </div>
                  <Badge variant={experience.completionPercent >= 80 ? "success" : "warning"}>
                    {experience.completionPercent}%
                  </Badge>
                </div>
                <div className="bg-border/55 h-2 rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      experience.completionPercent >= 80 ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${Math.max(8, experience.completionPercent)}%` }}
                  />
                </div>
                {experience.missingItems.length > 0 ? (
                  <p className="text-muted-foreground text-xs leading-5">
                    Next improvements: {experience.missingItems.slice(0, 3).join(", ")}.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs leading-5">
                    Profile baseline is complete for current marketplace surfaces.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {experience.metrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 shadow-[0_14px_30px_-24px_rgba(4,8,24,0.95)]",
                    pickMetricToneClass(metric.tone)
                  )}
                >
                  <p className="type-label">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">{metric.value}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <form
        action={profileFormAction}
        onChange={() => setHasUnsavedChanges(true)}
        className="space-y-5"
      >
        {profileState.status === "error" && profileState.message ? (
          <AuthStatusMessage tone="error" message={profileState.message} />
        ) : null}
        {profileState.status === "success" && profileState.message ? (
          <AuthStatusMessage tone="success" message={profileState.message} />
        ) : null}

        <section className="border-border/75 bg-card/68 rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">{isProvider ? "Marketplace identity" : "Personal identity"}</p>
            <h2 className="type-section-title">{experience.heroTitle}</h2>
            <p className="type-body-muted">{experience.previewDescription}</p>
          </header>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field>
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                name="displayName"
                defaultValue={profile.displayName}
                maxLength={80}
                required
                aria-invalid={Boolean(profileState.errors?.displayName)}
              />
              {profileState.errors?.displayName ? (
                <FieldError>{profileState.errors.displayName}</FieldError>
              ) : null}
              <FieldHelp>
                {isProvider
                  ? "This name is shown on listing pages and conversation headers."
                  : "This name appears in your account and conversation surfaces."}
              </FieldHelp>
            </Field>

            <Field className="xl:col-span-2">
              <Label htmlFor="profile-bio">{isProvider ? "Public provider summary" : "About you"}</Label>
              <Textarea
                id="profile-bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                placeholder={
                  isProvider
                    ? "Describe what you list, neighborhoods you serve, and what seekers can expect."
                    : "Add a short note about your preferences to personalize your RoofHub account."
                }
                maxLength={600}
                aria-invalid={Boolean(profileState.errors?.bio)}
                className="min-h-30"
              />
              {profileState.errors?.bio ? <FieldError>{profileState.errors.bio}</FieldError> : null}
              <FieldHelp>Up to 600 characters.</FieldHelp>
            </Field>
          </div>
        </section>

        <section className="border-border/75 bg-card/68 rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">
              {isProvider ? "Response channels" : "Contact preferences"}
            </p>
            <h2 className="type-section-title">
              {isProvider
                ? "Decide how seekers can reach you"
                : "Choose how RoofHub interactions should reach you"}
            </h2>
            <p className="type-body-muted">
              Select at least one channel. Your primary method is highlighted first in profile-based
              contact surfaces.
            </p>
          </header>

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
                        checked ? "border-primary/55 bg-primary/12" : "bg-background/45"
                      )}
                    >
                      <input
                        type="checkbox"
                        name="contactMethods"
                        value={option.value}
                        checked={checked}
                        onChange={(event) => toggleContactMethod(option.value, event.currentTarget.checked)}
                        className="mt-0.5 size-4"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="text-muted-foreground block text-xs leading-5">{option.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {profileState.errors?.contactMethods ? (
                <FieldError>{profileState.errors.contactMethods}</FieldError>
              ) : null}
            </Field>

            <div className="grid gap-4 xl:grid-cols-2">
              <Field>
                <Label htmlFor="profile-contact-method">Primary contact method</Label>
                <Select
                  id="profile-contact-method"
                  name="preferredContactMethod"
                  value={preferredContactMethodDraft}
                  onChange={(event) => {
                    setHasUnsavedChanges(true);
                    setPreferredContactMethodDraft(
                      event.currentTarget.value as PreferredContactMethod | ""
                    );
                  }}
                  aria-invalid={Boolean(profileState.errors?.preferredContactMethod)}
                >
                  <option value="">No primary method</option>
                  {selectedContactMethods.map((method) => (
                    <option key={method} value={method}>
                      {formatContactMethodLabel(method)}
                    </option>
                  ))}
                </Select>
                {profileState.errors?.preferredContactMethod ? (
                  <FieldError>{profileState.errors.preferredContactMethod}</FieldError>
                ) : null}
              </Field>

              <Field>
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  name="phone"
                  defaultValue={profile.phone ?? ""}
                  placeholder="+49 123 456 789"
                  inputMode="tel"
                  aria-invalid={Boolean(profileState.errors?.phone)}
                />
                {profileState.errors?.phone ? <FieldError>{profileState.errors.phone}</FieldError> : null}
              </Field>

              {selectedContactMethodSet.has("email") ? (
                <Field>
                  <Label htmlFor="profile-contact-email">Contact email</Label>
                  <Input
                    id="profile-contact-email"
                    name="contactEmail"
                    type="email"
                    defaultValue={profile.contactEmail ?? account.email ?? ""}
                    placeholder={account.email ?? "contact@yourdomain.com"}
                    aria-invalid={Boolean(profileState.errors?.contactEmail)}
                  />
                  {profileState.errors?.contactEmail ? (
                    <FieldError>{profileState.errors.contactEmail}</FieldError>
                  ) : null}
                </Field>
              ) : null}

              {selectedContactMethodSet.has("whatsapp") ? (
                <Field>
                  <Label htmlFor="profile-whatsapp-phone">WhatsApp number</Label>
                  <Input
                    id="profile-whatsapp-phone"
                    name="whatsappPhone"
                    defaultValue={profile.whatsappPhone ?? ""}
                    placeholder={profile.phone ?? "+49 123 456 789"}
                    inputMode="tel"
                    aria-invalid={Boolean(profileState.errors?.whatsappPhone)}
                  />
                  {profileState.errors?.whatsappPhone ? (
                    <FieldError>{profileState.errors.whatsappPhone}</FieldError>
                  ) : null}
                </Field>
              ) : null}

              {selectedContactMethodSet.has("viber") ? (
                <Field>
                  <Label htmlFor="profile-viber-phone">Viber number</Label>
                  <Input
                    id="profile-viber-phone"
                    name="viberPhone"
                    defaultValue={profile.viberPhone ?? ""}
                    placeholder={profile.phone ?? "+49 123 456 789"}
                    inputMode="tel"
                    aria-invalid={Boolean(profileState.errors?.viberPhone)}
                  />
                  {profileState.errors?.viberPhone ? (
                    <FieldError>{profileState.errors.viberPhone}</FieldError>
                  ) : null}
                </Field>
              ) : null}
            </div>
          </div>
        </section>

        <section className="border-border/75 bg-card/68 rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Role and visibility</p>
            <h2 className="type-section-title">{experience.previewTitle}</h2>
            <p className="type-body-muted">{experience.previewDescription}</p>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Field>
              <div className="mb-2 flex items-center justify-between gap-3">
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
                  <FieldHelp>{getRoleDescription(profile.role)}</FieldHelp>
                </>
              ) : (
                <>
                  <Select
                    id="profile-role"
                    name="role"
                    defaultValue={profile.role}
                    aria-invalid={Boolean(profileState.errors?.role)}
                  >
                    <option value="seeker">Seeker</option>
                    <option value="provider">Provider</option>
                  </Select>
                  {profileState.errors?.role ? <FieldError>{profileState.errors.role}</FieldError> : null}
                  <FieldHelp>{getRoleDescription(profile.role)}</FieldHelp>
                </>
              )}
            </Field>

            <div className="border-border/70 bg-background/45 rounded-xl border px-4 py-3.5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Sparkles className="text-primary size-4" />
                Role-aware presentation
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {isProvider
                  ? "Provider profiles emphasize trust signals, response channels, and listing presence."
                  : "Seeker profiles emphasize account identity, saved activity context, and messaging readiness."}
              </p>
            </div>
          </div>
        </section>

        <section className="border-border/75 bg-card/68 rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Account controls</p>
            <h2 className="type-section-title">Security and lifecycle</h2>
            <p className="type-body-muted">
              Access controls remain enforced server-side. This section keeps session and future account
              lifecycle actions centralized.
            </p>
          </header>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="border-border/70 bg-background/45 rounded-xl border px-4 py-3.5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Shield className="text-primary size-4" />
                Active session controls
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Sign out from this browser session instantly.
              </p>
              <form action={signOutAction} className="mt-3">
                <SignOutButton className="w-full justify-center sm:w-auto" />
              </form>
            </div>

            <div className="border-destructive/30 bg-destructive/8 rounded-xl border px-4 py-3.5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Trash2 className="text-destructive size-4" />
                Danger zone
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Account hard-delete workflow will be introduced in a follow-up PT with explicit safety checks.
              </p>
              <Button
                type="button"
                variant="destructive"
                disabled
                className="mt-3 w-full justify-center sm:w-auto"
              >
                Delete account (coming soon)
              </Button>
            </div>
          </div>
        </section>

        <section className="border-border/75 bg-card/75 sticky bottom-4 rounded-2xl border px-4 py-3 shadow-[0_24px_44px_-30px_rgba(5,10,28,0.95)] backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm leading-6">
              {hasUnsavedChanges
                ? "You have unsaved profile changes."
                : "Profile is up to date."}
            </p>
            <Button type="submit" disabled={isProfileSaving} className="sm:min-w-42">
              {isProfileSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {isProfileSaving ? "Saving..." : "Save profile updates"}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
