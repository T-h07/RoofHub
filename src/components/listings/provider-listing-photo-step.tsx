"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Images,
  LoaderCircle,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListingImageSelectionIssue, ListingImageUploadState } from "@/hooks/use-listing-image-upload-state";

export type ProviderListingPhotoDraft = {
  id: string;
  previewUrl: string;
  fileName: string;
  storagePath?: string;
  sortOrder: number;
  isCover: boolean;
  uploadState: ListingImageUploadState;
  error?: string;
};

type ProviderListingPhotoStepProps = {
  images: readonly ProviderListingPhotoDraft[];
  selectionIssues: readonly ListingImageSelectionIssue[];
  disabled?: boolean;
  onAddFiles: (files: FileList | null) => void;
  onSetCover: (imageId: string) => void;
  onMoveImage: (imageId: string, targetIndex: number) => void;
  onRemoveImage: (imageId: string) => void;
};

function getUploadStateLabel(state: ListingImageUploadState) {
  if (state === "uploading") {
    return "Uploading";
  }
  if (state === "failed") {
    return "Upload failed";
  }
  if (state === "local") {
    return "Pending upload";
  }

  return "Saved";
}

export function ProviderListingPhotoStep({
  images,
  selectionIssues,
  disabled = false,
  onAddFiles,
  onSetCover,
  onMoveImage,
  onRemoveImage,
}: ProviderListingPhotoStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);

  const hasFailedUploads = useMemo(
    () => images.some((image) => image.uploadState === "failed"),
    [images]
  );

  return (
    <div className="space-y-4">
      <div className="border-border/70 bg-card/45 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border px-3.5 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">Listing photos</p>
          <p className="text-muted-foreground text-xs">
            Upload, reorder, and set one cover image before publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={buttonVariants({ size: "sm" })}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            Add photos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              onAddFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {selectionIssues.length > 0 ? (
        <div className="border-border/70 bg-card/40 space-y-1 rounded-lg border px-3.5 py-2.5 text-xs">
          {selectionIssues.map((issue, index) => (
            <p key={`${issue.code}-${issue.fileName ?? "global"}-${index}`} className="text-muted-foreground">
              <TriangleAlert className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="border-border/70 bg-muted/20 rounded-xl border border-dashed p-6 text-center">
          <Images className="text-muted-foreground mx-auto size-8" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold tracking-tight">No photos added yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add at least one photo to unlock publish readiness.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => {
            const isFirst = index === 0;
            const isLast = index === images.length - 1;

            return (
              <li
                key={image.id}
                className={cn(
                  "border-border/70 bg-card/45 space-y-2.5 rounded-xl border p-2.5",
                  dragSourceId === image.id ? "ring-primary/45 ring-1" : ""
                )}
                draggable={!disabled}
                onDragStart={() => {
                  if (disabled) {
                    return;
                  }
                  setDragSourceId(image.id);
                }}
                onDragOver={(event) => {
                  if (disabled || dragSourceId === null) {
                    return;
                  }
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (disabled || !dragSourceId) {
                    return;
                  }
                  event.preventDefault();
                  onMoveImage(dragSourceId, index);
                  setDragSourceId(null);
                }}
                onDragEnd={() => setDragSourceId(null)}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black/20">
                  {image.previewUrl ? (
                    <Image
                      src={image.previewUrl}
                      alt={image.fileName}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground grid h-full w-full place-items-center text-xs">
                      Preview unavailable
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {image.isCover ? (
                      <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide">
                        <Star className="size-3" aria-hidden="true" />
                        Cover
                      </span>
                    ) : null}
                    <span className="border-border/80 bg-background/80 text-muted-foreground rounded-full border px-2 py-1 text-[10px]">
                      {getUploadStateLabel(image.uploadState)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground truncate text-xs">Photo {index + 1}</p>
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                      <GripVertical className="size-3.5" aria-hidden="true" />
                      Drag
                    </span>
                  </div>

                  {image.error ? <p className="text-destructive text-xs">{image.error}</p> : null}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSetCover(image.id)}
                      disabled={disabled || image.isCover}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {image.uploadState === "uploading" ? (
                        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Star className="size-3.5" aria-hidden="true" />
                      )}
                      Set cover
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveImage(image.id)}
                      disabled={disabled}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveImage(image.id, index - 1)}
                      disabled={disabled || isFirst}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveImage(image.id, index + 1)}
                      disabled={disabled || isLast}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                      Move down
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasFailedUploads ? (
        <div className="border-destructive/35 bg-destructive/10 rounded-lg border px-3.5 py-2 text-xs">
          Some photos failed to upload. Remove failed items or retry by saving the step again.
        </div>
      ) : null}
    </div>
  );
}
