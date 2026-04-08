import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  buildExploreHref,
  type ExploreSearchState,
} from "@/lib/listings/explore-search-params";
import { cn } from "@/lib/utils";

type ExplorePaginationProps = {
  state: ExploreSearchState;
  totalPages: number;
};

function buildPageSlots(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const slots: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    slots.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    slots.push(page);
  }

  if (end < totalPages - 1) {
    slots.push("ellipsis");
  }

  slots.push(totalPages);

  return slots;
}

export function ExplorePagination({ state, totalPages }: ExplorePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(state.page, 1), totalPages);
  const pageSlots = buildPageSlots(safeCurrentPage, totalPages);
  const previousPage = safeCurrentPage - 1;
  const nextPage = safeCurrentPage + 1;

  return (
    <nav
      aria-label="Explore pagination"
      className="border-border/75 bg-card/55 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
    >
      <Link
        href={buildExploreHref({
          ...state,
          page: previousPage,
        })}
        aria-disabled={safeCurrentPage <= 1}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          safeCurrentPage <= 1 && "pointer-events-none opacity-50"
        )}
      >
        Previous
      </Link>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {pageSlots.map((slot, index) => {
          if (slot === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="text-muted-foreground px-1 text-sm">
                ...
              </span>
            );
          }

          const isActivePage = slot === safeCurrentPage;

          return (
            <Link
              key={`page-${slot}`}
              href={buildExploreHref({
                ...state,
                page: slot,
              })}
              aria-current={isActivePage ? "page" : undefined}
              className={cn(
                buttonVariants({ size: "sm", variant: isActivePage ? "default" : "ghost" }),
                "min-w-8 px-2.5"
              )}
            >
              {slot}
            </Link>
          );
        })}
      </div>

      <Link
        href={buildExploreHref({
          ...state,
          page: nextPage,
        })}
        aria-disabled={safeCurrentPage >= totalPages}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          safeCurrentPage >= totalPages && "pointer-events-none opacity-50"
        )}
      >
        Next
      </Link>
    </nav>
  );
}

