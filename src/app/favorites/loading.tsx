import { MainContainer } from "@/components/layout/main-container";

export default function FavoritesLoading() {
  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/55 space-y-3 rounded-xl border p-5 sm:p-6">
        <div className="bg-muted/45 h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted/45 h-8 w-[min(640px,100%)] animate-pulse rounded" />
        <div className="bg-muted/40 h-4 w-[min(480px,100%)] animate-pulse rounded" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <section
            key={`favorites-loading-${index}`}
            className="border-border/75 bg-card/55 space-y-3 overflow-hidden rounded-xl border p-0"
          >
            <div className="bg-muted/35 aspect-[16/10] animate-pulse" />
            <div className="space-y-2 px-4 pb-4">
              <div className="bg-muted/45 mt-3 h-4 w-44 animate-pulse rounded" />
              <div className="bg-muted/42 h-4 w-32 animate-pulse rounded" />
              <div className="bg-muted/40 h-4 w-full animate-pulse rounded" />
            </div>
          </section>
        ))}
      </div>
    </MainContainer>
  );
}
