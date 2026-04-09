"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  normalizeCoverAndOrder,
  validateListingImageSelection,
  type ListingImageValidationIssue,
} from "@/lib/storage/listing-images";

export type ListingImageUploadState = "local" | "uploading" | "uploaded" | "failed";

export type ListingImageDraft = {
  id: string;
  file?: File;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  previewIsObjectUrl: boolean;
  sortOrder: number;
  isCover: boolean;
  storagePath?: string;
  uploadState: ListingImageUploadState;
  error?: string;
};

export type ExistingListingImageInput = {
  id: string;
  storagePath: string;
  previewUrl: string;
  sortOrder: number;
  isCover: boolean;
};

function toExistingDraft(image: ExistingListingImageInput): ListingImageDraft {
  return {
    id: image.id,
    fileName: image.storagePath.split("/").at(-1) ?? "existing-image",
    mimeType: "image/jpeg",
    size: 0,
    previewUrl: image.previewUrl,
    previewIsObjectUrl: false,
    sortOrder: image.sortOrder,
    isCover: image.isCover,
    storagePath: image.storagePath,
    uploadState: "uploaded",
  };
}

function normalizeDrafts(images: readonly ListingImageDraft[]) {
  return normalizeCoverAndOrder(images);
}

export function useListingImageUploadState(initialImages: readonly ExistingListingImageInput[] = []) {
  const [images, setImages] = useState<ListingImageDraft[]>(() =>
    normalizeDrafts(initialImages.map(toExistingDraft))
  );
  const [pendingDeletionPaths, setPendingDeletionPaths] = useState<string[]>([]);
  const imagesRef = useRef(images);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    const { acceptedFiles, issues } = validateListingImageSelection(fileArray, images.length);

    if (acceptedFiles.length === 0) {
      return issues;
    }

    const hasCover = images.some((image) => image.isCover);
    const baseSortOrder = images.length;

    const newDrafts: ListingImageDraft[] = acceptedFiles.map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      previewIsObjectUrl: true,
      sortOrder: baseSortOrder + index,
      isCover: !hasCover && index === 0,
      uploadState: "local",
    }));

    setImages((prev) => normalizeDrafts([...prev, ...newDrafts]));

    return issues;
  }, [images]);

  const setCoverImage = useCallback((imageId: string) => {
    setImages((prev) =>
      normalizeDrafts(
        prev.map((image) => ({
          ...image,
          isCover: image.id === imageId,
        }))
      )
    );
  }, []);

  const moveImage = useCallback((imageId: string, targetIndex: number) => {
    setImages((prev) => {
      const fromIndex = prev.findIndex((image) => image.id === imageId);
      if (fromIndex < 0) {
        return prev;
      }

      const clampedTarget = Math.max(0, Math.min(targetIndex, prev.length - 1));
      if (clampedTarget === fromIndex) {
        return prev;
      }

      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(clampedTarget, 0, moved);

      return normalizeDrafts(reordered);
    });
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((image) => image.id === imageId);
      if (!imageToRemove) {
        return prev;
      }

      if (imageToRemove.previewIsObjectUrl) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      if (imageToRemove.storagePath) {
        setPendingDeletionPaths((current) =>
          current.includes(imageToRemove.storagePath as string)
            ? current
            : [...current, imageToRemove.storagePath as string]
        );
      }

      return normalizeDrafts(prev.filter((image) => image.id !== imageId));
    });
  }, []);

  const markUploading = useCallback((imageId: string) => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === imageId
          ? {
              ...image,
              uploadState: "uploading",
              error: undefined,
            }
          : image
      )
    );
  }, []);

  const markUploaded = useCallback((imageId: string, storagePath: string) => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === imageId
          ? {
              ...image,
              uploadState: "uploaded",
              storagePath,
              error: undefined,
            }
          : image
      )
    );
  }, []);

  const markUploadFailed = useCallback((imageId: string, errorMessage: string) => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === imageId
          ? {
              ...image,
              uploadState: "failed",
              error: errorMessage,
            }
          : image
      )
    );
  }, []);

  const consumePendingDeletionPaths = useCallback(() => {
    const paths = [...pendingDeletionPaths];
    setPendingDeletionPaths([]);
    return paths;
  }, [pendingDeletionPaths]);

  const clearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach((image) => {
        if (image.previewIsObjectUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });

      return [];
    });
    setPendingDeletionPaths([]);
  }, []);

  const replaceImages = useCallback((nextImages: readonly ExistingListingImageInput[]) => {
    setImages((prev) => {
      prev.forEach((image) => {
        if (image.previewIsObjectUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });

      return normalizeDrafts(nextImages.map(toExistingDraft));
    });
    setPendingDeletionPaths([]);
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        if (image.previewIsObjectUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, []);

  const coverImage = useMemo(
    () => images.find((image) => image.isCover) ?? null,
    [images]
  );

  const hasPendingUploads = useMemo(
    () => images.some((image) => image.uploadState === "local" || image.uploadState === "uploading"),
    [images]
  );

  return {
    images,
    coverImage,
    pendingDeletionPaths,
    hasPendingUploads,
    addFiles,
    setCoverImage,
    moveImage,
    removeImage,
    markUploading,
    markUploaded,
    markUploadFailed,
    consumePendingDeletionPaths,
    replaceImages,
    clearAll,
  };
}

export type ListingImageUploadStateHook = ReturnType<typeof useListingImageUploadState>;
export type ListingImageSelectionIssue = ListingImageValidationIssue;
