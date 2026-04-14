"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Camera, LoaderCircle, Trash2 } from "lucide-react";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { CompanyLogoAvatar } from "@/components/company/company-logo-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_LOGO_ACTION_IDLE_STATE, COMPANY_PROFILE_IDLE_STATE } from "@/lib/company/types";
import {
  removeCompanyLogoAction,
  updateCompanyProfileAction,
  uploadCompanyLogoAction,
} from "@/lib/company/profile-actions";

type CompanyProfileFormProps = {
  company: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    logoPath: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    websiteUrl: string | null;
    coverageArea: string | null;
  };
};

function getLogoStatusMessage(
  uploadState: { status: "idle" | "error" | "success"; message?: string },
  removeState: { status: "idle" | "error" | "success"; message?: string }
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

export function CompanyProfileForm({ company }: CompanyProfileFormProps) {
  const router = useRouter();
  const [profileState, profileFormAction, isProfileSaving] = useActionState(
    updateCompanyProfileAction,
    COMPANY_PROFILE_IDLE_STATE
  );
  const [logoUploadState, logoUploadAction, isLogoUploading] = useActionState(
    uploadCompanyLogoAction,
    COMPANY_LOGO_ACTION_IDLE_STATE
  );
  const [logoRemoveState, logoRemoveAction, isLogoRemoving] = useActionState(
    removeCompanyLogoAction,
    COMPANY_LOGO_ACTION_IDLE_STATE
  );

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoActionBusy = isLogoUploading || isLogoRemoving;
  const hasLogo = Boolean(company.logoPath || company.logoUrl);

  useEffect(() => {
    if (
      profileState.status === "success" ||
      logoUploadState.status === "success" ||
      logoRemoveState.status === "success"
    ) {
      router.refresh();
    }
  }, [logoRemoveState.status, logoUploadState.status, profileState.status, router]);

  useEffect(() => {
    if (logoUploadState.status !== "idle" && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [logoUploadState.status]);

  function onLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    if (!selectedFile) {
      return;
    }

    uploadFormRef.current?.requestSubmit();
  }

  const logoStatus = getLogoStatusMessage(logoUploadState, logoRemoveState);

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
          <p className="type-label">Brand identity</p>
          <h2 className="type-section-title">Company logo</h2>
          <p className="type-body-muted">
            Upload a clean square logo for consistent identity across public and private company
            surfaces.
          </p>
        </header>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <CompanyLogoAvatar
            name={company.name}
            logoUrl={company.logoUrl}
            className="size-26 rounded-2xl"
            initialsClassName="text-2xl"
          />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Public company profile</Badge>
              <Badge variant="outline">/companies/{company.slug}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <form ref={uploadFormRef} action={logoUploadAction}>
                <input
                  ref={fileInputRef}
                  name="companyLogoFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onLogoFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoActionBusy}
                >
                  {isLogoUploading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  {hasLogo ? "Replace logo" : "Upload logo"}
                </Button>
              </form>

              <form action={logoRemoveAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={logoActionBusy || !hasLogo}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isLogoRemoving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remove logo
                </Button>
              </form>
            </div>

            <p className="text-muted-foreground text-xs leading-5">
              Supported formats: JPEG, PNG, WEBP. Max size: 5MB.
            </p>
          </div>
        </div>

        {logoStatus ? (
          <div className="mt-4">
            <AuthStatusMessage tone={logoStatus.tone} message={logoStatus.message} />
          </div>
        ) : null}
      </section>

      {profileState.status === "error" && profileState.message ? (
        <AuthStatusMessage tone="error" message={profileState.message} />
      ) : null}
      {profileState.status === "success" && profileState.message ? (
        <AuthStatusMessage tone="success" message={profileState.message} />
      ) : null}

      <form
        action={profileFormAction}
        onChange={() => setHasUnsavedChanges(true)}
        className="space-y-5"
      >
        <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Brand identity</p>
            <h2 className="type-section-title">Company name and routing identity</h2>
            <p className="type-body-muted">
              Keep your company name stable and recognizable across listing attribution and public
              profile routes.
            </p>
          </header>

          <Field>
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              name="name"
              defaultValue={company.name}
              maxLength={120}
              required
              aria-invalid={Boolean(profileState.errors?.name)}
            />
            {profileState.errors?.name ? <FieldError>{profileState.errors.name}</FieldError> : null}
            <FieldHelp>This name appears in search-facing company identity surfaces.</FieldHelp>
          </Field>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Company description</p>
            <h2 className="type-section-title">Tell seekers what your team does best</h2>
            <p className="type-body-muted">
              Focus on specialties, local expertise, and how your team supports clients.
            </p>
          </header>

          <Field>
            <Label htmlFor="company-description">About the company</Label>
            <Textarea
              id="company-description"
              name="description"
              defaultValue={company.description ?? ""}
              maxLength={600}
              className="min-h-32"
              placeholder="We operate across key neighborhoods with responsive agents and transparent listing guidance."
              aria-invalid={Boolean(profileState.errors?.description)}
            />
            {profileState.errors?.description ? (
              <FieldError>{profileState.errors.description}</FieldError>
            ) : null}
            <FieldHelp>Up to 600 characters.</FieldHelp>
          </Field>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Contact information</p>
            <h2 className="type-section-title">Public inquiry channels</h2>
            <p className="type-body-muted">
              Add channels that can be shown safely on the public company page.
            </p>
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field>
              <Label htmlFor="company-contact-email">Contact email</Label>
              <Input
                id="company-contact-email"
                name="contactEmail"
                type="email"
                defaultValue={company.contactEmail ?? ""}
                placeholder="hello@yourcompany.com"
                aria-invalid={Boolean(profileState.errors?.contactEmail)}
              />
              {profileState.errors?.contactEmail ? (
                <FieldError>{profileState.errors.contactEmail}</FieldError>
              ) : null}
            </Field>

            <Field>
              <Label htmlFor="company-contact-phone">Contact phone</Label>
              <Input
                id="company-contact-phone"
                name="contactPhone"
                defaultValue={company.contactPhone ?? ""}
                placeholder="+49 123 456 789"
                inputMode="tel"
                aria-invalid={Boolean(profileState.errors?.contactPhone)}
              />
              {profileState.errors?.contactPhone ? (
                <FieldError>{profileState.errors.contactPhone}</FieldError>
              ) : null}
            </Field>

            <Field className="lg:col-span-2">
              <Label htmlFor="company-website-url">Website URL</Label>
              <Input
                id="company-website-url"
                name="websiteUrl"
                defaultValue={company.websiteUrl ?? ""}
                placeholder="https://www.yourcompany.com"
                aria-invalid={Boolean(profileState.errors?.websiteUrl)}
              />
              {profileState.errors?.websiteUrl ? (
                <FieldError>{profileState.errors.websiteUrl}</FieldError>
              ) : null}
            </Field>
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
            <p className="type-label">Coverage</p>
            <h2 className="type-section-title">Areas served</h2>
            <p className="type-body-muted">
              Share the neighborhoods, cities, or regions your company actively covers.
            </p>
          </header>

          <Field>
            <Label htmlFor="company-coverage-area">Coverage summary</Label>
            <Textarea
              id="company-coverage-area"
              name="coverageArea"
              defaultValue={company.coverageArea ?? ""}
              placeholder="Berlin-Mitte, Prenzlauer Berg, Friedrichshain, and surrounding metro areas"
              maxLength={220}
              className="min-h-24"
              aria-invalid={Boolean(profileState.errors?.coverageArea)}
            />
            {profileState.errors?.coverageArea ? (
              <FieldError>{profileState.errors.coverageArea}</FieldError>
            ) : null}
            <FieldHelp>Keep this concise and location-specific.</FieldHelp>
          </Field>
        </section>

        <section className="border-border bg-card/96 sticky bottom-4 rounded-2xl border px-4 py-3 shadow-[0_24px_44px_-30px_color-mix(in_oklch,var(--nav-background)_36%,transparent)] backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm leading-6">
              {hasUnsavedChanges
                ? "You have unsaved company profile changes."
                : "Company profile is up to date."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/companies/${company.slug}`} className="inline-flex">
                <Button variant="outline" type="button">
                  <ArrowUpRight className="size-4" />
                  View public page
                </Button>
              </Link>
              <Button type="submit" disabled={isProfileSaving} className="sm:min-w-44">
                {isProfileSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isProfileSaving ? "Saving..." : "Save company profile"}
              </Button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
