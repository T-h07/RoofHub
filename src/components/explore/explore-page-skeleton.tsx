import { MainContainer } from "@/components/layout/main-container";

function ListingSkeletonCard() {
  return (
    <div className="border-border/70 bg-card/60 animate-pulse overflow-hidden rounded-xl border">
      <div className="bg-muted/45 h-44 w-full" />
      <div className="space-y-3 p-4">
        <div className="bg-muted/50 h-3 w-28 rounded" />
        <div className="bg-muted/45 h-5 w-5/6 rounded" />
        <div className="bg-muted/40 h-5 w-3/5 rounded" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-muted/45 h-8 rounded-md" />
          <div className="bg-muted/45 h-8 rounded-md" />
          <div className="bg-muted/45 h-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ExplorePageSkeleton() {
  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/55 space-y-3 rounded-xl border p-5">
        <div className="bg-muted/45 h-3 w-24 animate-pulse rounded" />
        <div className="bg-muted/45 h-8 w-[min(560px,100%)] animate-pulse rounded" />
        <div className="bg-muted/40 h-4 w-[min(720px,100%)] animate-pulse rounded" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="border-border/70 bg-card/60 space-y-3 rounded-xl border p-4">
            <div className="bg-muted/50 h-4 w-24 animate-pulse rounded" />
            <div className="bg-muted/45 h-10 animate-pulse rounded-lg" />
            <div className="bg-muted/45 h-10 animate-pulse rounded-lg" />
            <div className="bg-muted/45 h-10 animate-pulse rounded-lg" />
            <div className="bg-muted/45 h-8 animate-pulse rounded-lg" />
          </div>
        </aside>

        <section className="space-y-4">
          <div className="border-border/70 bg-card/55 flex items-center justify-between rounded-xl border p-4">
            <div className="space-y-2">
              <div className="bg-muted/45 h-4 w-40 animate-pulse rounded" />
              <div className="bg-muted/40 h-3 w-56 animate-pulse rounded" />
            </div>
            <div className="bg-muted/45 h-10 w-48 animate-pulse rounded-lg" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <ListingSkeletonCard key={`listing-skeleton-${index}`} />
            ))}
          </div>
        </section>
      </div>
    </MainContainer>
  );
}

