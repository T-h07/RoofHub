import { MainContainer } from "@/components/layout/main-container";

export function ListingDetailPageSkeleton() {
  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/55 space-y-3 rounded-2xl border p-5 sm:p-6">
        <div className="bg-muted/45 h-4 w-28 animate-pulse rounded" />
        <div className="bg-muted/45 h-8 w-[min(680px,100%)] animate-pulse rounded" />
        <div className="bg-muted/42 h-6 w-44 animate-pulse rounded" />
        <div className="bg-muted/40 h-4 w-[min(360px,100%)] animate-pulse rounded" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="space-y-4 xl:sticky xl:top-[5.5rem] xl:self-start">
          <div className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4">
            <div className="bg-muted/45 h-5 w-28 animate-pulse rounded" />
            <div className="bg-muted/45 h-9 w-full animate-pulse rounded-lg" />
            <div className="bg-muted/45 h-9 w-full animate-pulse rounded-lg" />
            <div className="bg-muted/40 h-14 animate-pulse rounded-lg" />
          </div>
          <div className="border-border/75 bg-card/58 space-y-2 rounded-xl border p-4">
            <div className="bg-muted/45 h-5 w-24 animate-pulse rounded" />
            <div className="bg-muted/40 h-12 animate-pulse rounded" />
          </div>
        </aside>

        <div className="space-y-6">
          <section className="border-border/75 bg-card/55 overflow-hidden rounded-xl border">
            <div className="bg-muted/35 aspect-[16/10] animate-pulse" />
            <div className="flex gap-2 px-3 py-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={`detail-thumb-${index}`} className="bg-muted/42 h-16 w-24 animate-pulse rounded-lg" />
              ))}
            </div>
          </section>

          <section className="border-border/75 bg-card/55 space-y-3 rounded-xl border p-4">
            <div className="bg-muted/45 h-5 w-36 animate-pulse rounded" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={`detail-fact-${index}`} className="bg-muted/40 h-14 animate-pulse rounded-lg" />
              ))}
            </div>
          </section>

          <section className="border-border/75 bg-card/55 space-y-3 rounded-xl border p-4">
            <div className="bg-muted/45 h-5 w-44 animate-pulse rounded" />
            <div className="bg-muted/40 h-4 w-full animate-pulse rounded" />
            <div className="bg-muted/40 h-4 w-[96%] animate-pulse rounded" />
            <div className="bg-muted/40 h-4 w-[78%] animate-pulse rounded" />
          </section>

          <section className="border-border/75 bg-card/55 h-72 animate-pulse rounded-xl border" />
        </div>
      </div>
    </MainContainer>
  );
}
