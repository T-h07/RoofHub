import { MainContainer } from "@/components/layout/main-container";

export function MapPageSkeleton() {
  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/55 space-y-3 rounded-xl border p-5">
        <div className="bg-muted/45 h-3 w-20 animate-pulse rounded" />
        <div className="bg-muted/45 h-8 w-[min(560px,100%)] animate-pulse rounded" />
        <div className="bg-muted/40 h-4 w-[min(720px,100%)] animate-pulse rounded" />
      </section>

      <section className="border-border/75 bg-card/55 rounded-xl border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="bg-muted/45 h-4 w-40 animate-pulse rounded" />
            <div className="bg-muted/40 h-3 w-56 animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="bg-muted/45 h-8 w-28 animate-pulse rounded-md" />
            <div className="bg-muted/45 h-8 w-32 animate-pulse rounded-md" />
          </div>
        </div>
      </section>

      <section className="border-border/75 bg-card/45 relative h-[68dvh] min-h-[26rem] overflow-hidden rounded-2xl border">
        <div className="bg-muted/30 absolute inset-0 animate-pulse" />
        <div className="absolute top-4 right-4 space-y-2">
          <div className="bg-muted/45 h-8 w-8 rounded-md" />
          <div className="bg-muted/45 h-8 w-8 rounded-md" />
        </div>
        <div className="bg-nav-background/72 text-nav-foreground/90 border-nav-foreground/24 absolute bottom-4 left-4 rounded-md border px-3 py-1.5 text-xs">
          Loading map and markers...
        </div>
      </section>
    </MainContainer>
  );
}
