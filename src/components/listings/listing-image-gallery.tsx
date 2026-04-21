"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { PublicListingDetailImage } from "@/lib/listings/public-listing-detail";
import { cn } from "@/lib/utils";

type ListingImageGalleryProps = {
  title: string;
  images: PublicListingDetailImage[];
};

export function ListingImageGallery({ title, images }: ListingImageGalleryProps) {
  const orderedImages = useMemo(() => {
    return [...images].sort((left, right) => {
      if (left.isCover === right.isCover) {
        return left.sortOrder - right.sortOrder;
      }

      return left.isCover ? -1 : 1;
    });
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex =
    orderedImages.length > 0
      ? Math.min(activeIndex, orderedImages.length - 1)
      : 0;
  const activeImage = orderedImages[safeActiveIndex] ?? null;

  function goToPreviousImage() {
    if (orderedImages.length <= 1) {
      return;
    }

    setActiveIndex((currentIndex) => {
      if (currentIndex === 0) {
        return orderedImages.length - 1;
      }

      return currentIndex - 1;
    });
  }

  function goToNextImage() {
    if (orderedImages.length <= 1) {
      return;
    }

    setActiveIndex((currentIndex) => {
      if (currentIndex >= orderedImages.length - 1) {
        return 0;
      }

      return currentIndex + 1;
    });
  }

  return (
    <section className="space-y-3">
      <div className="border-border/75 bg-card/58 relative overflow-hidden rounded-2xl border">
        <div className="relative aspect-[16/11] w-full sm:aspect-[16/10] lg:aspect-[21/10]">
          {activeImage?.signedUrl ? (
            <Image
              src={activeImage.signedUrl}
              alt={`Listing image ${activeIndex + 1} for ${title}`}
              fill
              sizes="(min-width: 1280px) 68vw, (min-width: 1024px) 62vw, 100vw"
              className="h-full w-full object-cover"
              priority
            />
          ) : (
            <div className="bg-muted/45 flex h-full w-full items-center justify-center">
              <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                <ImageOff className="size-4" aria-hidden="true" />
                Image unavailable
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/48 via-black/8 to-transparent" />

          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-black/36 px-2.5 py-1 text-[11px] font-medium text-white">
            <Camera className="size-3.5" aria-hidden="true" />
            {orderedImages.length === 0
              ? "No photos"
              : `${safeActiveIndex + 1} / ${orderedImages.length}`}
          </div>

          {orderedImages.length > 1 ? (
            <>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "absolute top-1/2 left-3 size-8 -translate-y-1/2 border-white/22 bg-black/42 text-white hover:bg-black/60"
                )}
                onClick={goToPreviousImage}
                aria-label="Show previous listing image"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "absolute top-1/2 right-3 size-8 -translate-y-1/2 border-white/22 bg-black/42 text-white hover:bg-black/60"
                )}
                onClick={goToNextImage}
                aria-label="Show next listing image"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {orderedImages.length > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {orderedImages.map((image, index) => {
            const isActive = index === safeActiveIndex;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "border-border/70 bg-card/55 relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition-all focus-visible:outline-none",
                  "focus-visible:ring-ring/60 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
                  isActive ? "ring-primary/65 ring-2" : "hover:border-primary/40"
                )}
                aria-label={`Show listing image ${index + 1}`}
              >
                {image.signedUrl ? (
                  <Image
                    src={image.signedUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="bg-muted/45 flex h-full w-full items-center justify-center">
                    <ImageOff className="text-muted-foreground size-3.5" aria-hidden="true" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
