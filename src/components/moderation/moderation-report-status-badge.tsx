import { Badge } from "@/components/ui/badge";
import { getListingReportStatusLabel } from "@/lib/moderation/reporting";
import type { ListingReportStatus } from "@/lib/moderation/types";

type ModerationReportStatusBadgeProps = {
  status: ListingReportStatus;
};

function getStatusVariant(status: ListingReportStatus) {
  switch (status) {
    case "open":
      return "warning" as const;
    case "under_review":
      return "primary" as const;
    case "resolved":
      return "success" as const;
    case "dismissed":
    default:
      return "neutral" as const;
  }
}

export function ModerationReportStatusBadge({ status }: ModerationReportStatusBadgeProps) {
  return <Badge variant={getStatusVariant(status)}>{getListingReportStatusLabel(status)}</Badge>;
}
