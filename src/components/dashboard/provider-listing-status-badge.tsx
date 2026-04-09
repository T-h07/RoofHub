import { Badge } from "@/components/ui/badge";
import { formatProviderListingStatus } from "@/lib/listings/provider-dashboard/status";
import type { ProviderListingStatus } from "@/lib/listings/provider-dashboard/types";

type ProviderListingStatusBadgeProps = {
  status: ProviderListingStatus;
};

function getStatusVariant(status: ProviderListingStatus) {
  switch (status) {
    case "published":
      return "success" as const;
    case "draft":
    case "paused":
      return "warning" as const;
    case "sold":
    case "rented":
      return "primary" as const;
    case "archived":
    default:
      return "neutral" as const;
  }
}

export function ProviderListingStatusBadge({ status }: ProviderListingStatusBadgeProps) {
  return <Badge variant={getStatusVariant(status)}>{formatProviderListingStatus(status)}</Badge>;
}
