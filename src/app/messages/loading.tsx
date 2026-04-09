import { MainContainer } from "@/components/layout/main-container";

export default function MessagesLoading() {
  return (
    <MainContainer size="wide" className="space-y-4">
      <section className="border-border/75 bg-card/58 animate-pulse space-y-3 rounded-xl border p-5 sm:p-6">
        <div className="bg-muted/50 h-5 w-28 rounded-full" />
        <div className="bg-muted/50 h-8 w-3/4 rounded-md" />
        <div className="bg-muted/45 h-5 w-2/3 rounded-md" />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`messages-loading-conversation-${index}`}
              className="border-border/70 bg-card/52 animate-pulse space-y-2 rounded-xl border px-3.5 py-3"
            >
              <div className="bg-muted/50 h-4 w-3/4 rounded" />
              <div className="bg-muted/45 h-3 w-1/2 rounded" />
              <div className="bg-muted/45 h-3 w-5/6 rounded" />
            </div>
          ))}
        </div>

        <div className="border-border/70 bg-card/52 animate-pulse rounded-xl border p-4 sm:p-5">
          <div className="space-y-2">
            <div className="bg-muted/50 h-5 w-2/5 rounded" />
            <div className="bg-muted/45 h-4 w-4/5 rounded" />
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`messages-loading-bubble-${index}`} className="space-y-1.5">
                <div className="bg-muted/45 h-4 w-3/4 rounded" />
                <div className="bg-muted/45 h-3 w-1/6 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </MainContainer>
  );
}
