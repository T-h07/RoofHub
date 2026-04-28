"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LoaderCircle, MapPin, Plus, Rocket, X } from "lucide-react";
import { toast } from "sonner";

import { ProviderListingPhotoStep } from "@/components/listings/provider-listing-photo-step";
import { ProviderLocationPickerMap } from "@/components/listings/provider-location-picker-map";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import {
  useListingImageUploadState,
  type ListingImageSelectionIssue,
} from "@/hooks/use-listing-image-upload-state";
import { createClient } from "@/lib/supabase/client";
import { uploadListingImage } from "@/lib/supabase/storage/listing-images";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveProviderWizardStepAction } from "@/lib/listings/provider-wizard/actions";
import { evaluateProviderPublishReadiness, type ProviderPublishBlocker } from "@/lib/listings/provider-wizard/publish";
import {
  publishProviderListingDraftAction,
  syncProviderListingPhotosAction,
} from "@/lib/listings/provider-wizard/publish-actions";
import { getNextProviderWizardStep, getPreviousProviderWizardStep } from "@/lib/listings/provider-wizard/steps";
import {
  PROVIDER_WIZARD_STEP_LABELS,
  PROVIDER_WIZARD_STEPS,
  type ProviderDraftImage,
  type ProviderListingStatus,
  type ProviderDraftWizardValues,
  type ProviderWizardFieldErrors,
  type ProviderWizardStep,
} from "@/lib/listings/provider-wizard/types";
import { canTransitionProviderListingStatus } from "@/lib/listings/provider-wizard/status-transitions";
import { createUuid } from "@/lib/utils/id";
import { cn } from "@/lib/utils";

type ProviderListingWizardProps = {
  mode: "new" | "edit";
  initialStep: ProviderWizardStep;
  initialDraftId: string | null;
  initialListingStatus?: ProviderListingStatus;
  initialValues: ProviderDraftWizardValues;
  initialImages: ProviderDraftImage[];
  providerOwnerId: string;
  providerEmail: string | null;
  mapStyleUrl: string;
  isLiveCompanyEditReviewGate?: boolean;
  activeLiveEditSubmissionStatus?: "draft" | "pending_review" | "needs_changes" | null;
};

type ContactMethodValue = Exclude<
  ProviderDraftWizardValues["preferredContactMethod"],
  ""
>;

const CONTACT_METHOD_OPTIONS: ReadonlyArray<{ value: ContactMethodValue; label: string }> = [
  { value: "in_app", label: "In-app message" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "viber", label: "Viber" },
  { value: "email", label: "Email" },
];

const PHONE_REQUIRED_CONTACT_METHODS = new Set<ContactMethodValue>([
  "phone",
  "whatsapp",
  "viber",
]);

function buildEditHref(draftId: string, step: ProviderWizardStep) {
  return `/dashboard/listings/${draftId}/edit?step=${step}`;
}

function formatCurrency(currencyCode: string, amount: string) {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) {
    return "--";
  }

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode.toUpperCase() || "EUR",
      maximumFractionDigits: 0,
    }).format(parsed);
  } catch {
    return `${parsed}`;
  }
}

function formatDate(value: string) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleDateString();
}

function formatCoordinate(value: number | null) {
  if (value === null) {
    return "--";
  }

  return value.toFixed(6);
}

function parseCoordinateInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsed = Number.parseFloat(trimmedValue.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return Number(parsed.toFixed(6));
}

function formatContactMethodLabel(
  method: ProviderDraftWizardValues["preferredContactMethod"]
) {
  switch (method) {
    case "in_app":
      return "In-app message";
    case "phone":
      return "Phone";
    case "whatsapp":
      return "WhatsApp";
    case "viber":
      return "Viber";
    case "email":
      return "Email";
    default:
      return "No preference";
  }
}

function normalizeContactMethods(
  methods: ProviderDraftWizardValues["contactMethods"]
): ContactMethodValue[] {
  return Array.from(
    new Set<ContactMethodValue>(
      methods.filter(
        (method): method is ContactMethodValue =>
          CONTACT_METHOD_OPTIONS.some((option) => option.value === method)
      )
    )
  );
}

function buildPhotoMetadataSignature(
  images: readonly {
    storagePath?: string;
    sortOrder: number;
    isCover: boolean;
  }[]
) {
  return images
    .filter((image) => Boolean(image.storagePath))
    .map((image) => `${image.storagePath}:${image.sortOrder}:${image.isCover ? "1" : "0"}`)
    .join("|");
}

function toSupabaseClientConfigMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Photo uploads are unavailable because Supabase client configuration is missing. Configure local environment variables and retry.";
  }

  const normalized = error.message.toLowerCase();
  if (normalized.includes("next_public_supabase_url")) {
    return "Photo uploads are unavailable because NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local and restart the dev server.";
  }

  if (
    normalized.includes("next_public_supabase_publishable_key") ||
    normalized.includes("next_public_supabase_anon_key")
  ) {
    return "Photo uploads are unavailable because NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Add it to .env.local and restart the dev server.";
  }

  if (normalized.includes("[supabase]")) {
    return "Photo uploads are unavailable because Supabase environment configuration is incomplete. Update .env.local and restart the dev server.";
  }

  return "Photo uploads are unavailable because Supabase client configuration failed. Update environment variables and retry.";
}

export function ProviderListingWizard({
  mode,
  initialStep,
  initialDraftId,
  initialListingStatus = "draft",
  initialValues,
  initialImages,
  providerOwnerId,
  providerEmail,
  mapStyleUrl,
  isLiveCompanyEditReviewGate = false,
  activeLiveEditSubmissionStatus = null,
}: ProviderListingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<ProviderWizardStep>(initialStep);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [listingStatus, setListingStatus] = useState<ProviderListingStatus>(initialListingStatus);
  const [draft, setDraft] = useState<ProviderDraftWizardValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<ProviderWizardFieldErrors>({});
  const [reviewBlockers, setReviewBlockers] = useState<string[]>([]);
  const [publishBlockers, setPublishBlockers] = useState<ProviderPublishBlocker[]>([]);
  const [photoSelectionIssues, setPhotoSelectionIssues] = useState<ListingImageSelectionIssue[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("info");
  const [photoAutosaveRevision, setPhotoAutosaveRevision] = useState(0);
  const [isPhotoMetadataSyncing, setIsPhotoMetadataSyncing] = useState(false);
  const photoMetadataSyncInFlightRef = useRef(false);
  const photoMetadataSyncQueuedRef = useRef(false);
  const lastSyncedPhotoMetadataSignatureRef = useRef(
    buildPhotoMetadataSignature(
      initialImages.map((image) => ({
        storagePath: image.storagePath,
        sortOrder: image.sortOrder,
        isCover: image.isCover,
      }))
    )
  );
  const {
    images: draftImages,
    addFiles,
    setCoverImage,
    moveImage,
    removeImage,
    markUploading,
    markUploaded,
    markUploadFailed,
    replaceImages,
  } = useListingImageUploadState(
    initialImages.map((image) => ({
      id: image.id,
      storagePath: image.storagePath,
      previewUrl: image.signedUrl ?? "",
      sortOrder: image.sortOrder,
      isCover: image.isCover,
    }))
  );

  const hasPhotoUploadFailures = draftImages.some((image) => image.uploadState === "failed");
  const hasPendingPhotoUploads = draftImages.some(
    (image) => image.uploadState === "local" || image.uploadState === "uploading"
  );
  const photoMetadataSignature = useMemo(
    () =>
      buildPhotoMetadataSignature(
        draftImages.map((image) => ({
          storagePath: image.storagePath,
          sortOrder: image.sortOrder,
          isCover: image.isCover,
        }))
      ),
    [draftImages]
  );

  const clientReadiness = useMemo(
    () =>
      evaluateProviderPublishReadiness({
        values: draft,
        imageCount: draftImages.length,
        hasCoverImage: draftImages.some((image) => image.isCover),
      }),
    [draft, draftImages]
  );

  const createDraftId = useMemo(
    () => createUuid(),
    []
  );

  const effectivePublishBlockers = publishBlockers.length > 0 ? publishBlockers : clientReadiness.blockers;
  const currentStepIndex = PROVIDER_WIZARD_STEPS.indexOf(currentStep);
  const previousStep = getPreviousProviderWizardStep(currentStep);
  const nextStep = getNextProviderWizardStep(currentStep);
  const canPublishFromCurrentStatus = canTransitionProviderListingStatus(listingStatus, "published");
  const hasLiveCompanyEditReviewGate = mode === "edit" && isLiveCompanyEditReviewGate;
  const hasPendingLiveEditReview = activeLiveEditSubmissionStatus === "pending_review";

  function queuePhotoMetadataSync() {
    setPhotoAutosaveRevision((current) => current + 1);
  }

  function setField<K extends keyof ProviderDraftWizardValues>(key: K, value: ProviderDraftWizardValues[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
    if (fieldErrors[key]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function setPreferredContactMethod(
    preferredContactMethod: ProviderDraftWizardValues["preferredContactMethod"]
  ) {
    setDraft((current) => {
      const nextContactMethods = normalizeContactMethods(current.contactMethods);
      if (preferredContactMethod && !nextContactMethods.includes(preferredContactMethod)) {
        nextContactMethods.push(preferredContactMethod);
      }

      return {
        ...current,
        preferredContactMethod,
        contactMethods: nextContactMethods.length > 0 ? nextContactMethods : ["in_app"],
      };
    });

    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
    if (fieldErrors.preferredContactMethod || fieldErrors.contactMethods) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.preferredContactMethod;
        delete next.contactMethods;
        return next;
      });
    }
  }

  function addContactMethod(method: ContactMethodValue) {
    setDraft((current) => ({
      ...current,
      contactMethods: normalizeContactMethods([...current.contactMethods, method]),
    }));

    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
    if (
      fieldErrors.contactMethods ||
      fieldErrors.contactPhone ||
      fieldErrors.contactEmail ||
      fieldErrors.whatsappPhone ||
      fieldErrors.viberPhone
    ) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.contactMethods;
        delete next.contactPhone;
        delete next.contactEmail;
        delete next.whatsappPhone;
        delete next.viberPhone;
        return next;
      });
    }
  }

  function removeContactMethod(method: ContactMethodValue) {
    setDraft((current) => {
      const nextContactMethods = normalizeContactMethods(
        current.contactMethods.filter((value) => value !== method)
      );
      const safeMethods: ContactMethodValue[] =
        nextContactMethods.length > 0 ? nextContactMethods : ["in_app"];
      const currentPreferred = current.preferredContactMethod;
      const preferredContactMethod: ProviderDraftWizardValues["preferredContactMethod"] =
        currentPreferred === ""
          ? ""
          : safeMethods.includes(currentPreferred as ContactMethodValue)
            ? currentPreferred
            : (safeMethods[0] ?? "");

      return {
        ...current,
        preferredContactMethod,
        contactMethods: safeMethods,
      };
    });

    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
    if (
      fieldErrors.contactMethods ||
      fieldErrors.preferredContactMethod ||
      fieldErrors.contactPhone ||
      fieldErrors.contactEmail ||
      fieldErrors.whatsappPhone ||
      fieldErrors.viberPhone
    ) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.contactMethods;
        delete next.preferredContactMethod;
        delete next.contactPhone;
        delete next.contactEmail;
        delete next.whatsappPhone;
        delete next.viberPhone;
        return next;
      });
    }
  }

  function goToStep(step: ProviderWizardStep) {
    setCurrentStep(step);
    if (draftId) {
      router.replace(buildEditHref(draftId, step), { scroll: false });
    }
  }

  async function persistPhotosStepCore() {
    if (!draftId) {
      return {
        ok: false as const,
        message: "Create the draft in basics step before uploading photos.",
      };
    }

    let stagedImages = [...draftImages];
    const localImages = stagedImages.filter((image) => image.uploadState === "local");
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (error) {
      return {
        ok: false as const,
        message: toSupabaseClientConfigMessage(error),
      };
    }

    for (const image of localImages) {
      markUploading(image.id);
      stagedImages = stagedImages.map((entry) =>
        entry.id === image.id
          ? {
              ...entry,
              uploadState: "uploading",
              error: undefined,
            }
          : entry
      );

      if (!image.file) {
        const errorMessage = "Local file handle is missing. Re-add this image and retry.";
        markUploadFailed(image.id, errorMessage);
        stagedImages = stagedImages.map((entry) =>
          entry.id === image.id
            ? {
                ...entry,
                uploadState: "failed",
                error: errorMessage,
              }
            : entry
        );
        continue;
      }

      try {
        const uploadResult = await uploadListingImage(supabase, {
          ownerId: providerOwnerId,
          listingId: draftId,
          image: {
            localId: image.id,
            file: image.file,
            sortOrder: image.sortOrder,
            isCover: image.isCover,
          },
        });

        markUploaded(image.id, uploadResult.storagePath);
        stagedImages = stagedImages.map((entry) =>
          entry.id === image.id
            ? {
                ...entry,
                uploadState: "uploaded",
                storagePath: uploadResult.storagePath,
                error: undefined,
              }
            : entry
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Photo upload failed.";
        markUploadFailed(image.id, errorMessage);
        stagedImages = stagedImages.map((entry) =>
          entry.id === image.id
            ? {
                ...entry,
                uploadState: "failed",
                error: errorMessage,
              }
            : entry
        );
      }
    }

    if (stagedImages.some((image) => image.uploadState === "failed")) {
      return {
        ok: false as const,
        message: "Some photos failed to upload. Remove failed items or retry.",
      };
    }

    const syncResult = await syncProviderListingPhotosAction({
      draftId,
      images: stagedImages
        .filter((image) => Boolean(image.storagePath))
        .map((image) => ({
          storagePath: image.storagePath as string,
          sortOrder: image.sortOrder,
          isCover: image.isCover,
        })),
    });

    if (!syncResult.ok) {
      return {
        ok: false as const,
        message: syncResult.message,
      };
    }

    replaceImages(
      syncResult.images.map((image) => ({
        id: image.id,
        storagePath: image.storagePath,
        previewUrl: image.signedUrl ?? "",
        sortOrder: image.sortOrder,
        isCover: image.isCover,
      }))
    );
    lastSyncedPhotoMetadataSignatureRef.current = buildPhotoMetadataSignature(
      syncResult.images.map((image) => ({
        storagePath: image.storagePath,
        sortOrder: image.sortOrder,
        isCover: image.isCover,
      }))
    );
    setPublishBlockers([]);

    return {
      ok: true as const,
      message: syncResult.message,
    };
  }

  useEffect(() => {
    if (photoAutosaveRevision === 0 || !draftId) {
      return;
    }

    if (hasPendingPhotoUploads || hasPhotoUploadFailures) {
      return;
    }

    if (draftImages.some((image) => image.uploadState !== "uploaded" || !image.storagePath)) {
      return;
    }

    if (photoMetadataSignature === lastSyncedPhotoMetadataSignatureRef.current) {
      return;
    }

    let isCancelled = false;
    const currentSignature = photoMetadataSignature;
    const timeoutId = window.setTimeout(async () => {
      if (photoMetadataSyncInFlightRef.current) {
        photoMetadataSyncQueuedRef.current = true;
        return;
      }

      photoMetadataSyncInFlightRef.current = true;
      setIsPhotoMetadataSyncing(true);

      const syncResult = await syncProviderListingPhotosAction({
        draftId,
        images: draftImages
          .filter((image) => Boolean(image.storagePath))
          .map((image) => ({
            storagePath: image.storagePath as string,
            sortOrder: image.sortOrder,
            isCover: image.isCover,
          })),
      });

      if (!isCancelled) {
        if (!syncResult.ok) {
          setStatusTone("error");
          setStatusMessage(syncResult.message);
          toast.error(syncResult.message);
        } else {
          lastSyncedPhotoMetadataSignatureRef.current = currentSignature;
          replaceImages(
            syncResult.images.map((image) => ({
              id: image.id,
              storagePath: image.storagePath,
              previewUrl: image.signedUrl ?? "",
              sortOrder: image.sortOrder,
              isCover: image.isCover,
            }))
          );
        }
      }

      photoMetadataSyncInFlightRef.current = false;
      if (!isCancelled) {
        setIsPhotoMetadataSyncing(false);
      }

      if (photoMetadataSyncQueuedRef.current) {
        photoMetadataSyncQueuedRef.current = false;
        setPhotoAutosaveRevision((current) => current + 1);
      }
    }, 350);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    draftId,
    draftImages,
    hasPendingPhotoUploads,
    hasPhotoUploadFailures,
    photoMetadataSignature,
    photoAutosaveRevision,
    replaceImages,
  ]);

  function persistStep(stayOnStep = false) {
    setStatusMessage(null);
    setReviewBlockers([]);
    setPublishBlockers([]);

    startTransition(async () => {
      if (currentStep === "photos") {
        if (hasLiveCompanyEditReviewGate) {
          const message =
            "Photo updates for live company listings must be reviewed by an owner, admin, or manager before public images can change.";
          setStatusTone("error");
          setStatusMessage(message);
          toast.error(message);
          return;
        }

        const photosResult = await persistPhotosStepCore();
        if (!photosResult.ok) {
          setStatusTone("error");
          setStatusMessage(photosResult.message);
          toast.error(photosResult.message);
          return;
        }

        setStatusTone("success");
        setStatusMessage(photosResult.message);
        toast.success(photosResult.message);

        if (stayOnStep || !nextStep) {
          return;
        }

        if (!draftId) {
          setStatusTone("error");
          setStatusMessage("Draft listing id is missing. Reload and retry.");
          return;
        }

        setCurrentStep(nextStep);
        router.replace(buildEditHref(draftId, nextStep), { scroll: false });
        return;
      }

      const result = await saveProviderWizardStepAction({
        step: currentStep,
        values: draft,
        draftId,
        createDraftId,
      });

      if (!result.ok) {
        setStatusTone("error");
        setStatusMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        setReviewBlockers(result.reviewBlockers ?? []);
        toast.error(result.message);
        return;
      }

      const resolvedDraftId = result.draftId ?? draftId;
      if (!resolvedDraftId) {
        setStatusTone("error");
        setStatusMessage("Draft could not be resolved after save.");
        return;
      }

      setDraftId(resolvedDraftId);
      setFieldErrors({});
      setStatusTone("success");
      setStatusMessage(result.message);
      toast.success(result.message);

      if (currentStep === "review" || stayOnStep || !nextStep) {
        if (mode === "new") {
          router.replace(buildEditHref(resolvedDraftId, currentStep), { scroll: false });
        }
        return;
      }

      setCurrentStep(nextStep);
      router.replace(buildEditHref(resolvedDraftId, nextStep), { scroll: false });
    });
  }

  function publishDraft() {
    if (!draftId) {
      setStatusTone("error");
      setStatusMessage("Draft listing id is missing. Restart from basics.");
      return;
    }

    if (hasPendingPhotoUploads || hasPhotoUploadFailures) {
      setStatusTone("error");
      setStatusMessage("Resolve pending photo uploads in Photos step before publishing.");
      setCurrentStep("photos");
      router.replace(buildEditHref(draftId, "photos"), { scroll: false });
      return;
    }

    setStatusMessage(null);
    setReviewBlockers([]);
    setPublishBlockers([]);

    startTransition(async () => {
      const publishResult = await publishProviderListingDraftAction({ draftId });

      if (!publishResult.ok) {
        setStatusTone("error");
        setStatusMessage(publishResult.message);
        setPublishBlockers(publishResult.blockers ?? []);
        toast.error(publishResult.message);
        return;
      }

      setStatusTone("success");
      setStatusMessage(publishResult.message);
      setPublishBlockers([]);
      if (publishResult.nextStatus) {
        setListingStatus(publishResult.nextStatus);
      }
      toast.success("Listing is now live.");
      router.push(`/listing/${publishResult.listingSlug}`);
    });
  }

  function addPhotoFiles(files: FileList | null) {
    const issues = addFiles(files ?? []);
    setPhotoSelectionIssues(issues);
    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
  }

  function setCoverPhoto(imageId: string) {
    setCoverImage(imageId);
    queuePhotoMetadataSync();
    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
  }

  function movePhoto(imageId: string, targetIndex: number) {
    moveImage(imageId, targetIndex);
    queuePhotoMetadataSync();
    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
  }

  function removePhoto(imageId: string) {
    removeImage(imageId);
    queuePhotoMetadataSync();
    if (publishBlockers.length > 0) {
      setPublishBlockers([]);
    }
  }

  function renderStatus() {
    if (!statusMessage) {
      return null;
    }

    return (
      <div
        className={cn(
          "rounded-lg border px-3.5 py-2.5 text-sm",
          statusTone === "success"
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            : statusTone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
              : "border-border/70 bg-muted/25 text-muted-foreground"
        )}
        role={statusTone === "error" ? "alert" : "status"}
      >
        {statusMessage}
      </div>
    );
  }

  function renderBasicsStep() {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <Field>
            <Label htmlFor="wizard-title">Listing title</Label>
            <Input
              id="wizard-title"
              value={draft.title}
              onChange={(event) => setField("title", event.currentTarget.value)}
              maxLength={120}
              placeholder="Sunlit two-bedroom apartment near city center"
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title ? <FieldError>{fieldErrors.title}</FieldError> : null}
            <FieldHelp>Use clear, specific wording. Keep it readable in listing cards.</FieldHelp>
          </Field>

          <Field>
            <Label htmlFor="wizard-description">Description</Label>
            <Textarea
              id="wizard-description"
              value={draft.description}
              onChange={(event) => setField("description", event.currentTarget.value)}
              rows={8}
              maxLength={5000}
              placeholder="Describe layout, highlights, neighborhood context, and move-in expectations."
              aria-invalid={Boolean(fieldErrors.description)}
            />
            {fieldErrors.description ? <FieldError>{fieldErrors.description}</FieldError> : null}
            <FieldHelp>Focus on details that help seekers make a decision quickly.</FieldHelp>
          </Field>
        </div>

        <div className="border-border/70 bg-muted/20 space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold tracking-tight">Step outcome</p>
          <p className="text-muted-foreground text-sm leading-6">
            This step creates the draft listing and anchors all later edits to a stable listing id.
          </p>
        </div>
      </div>
    );
  }

  function renderPricingStep() {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Field>
          <Label htmlFor="wizard-listing-type">Listing type</Label>
          <Select
            id="wizard-listing-type"
            value={draft.listingType}
            onChange={(event) =>
              setField("listingType", event.currentTarget.value as ProviderDraftWizardValues["listingType"])
            }
            aria-invalid={Boolean(fieldErrors.listingType)}
          >
            <option value="rent">Rent</option>
            <option value="sale">Sale</option>
          </Select>
          {fieldErrors.listingType ? <FieldError>{fieldErrors.listingType}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-property-type">Property type</Label>
          <Select
            id="wizard-property-type"
            value={draft.propertyType}
            onChange={(event) =>
              setField("propertyType", event.currentTarget.value as ProviderDraftWizardValues["propertyType"])
            }
            aria-invalid={Boolean(fieldErrors.propertyType)}
          >
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="studio">Studio</option>
            <option value="land">Land</option>
            <option value="commercial">Commercial</option>
          </Select>
          {fieldErrors.propertyType ? <FieldError>{fieldErrors.propertyType}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-price-amount">Price amount</Label>
          <Input
            id="wizard-price-amount"
            inputMode="decimal"
            value={draft.priceAmount}
            onChange={(event) => setField("priceAmount", event.currentTarget.value)}
            placeholder="1250"
            aria-invalid={Boolean(fieldErrors.priceAmount)}
          />
          {fieldErrors.priceAmount ? <FieldError>{fieldErrors.priceAmount}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-currency">Currency</Label>
          <Input
            id="wizard-currency"
            maxLength={3}
            value={draft.currencyCode}
            onChange={(event) => setField("currencyCode", event.currentTarget.value.toUpperCase())}
            placeholder="EUR"
            aria-invalid={Boolean(fieldErrors.currencyCode)}
          />
          {fieldErrors.currencyCode ? <FieldError>{fieldErrors.currencyCode}</FieldError> : null}
        </Field>

        <Field className="lg:col-span-2">
          <Label htmlFor="wizard-deposit">Deposit amount (rent only)</Label>
          <Input
            id="wizard-deposit"
            inputMode="decimal"
            value={draft.depositAmount}
            onChange={(event) => setField("depositAmount", event.currentTarget.value)}
            disabled={draft.listingType !== "rent"}
            placeholder={draft.listingType === "rent" ? "2500" : "Not required for sale"}
            aria-invalid={Boolean(fieldErrors.depositAmount)}
          />
          {fieldErrors.depositAmount ? <FieldError>{fieldErrors.depositAmount}</FieldError> : null}
          <FieldHelp>
            Price preview: {formatCurrency(draft.currencyCode, draft.priceAmount)}
            {draft.listingType === "rent" ? " / month" : ""}
          </FieldHelp>
        </Field>
      </div>
    );
  }

  function renderFactsStep() {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Field>
          <Label htmlFor="wizard-area">Area (m²)</Label>
          <Input
            id="wizard-area"
            inputMode="decimal"
            value={draft.areaM2}
            onChange={(event) => setField("areaM2", event.currentTarget.value)}
            placeholder="82"
            aria-invalid={Boolean(fieldErrors.areaM2)}
          />
          {fieldErrors.areaM2 ? <FieldError>{fieldErrors.areaM2}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-city">City</Label>
          <Input
            id="wizard-city"
            value={draft.city}
            onChange={(event) => setField("city", event.currentTarget.value)}
            placeholder="Berlin"
            aria-invalid={Boolean(fieldErrors.city)}
          />
          {fieldErrors.city ? <FieldError>{fieldErrors.city}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-bedrooms">Bedrooms</Label>
          <Input
            id="wizard-bedrooms"
            inputMode="numeric"
            value={draft.bedrooms}
            onChange={(event) => setField("bedrooms", event.currentTarget.value)}
            placeholder="2"
            aria-invalid={Boolean(fieldErrors.bedrooms)}
          />
          {fieldErrors.bedrooms ? <FieldError>{fieldErrors.bedrooms}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-bathrooms">Bathrooms</Label>
          <Input
            id="wizard-bathrooms"
            inputMode="decimal"
            value={draft.bathrooms}
            onChange={(event) => setField("bathrooms", event.currentTarget.value)}
            placeholder="1.5"
            aria-invalid={Boolean(fieldErrors.bathrooms)}
          />
          {fieldErrors.bathrooms ? <FieldError>{fieldErrors.bathrooms}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-floor-number">Floor number</Label>
          <Input
            id="wizard-floor-number"
            inputMode="numeric"
            value={draft.floorNumber}
            onChange={(event) => setField("floorNumber", event.currentTarget.value)}
            placeholder="4"
            aria-invalid={Boolean(fieldErrors.floorNumber)}
          />
          {fieldErrors.floorNumber ? <FieldError>{fieldErrors.floorNumber}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-total-floors">Total floors</Label>
          <Input
            id="wizard-total-floors"
            inputMode="numeric"
            value={draft.totalFloors}
            onChange={(event) => setField("totalFloors", event.currentTarget.value)}
            placeholder="8"
            aria-invalid={Boolean(fieldErrors.totalFloors)}
          />
          {fieldErrors.totalFloors ? <FieldError>{fieldErrors.totalFloors}</FieldError> : null}
        </Field>

        <Field>
          <Label htmlFor="wizard-neighborhood">Neighborhood</Label>
          <Input
            id="wizard-neighborhood"
            value={draft.neighborhood}
            onChange={(event) => setField("neighborhood", event.currentTarget.value)}
            placeholder="Kreuzberg"
          />
        </Field>

        <Field>
          <Label htmlFor="wizard-available-from">Available from</Label>
          <Input
            id="wizard-available-from"
            type="date"
            value={draft.availableFrom}
            onChange={(event) => setField("availableFrom", event.currentTarget.value)}
            aria-invalid={Boolean(fieldErrors.availableFrom)}
          />
          {fieldErrors.availableFrom ? <FieldError>{fieldErrors.availableFrom}</FieldError> : null}
        </Field>

        <div className="border-border/70 bg-muted/25 lg:col-span-2 rounded-lg border p-3.5">
          <p className="text-sm font-semibold tracking-tight">Location setup continues in the next step</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Next, you will place a draggable map pin and choose whether seekers see exact or approximate
            location publicly.
          </p>
        </div>
      </div>
    );
  }

  function renderLocationStep() {
    const hasPin = draft.latitude !== null && draft.longitude !== null;

    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-3.5">
          <ProviderLocationPickerMap
            mapStyleUrl={mapStyleUrl}
            latitude={draft.latitude}
            longitude={draft.longitude}
            onCoordinateChange={(next) => {
              setField("latitude", next.latitude);
              setField("longitude", next.longitude);
            }}
            onCoordinateClear={() => {
              setField("latitude", null);
              setField("longitude", null);
            }}
          />
          {fieldErrors.latitude ? <FieldError>{fieldErrors.latitude}</FieldError> : null}
          {fieldErrors.longitude ? <FieldError>{fieldErrors.longitude}</FieldError> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="wizard-latitude">Latitude</Label>
              <Input
                id="wizard-latitude"
                inputMode="decimal"
                value={draft.latitude === null || Number.isNaN(draft.latitude) ? "" : String(draft.latitude)}
                onChange={(event) => {
                  const value = parseCoordinateInput(event.currentTarget.value);
                  setField("latitude", value);
                }}
                placeholder="52.520008"
                aria-invalid={Boolean(fieldErrors.latitude)}
              />
            </Field>
            <Field>
              <Label htmlFor="wizard-longitude">Longitude</Label>
              <Input
                id="wizard-longitude"
                inputMode="decimal"
                value={draft.longitude === null || Number.isNaN(draft.longitude) ? "" : String(draft.longitude)}
                onChange={(event) => {
                  const value = parseCoordinateInput(event.currentTarget.value);
                  setField("longitude", value);
                }}
                placeholder="13.404954"
                aria-invalid={Boolean(fieldErrors.longitude)}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3.5">
          <Field>
            <Label htmlFor="wizard-address">Address text</Label>
            <Input
              id="wizard-address"
              value={draft.addressText}
              onChange={(event) => setField("addressText", event.currentTarget.value)}
              placeholder="Street and building details for internal listing context"
            />
            <FieldHelp>Address text complements the map pin and does not auto-place the marker.</FieldHelp>
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium tracking-tight">Public map visibility</p>
            <div className="grid gap-2">
              {(
                [
                  {
                    mode: "approximate" as const,
                    title: "Approximate area (recommended)",
                    description:
                      "Seekers see nearby map context, while exact building position stays less precise.",
                  },
                  {
                    mode: "exact" as const,
                    title: "Exact location",
                    description: "Seekers see the precise map pin for this listing.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.mode}
                  className={cn(
                    "border-border/70 bg-card/45 flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
                    draft.publicLocationMode === option.mode ? "border-primary/55 bg-primary/10" : "hover:border-border"
                  )}
                >
                  <input
                    type="radio"
                    name="wizard-public-location-mode"
                    className="mt-1 size-4"
                    checked={draft.publicLocationMode === option.mode}
                    onChange={() => setField("publicLocationMode", option.mode)}
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="text-muted-foreground block text-xs leading-5">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {fieldErrors.publicLocationMode ? <FieldError>{fieldErrors.publicLocationMode}</FieldError> : null}
          </div>

          <div className="border-border/70 bg-muted/25 space-y-1.5 rounded-lg border p-3">
            <p className="text-sm font-semibold tracking-tight">Location preview</p>
            <p className="text-muted-foreground text-xs leading-5">
              {hasPin
                ? "Pin selected and ready to save. Drag the marker to refine before continuing."
                : "Place a map pin to enable accurate location for later publish flow."}
            </p>
            <p className="text-xs">
              Coordinates: {formatCoordinate(draft.latitude)}, {formatCoordinate(draft.longitude)}
            </p>
            <p className="text-muted-foreground text-xs">
              Public mode: {draft.publicLocationMode === "exact" ? "Exact location" : "Approximate area"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderPhotosStep() {
    const coverImage = draftImages.find((image) => image.isCover) ?? null;

    return (
      <div className="space-y-4">
        {hasLiveCompanyEditReviewGate ? (
          <div className="border-border/70 bg-surface-soft rounded-lg border px-3.5 py-3 text-sm text-muted-foreground">
            Live company listing photo edits are reviewer-controlled. Use an owner, admin, or manager reviewer
            to update public media.
          </div>
        ) : null}

        <ProviderListingPhotoStep
          images={draftImages}
          selectionIssues={photoSelectionIssues}
          disabled={isPending || hasLiveCompanyEditReviewGate}
          onAddFiles={addPhotoFiles}
          onSetCover={setCoverPhoto}
          onMoveImage={movePhoto}
          onRemoveImage={removePhoto}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="font-medium tracking-tight">Photo count</p>
            <p className="text-muted-foreground mt-1">
              {draftImages.length} image{draftImages.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="font-medium tracking-tight">Cover image</p>
            <p className="text-muted-foreground mt-1">
              {coverImage ? `Photo ${coverImage.sortOrder + 1}` : "Not selected yet"}
            </p>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="font-medium tracking-tight">Publish note</p>
            <p className="text-muted-foreground mt-1">
              At least one image and one cover image are required before publish.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          {hasLiveCompanyEditReviewGate
            ? "Photo uploads and ordering are disabled while this published company listing is under edit-review gate."
            : isPhotoMetadataSyncing
            ? "Saving photo order and cover selection..."
            : "Cover and order changes are auto-saved. Use Save step to upload new files."}
        </p>
      </div>
    );
  }

  function renderAmenitiesStep() {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["furnished", "Furnished"],
            ["parking", "Parking"],
            ["petsAllowed", "Pets allowed"],
            ["elevator", "Elevator"],
            ["balcony", "Balcony"],
            ["internetIncluded", "Internet included"],
            ["utilitiesIncluded", "Utilities included"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className={cn(
              "border-border/70 bg-card/45 flex items-start gap-2.5 rounded-lg border px-3.5 py-3",
              draft[key] ? "border-primary/45 bg-primary/10" : ""
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={draft[key]}
              onChange={(event) => setField(key, event.currentTarget.checked)}
            />
            <span className="text-sm font-medium">{label}</span>
          </label>
        ))}

        <Field className="sm:col-span-2">
          <Label htmlFor="wizard-heating">Heating type</Label>
          <Select
            id="wizard-heating"
            value={draft.heatingType}
            onChange={(event) =>
              setField("heatingType", event.currentTarget.value as ProviderDraftWizardValues["heatingType"])
            }
            aria-invalid={Boolean(fieldErrors.heatingType)}
          >
            <option value="">Not specified</option>
            <option value="central">Central</option>
            <option value="electric">Electric</option>
            <option value="gas">Gas</option>
            <option value="district">District heating</option>
            <option value="other">Other</option>
          </Select>
          {fieldErrors.heatingType ? <FieldError>{fieldErrors.heatingType}</FieldError> : null}
        </Field>
      </div>
    );
  }

  function renderContactStep() {
    const selectedContactMethods = normalizeContactMethods(draft.contactMethods);
    const effectiveContactMethods: ContactMethodValue[] =
      selectedContactMethods.length > 0 ? selectedContactMethods : ["in_app"];
    const remainingContactMethods = CONTACT_METHOD_OPTIONS.filter(
      (option) => !effectiveContactMethods.includes(option.value)
    );
    const phoneIsRequired = effectiveContactMethods.some((method) =>
      PHONE_REQUIRED_CONTACT_METHODS.has(method)
    );
    const emailIsRequired = effectiveContactMethods.includes("email");
    const whatsappIsRequired = effectiveContactMethods.includes("whatsapp");
    const viberIsRequired = effectiveContactMethods.includes("viber");
    const defaultPhonePlaceholder = draft.contactPhone || "+49 123 456 789";
    const defaultEmailPlaceholder = providerEmail || "provider@example.com";

    return (
      <div className="space-y-4">
        <Field>
          <Label>Contact methods</Label>
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              {effectiveContactMethods.map((method) => {
                const isPrimary = draft.preferredContactMethod === method;

                return (
                  <span
                    key={method}
                    className={cn(
                      "border-border/70 bg-card/45 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      isPrimary ? "border-primary/55 bg-primary/12 text-primary-foreground" : ""
                    )}
                  >
                    <span>{formatContactMethodLabel(method)}</span>
                    {isPrimary ? (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        Primary
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeContactMethod(method)}
                      className={cn(
                        "text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center rounded-full transition-colors"
                      )}
                      aria-label={`Remove ${formatContactMethodLabel(method)}`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>

            {remainingContactMethods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {remainingContactMethods.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => addContactMethod(option.value)}
                    className={cn(
                      "border-border/70 bg-background/55 hover:bg-accent/60 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
                    )}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <FieldHelp>All available methods are enabled.</FieldHelp>
            )}
          </div>
          {fieldErrors.contactMethods ? <FieldError>{fieldErrors.contactMethods}</FieldError> : null}
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field>
            <Label htmlFor="wizard-contact-method">Primary contact method</Label>
            <Select
              id="wizard-contact-method"
              value={draft.preferredContactMethod}
              onChange={(event) =>
                setPreferredContactMethod(
                  event.currentTarget.value as ProviderDraftWizardValues["preferredContactMethod"]
                )
              }
              aria-invalid={Boolean(fieldErrors.preferredContactMethod)}
            >
              <option value="">No primary method</option>
              {effectiveContactMethods.map((method) => (
                <option key={method} value={method}>
                  {formatContactMethodLabel(method)}
                </option>
              ))}
            </Select>
            {fieldErrors.preferredContactMethod ? <FieldError>{fieldErrors.preferredContactMethod}</FieldError> : null}
            <FieldHelp>Primary method is shown first in listing contact guidance.</FieldHelp>
          </Field>

          {effectiveContactMethods.includes("email") ? (
            <Field>
              <Label htmlFor="wizard-contact-email">Contact email</Label>
              <Input
                id="wizard-contact-email"
                value={draft.contactEmail}
                onChange={(event) => setField("contactEmail", event.currentTarget.value)}
                placeholder={defaultEmailPlaceholder}
                inputMode="email"
                aria-invalid={Boolean(fieldErrors.contactEmail)}
              />
              {fieldErrors.contactEmail ? <FieldError>{fieldErrors.contactEmail}</FieldError> : null}
              <FieldHelp>
                {emailIsRequired
                  ? "Required only if you want a custom email; blank falls back to your sign-in email."
                  : "Optional unless email contact is enabled."}
              </FieldHelp>
            </Field>
          ) : null}

          {effectiveContactMethods.includes("phone") ? (
            <Field>
              <Label htmlFor="wizard-contact-phone">Phone number</Label>
              <Input
                id="wizard-contact-phone"
                value={draft.contactPhone}
                onChange={(event) => setField("contactPhone", event.currentTarget.value)}
                placeholder="+49 123 456 789"
                aria-invalid={Boolean(fieldErrors.contactPhone)}
              />
              {fieldErrors.contactPhone ? <FieldError>{fieldErrors.contactPhone}</FieldError> : null}
              <FieldHelp>
                {phoneIsRequired
                  ? "Required because phone contact is enabled."
                  : "Optional unless phone contact is enabled."}
              </FieldHelp>
            </Field>
          ) : null}

          {effectiveContactMethods.includes("whatsapp") ? (
            <Field>
              <Label htmlFor="wizard-contact-whatsapp">WhatsApp number</Label>
              <Input
                id="wizard-contact-whatsapp"
                value={draft.whatsappPhone}
                onChange={(event) => setField("whatsappPhone", event.currentTarget.value)}
                placeholder={defaultPhonePlaceholder}
                aria-invalid={Boolean(fieldErrors.whatsappPhone)}
              />
              {fieldErrors.whatsappPhone ? <FieldError>{fieldErrors.whatsappPhone}</FieldError> : null}
              <FieldHelp>
                {whatsappIsRequired
                  ? "Leave blank to reuse your phone number."
                  : "Optional unless WhatsApp contact is enabled."}
              </FieldHelp>
            </Field>
          ) : null}

          {effectiveContactMethods.includes("viber") ? (
            <Field>
              <Label htmlFor="wizard-contact-viber">Viber number</Label>
              <Input
                id="wizard-contact-viber"
                value={draft.viberPhone}
                onChange={(event) => setField("viberPhone", event.currentTarget.value)}
                placeholder={defaultPhonePlaceholder}
                aria-invalid={Boolean(fieldErrors.viberPhone)}
              />
              {fieldErrors.viberPhone ? <FieldError>{fieldErrors.viberPhone}</FieldError> : null}
              <FieldHelp>
                {viberIsRequired
                  ? "Leave blank to reuse your phone number."
                  : "Optional unless Viber contact is enabled."}
              </FieldHelp>
            </Field>
          ) : null}
        </div>
      </div>
    );
  }

  function renderReviewStep() {
    const coverImage = draftImages.find((image) => image.isCover) ?? null;
    const effectiveContactMethods = normalizeContactMethods(draft.contactMethods);
    const contactMethodSummary = effectiveContactMethods
      .map((method) => formatContactMethodLabel(method))
      .join(", ");
    const contactDetailSummary = effectiveContactMethods
      .map((method) => {
        switch (method) {
          case "email":
            return `Email: ${draft.contactEmail || providerEmail || "Not set"}`;
          case "phone":
            return draft.contactPhone
              ? `Phone: ${draft.contactPhone}`
              : null;
          case "whatsapp":
            return `WhatsApp: ${draft.whatsappPhone || draft.contactPhone || "Not set"}`;
          case "viber":
            return `Viber: ${draft.viberPhone || draft.contactPhone || "Not set"}`;
          case "in_app":
            return "In-app messages enabled";
          default:
            return null;
        }
      })
      .filter((value): value is string => Boolean(value))
      .join(" • ");

    return (
      <div className="space-y-4">
        {effectivePublishBlockers.length > 0 ? (
          <div className="border-destructive/40 bg-destructive/10 rounded-lg border px-4 py-3 text-sm">
            <p className="font-semibold">Publish is blocked until these sections are fixed:</p>
            <ul className="mt-2 space-y-2">
              {effectivePublishBlockers.map((blocker) => (
                <li key={blocker.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-destructive-foreground text-xs">
                    <span className="font-medium">{blocker.title}:</span> {blocker.description}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToStep(blocker.step)}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[11px]")}
                  >
                    Open {PROVIDER_WIZARD_STEP_LABELS[blocker.step]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : reviewBlockers.length > 0 ? (
          <div className="border-destructive/40 bg-destructive/10 rounded-lg border px-4 py-3 text-sm">
            <p className="font-semibold">Fix these draft sections before final review:</p>
            <p className="mt-1">{reviewBlockers.join(", ")}</p>
          </div>
        ) : (
          <>
            {canPublishFromCurrentStatus ? (
              <div className="border-emerald-500/35 bg-emerald-500/10 rounded-lg border px-4 py-3 text-sm text-emerald-100">
                Listing is publish-ready. You can publish as soon as you confirm this summary.
              </div>
            ) : listingStatus === "hidden_by_admin" ? (
              <div className="border-destructive/40 bg-destructive/10 rounded-lg border px-4 py-3 text-sm">
                <p className="font-semibold">Listing is currently hidden by admin.</p>
                <p className="mt-1 text-xs text-destructive-foreground">
                  You can update listing content, but public visibility is locked until moderation state changes.
                </p>
              </div>
            ) : listingStatus === "published" && hasLiveCompanyEditReviewGate ? (
              <div className="border-amber-500/35 bg-amber-500/10 rounded-lg border px-4 py-3 text-sm text-amber-100">
                {hasPendingLiveEditReview
                  ? "Live edit submission is pending review. Public listing data stays unchanged until owner/admin/manager approval."
                  : "Live listing stays unchanged until your staged edits are submitted and approved by owner/admin/manager reviewers."}
              </div>
            ) : listingStatus === "published" ? (
              <div className="border-emerald-500/35 bg-emerald-500/10 rounded-lg border px-4 py-3 text-sm text-emerald-100">
                Listing remains active. Save review updates to keep this public listing up to date.
              </div>
            ) : (
              <div className="border-border/70 bg-muted/25 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                Review updates are ready to save.
              </div>
            )}
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="font-medium">{draft.title || "--"}</p>
            <p className="text-muted-foreground mt-1 line-clamp-3">{draft.description || "--"}</p>
            <button
              type="button"
              onClick={() => goToStep("basics")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit basics
            </button>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p>{draft.listingType === "rent" ? "Rent" : "Sale"} • {draft.propertyType}</p>
            <p className="text-muted-foreground mt-1">
              {formatCurrency(draft.currencyCode, draft.priceAmount)}
              {draft.listingType === "rent" ? " / month" : ""}
            </p>
            <button
              type="button"
              onClick={() => goToStep("pricing")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit pricing
            </button>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p>{draft.city || "--"}{draft.neighborhood ? `, ${draft.neighborhood}` : ""}</p>
            <p className="text-muted-foreground mt-1">
              {draft.areaM2 || "--"} m² • {draft.bedrooms || "--"} bed • {draft.bathrooms || "--"} bath
            </p>
            <p className="text-muted-foreground mt-1">Available: {formatDate(draft.availableFrom)}</p>
            <button
              type="button"
              onClick={() => goToStep("facts")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit facts
            </button>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-medium">
              <MapPin className="size-3.5" aria-hidden="true" />
              {draft.latitude !== null && draft.longitude !== null
                ? `${formatCoordinate(draft.latitude)}, ${formatCoordinate(draft.longitude)}`
                : "No pin selected"}
            </p>
            <p className="text-muted-foreground mt-1 line-clamp-2">
              {draft.addressText || "Address text not provided yet."}
            </p>
            <p className="text-muted-foreground mt-1">
              {draft.publicLocationMode === "exact" ? "Exact public map mode" : "Approximate public map mode"}
            </p>
            <button
              type="button"
              onClick={() => goToStep("location")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit location
            </button>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">
              Contact methods: {contactMethodSummary || "In-app message"}
            </p>
            <p className="text-muted-foreground mt-1">
              Primary: {formatContactMethodLabel(draft.preferredContactMethod)}
            </p>
            <p className="text-muted-foreground mt-1">
              {contactDetailSummary || "No contact details configured yet."}
            </p>
            <button
              type="button"
              onClick={() => goToStep("contact")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit contact
            </button>
          </div>
          <div className="border-border/70 bg-card/45 rounded-lg border p-3 text-sm">
            <p className="font-medium">Photos: {draftImages.length}</p>
            <p className="text-muted-foreground mt-1">
              {coverImage ? `Cover is photo ${coverImage.sortOrder + 1}` : "Cover image not set"}
            </p>
            <p className="text-muted-foreground mt-1">
              {hasPendingPhotoUploads
                ? "Some photos are pending upload."
                : hasPhotoUploadFailures
                  ? "Some uploads failed and must be retried."
                  : "Photo set is synced."}
            </p>
            <button
              type="button"
              onClick={() => goToStep("photos")}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2 h-8 px-2.5 text-xs")}
            >
              Edit photos
            </button>
          </div>
        </div>

        <div className="border-border/70 bg-muted/20 rounded-lg border px-3.5 py-2.5 text-xs">
          Publish checks include: core listing fields, location pin, and at least one photo with a cover
          image.
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/70 border-b pb-4">
        <div className="space-y-2">
          <Badge variant="primary">
            Step {currentStepIndex + 1} of {PROVIDER_WIZARD_STEPS.length}
          </Badge>
          <CardTitle className="text-xl">{PROVIDER_WIZARD_STEP_LABELS[currentStep]}</CardTitle>
          <CardDescription>
            Provider posting flow with draft-safe saves, persisted photos, and publish-readiness checks.
          </CardDescription>
          <p className="text-muted-foreground text-xs">
            Current status: <span className="font-medium">{listingStatus.replaceAll("_", " ")}</span> • Public
            visibility: {listingStatus === "published" ? "visible" : "hidden from discovery"}
          </p>
          {hasLiveCompanyEditReviewGate ? (
            <p className="text-muted-foreground text-xs">
              Live company listing gate: reviewer approval is required before staged edits can update public
              listing content.
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-8">
          {PROVIDER_WIZARD_STEPS.map((step, index) => {
            const isActive = currentStep === step;
            const isClickable = Boolean(draftId) && (mode === "edit" || index <= currentStepIndex);
            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      goToStep(step);
                    }
                  }}
                  disabled={!isClickable}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left",
                    isActive ? "border-primary/55 bg-primary/12" : "border-border/70 bg-card/40",
                    !isClickable ? "cursor-default opacity-80" : "hover:border-border"
                  )}
                >
                  <span className="text-muted-foreground block text-[11px] uppercase">Step {index + 1}</span>
                  <span className="mt-0.5 block text-sm font-medium tracking-tight">
                    {PROVIDER_WIZARD_STEP_LABELS[step]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {renderStatus()}
        {currentStep === "basics" ? renderBasicsStep() : null}
        {currentStep === "pricing" ? renderPricingStep() : null}
        {currentStep === "facts" ? renderFactsStep() : null}
        {currentStep === "location" ? renderLocationStep() : null}
        {currentStep === "amenities" ? renderAmenitiesStep() : null}
        {currentStep === "contact" ? renderContactStep() : null}
        {currentStep === "photos" ? renderPhotosStep() : null}
        {currentStep === "review" ? renderReviewStep() : null}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={!previousStep || isPending}
          onClick={() => previousStep && goToStep(previousStep)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {currentStep !== "review" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => persistStep(true)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save step
            </button>
          ) : null}

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (currentStep === "review") {
                if (canPublishFromCurrentStatus) {
                  publishDraft();
                } else {
                  persistStep(true);
                }
                return;
              }

              persistStep(false);
            }}
            className={buttonVariants({ size: "sm" })}
          >
            {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {currentStep === "review" && canPublishFromCurrentStatus ? (
              <>
                <Rocket className="size-4" aria-hidden="true" />
                Publish listing
              </>
            ) : currentStep === "review" ? (
              hasLiveCompanyEditReviewGate ? "Submit changes for review" : "Save review"
            ) : (
              <>
                Save & continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </CardFooter>
    </Card>
  );
}
