import { MainContainer } from "@/components/layout/main-container";
import { PageLoadingSkeleton } from "@/components/layout/page-shell";

export default function AdminModerationLoading() {
  return (
    <MainContainer size="wide">
      <PageLoadingSkeleton summaryCount={3} sectionCount={2} />
    </MainContainer>
  );
}
