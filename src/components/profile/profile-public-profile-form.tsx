"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PUBLIC_PROFILE_ACTION_IDLE_STATE,
  PROFILE_AVATAR_ACTION_IDLE_STATE,
} from "@/lib/profile/types";
import {
  removeProfileAvatarAction,
  updatePublicProfileAction,
  uploadProfileAvatarAction,
} from "@/lib/profile/actions";
import { isProviderRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

import { ProfileSectionShell } from "./profile-section-shell";
import type { ProfileAccountSnapshot, ProfileSnapshot } from "./types";

function toInitials(displayName: string, role: ProfileSnapshot["role"]) {
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

function getAvatarStatusMessage(
  uploadState: { status: string; message?: string },
  removeState: { status: string; message?: string }
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

type ProfilePublicProfileFormProps = {
  profile: ProfileSnapshot;
  account: ProfileAccountSnapshot;
};

export function ProfilePublicProfileForm({
  profile,
  account,
}: ProfilePublicProfileFormProps) {
  const router = useRouter();
  const [profileState, profileFormAction, isProfileSaving] = useActionState(
    updatePublicProfileAction,
    PUBLIC_PROFILE_ACTION_IDLE_STATE
  );
  const [avatarUploadState, avatarUploadAction, isAvatarUploading] = useActionState(
    uploadProfileAvatarAction,
    PROFILE_AVATAR_ACTION_IDLE_STATE
  );
  const [avatarRemoveState, avatarRemoveAction, isAvatarRemoving] = useActionState(
    removeProfileAvatarAction,
    PROFILE_AVATAR_ACTION_IDLE_STATE
  );
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);

  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const avatarActionBusy = isAvatarUploading || isAvatarRemoving;
  const isProvider = isProviderRole(profile.role);
  const displayedAvatarUrl =
    profile.avatarUrl && brokenAvatarUrl !== profile.avatarUrl ? profile.avatarUrl : null;
  const avatarStatus = getAvatarStatusMessage(avatarUploadState, avatarRemoveState);
  const isDirty = displayName !== profile.displayName || bio !== (profile.bio ?? "");
  const profileImageInitials = useMemo(
    () => toInitials(profile.displayName, profile.role),
    [profile.displayName, profile.role]
  );

  useEffect(() => {
    if (profileState.status === "success") {
      router.refresh();
    }
  }, [profileState.status, router]);

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

  function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    if (!selectedFile) {
      return;
    }

    uploadFormRef.current?.requestSubmit();
  }

  return (
    <ProfileSectionShell
      eyebrow={isProvider ? "Marketplace identity" : "Public profile"}
      title={isProvider ? "How RoofHub presents you" : "Personal profile details"}
      description={
        isProvider
          ? "Keep your public profile crisp and trustworthy across listing detail and inquiry surfaces."
          : "Update the name and summary that anchor your account identity across saved listings and conversations."
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <div className="border-border/70 bg-surface-soft/88 rounded-2xl border p-4">
            <div className="space-y-4">
              <div
                className={cn(
                  "border-border/80 bg-card relative mx-auto size-28 overflow-hidden rounded-full border shadow-[0_16px_28px_-20px_color-mix(in_oklch,var(--nav-background)_32%,transparent)]",
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
                    sizes="112px"
                    className="h-full w-full object-cover"
                    onError={() => setBrokenAvatarUrl(profile.avatarUrl)}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex size-full items-center justify-center text-xl font-semibold tracking-tight",
                      isProvider
                        ? "bg-gradient-to-br from-primary/20 to-accent/18 text-foreground"
                        : "bg-gradient-to-br from-warm-accent/40 to-primary/16 text-foreground"
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

              <div className="space-y-2 text-center">
                <p className="text-sm font-semibold tracking-tight">Profile photo</p>
                <p className="text-muted-foreground text-xs leading-5">
                  Used in the RoofHub account hub, message threads, and marketplace surfaces.
                </p>
              </div>

              <div className="space-y-2">
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
                    className="w-full justify-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarActionBusy}
                  >
                    <Camera className="size-4" />
                    {displayedAvatarUrl ? "Change photo" : "Upload photo"}
                  </Button>
                </form>

                <form action={avatarRemoveAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="w-full justify-center gap-2"
                    disabled={avatarActionBusy || !displayedAvatarUrl}
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
          </div>

          <form action={profileFormAction} className="space-y-5">
            {profileState.status === "error" && profileState.message ? (
              <AuthStatusMessage tone="error" message={profileState.message} />
            ) : null}
            {profileState.status === "success" && profileState.message && !isDirty ? (
              <AuthStatusMessage tone="success" message={profileState.message} />
            ) : null}

            <div className="grid gap-4">
              <Field>
                <Label htmlFor="profile-display-name">Display name</Label>
                <Input
                  id="profile-display-name"
                  name="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.currentTarget.value)}
                  maxLength={80}
                  required
                  aria-invalid={Boolean(profileState.errors?.displayName)}
                />
                {profileState.errors?.displayName ? (
                  <FieldError>{profileState.errors.displayName}</FieldError>
                ) : null}
                <FieldHelp>
                  {isProvider
                    ? "Shown on listing pages, company-aware inbox views, and conversation headers."
                    : "Shown in your account shell and personal messaging surfaces."}
                </FieldHelp>
              </Field>

              <Field>
                <Label htmlFor="profile-bio">
                  {isProvider ? "Public provider summary" : "About you"}
                </Label>
                <Textarea
                  id="profile-bio"
                  name="bio"
                  value={bio}
                  onChange={(event) => setBio(event.currentTarget.value)}
                  placeholder={
                    isProvider
                      ? "Describe what you list, the neighborhoods you cover, and what seekers can expect from your response style."
                      : "Add a short note that keeps your RoofHub profile recognizable and complete."
                  }
                  maxLength={600}
                  aria-invalid={Boolean(profileState.errors?.bio)}
                  className="min-h-32"
                />
                {profileState.errors?.bio ? <FieldError>{profileState.errors.bio}</FieldError> : null}
                <FieldHelp>
                  {account.email
                    ? `Signed in as ${account.email}. This public summary stays separate from your private account email.`
                    : "Up to 600 characters."}
                </FieldHelp>
              </Field>
            </div>

            <div className="border-border/70 bg-surface-soft/72 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm leading-6">
                {isDirty ? "Unsaved public profile changes." : "Public profile is up to date."}
              </p>
              <Button type="submit" disabled={!isDirty || isProfileSaving} className="sm:min-w-40">
                {isProfileSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isProfileSaving ? "Saving..." : "Save public profile"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ProfileSectionShell>
  );
}
