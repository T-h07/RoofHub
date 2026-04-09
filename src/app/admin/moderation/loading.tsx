import { MainContainer } from "@/components/layout/main-container";

export default function AdminModerationLoading() {
  return (
    <MainContainer size="wide" className="space-y-4">
      <section className="border-border/75 bg-card/58 animate-pulse space-y-3 rounded-xl border p-5 sm:p-6">
        <div className="bg-muted/50 h-5 w-32 rounded-full" />
        <div className="bg-muted/50 h-8 w-3/4 rounded-md" />
        <div className="bg-muted/45 h-5 w-2/3 rounded-md" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`moderation-metrics-loading-${index}`}
            className="border-border/70 bg-card/52 animate-pulse space-y-2 rounded-xl border p-4"
          >
            <div className="bg-muted/45 h-3.5 w-2/5 rounded" />
            <div className="bg-muted/50 h-8 w-1/3 rounded" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`moderation-item-loading-${index}`}
            className="border-border/70 bg-card/52 animate-pulse space-y-3 rounded-xl border p-4"
          >
            <div className="bg-muted/50 h-4 w-2/5 rounded" />
            <div className="bg-muted/45 h-3 w-3/5 rounded" />
            <div className="bg-muted/45 h-12 w-full rounded" />
          </div>
        ))}
      </section>
    </MainContainer>
  );
}
