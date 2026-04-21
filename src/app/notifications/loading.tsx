import { MainContainer } from "@/components/layout/main-container";
import { PageLoadingSkeleton } from "@/components/layout/page-shell";

export default function NotificationsLoading() {
  return (
    <MainContainer size="wide" className="space-y-6">
      <PageLoadingSkeleton summaryCount={2} sectionCount={1} />
    </MainContainer>
  );
}
