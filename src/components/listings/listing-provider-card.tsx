import Image from "next/image";
import { ShieldCheck, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicListingDetailProvider } from "@/lib/listings/public-listing-detail";

type ListingProviderCardProps = {
  provider: PublicListingDetailProvider | null;
  isOwner: boolean;
};

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return "NP";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatContactPreference(
  method: PublicListingDetailProvider["preferredContactMethod"]
) {
  if (!method) {
    return "Contact method shared after opening a conversation.";
  }

  if (method === "in_app") {
    return "Prefers in-app messages.";
  }

  if (method === "phone") {
    return "Prefers phone follow-up.";
  }

  return "Prefers email follow-up.";
}

export function ListingProviderCard({
  provider,
  isOwner,
}: ListingProviderCardProps) {
  const displayName = provider?.displayName ?? "NestMap Provider";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Provider</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex items-start gap-3">
          <div className="border-border/70 bg-muted/35 relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border">
            {provider?.avatarUrl ? (
              <Image
                src={provider.avatarUrl}
                alt={`Avatar for ${displayName}`}
                fill
                unoptimized
                sizes="44px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold tracking-tight">
                {toInitials(displayName)}
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold tracking-tight">{displayName}</p>
            <p className="text-muted-foreground text-xs">
              {provider
                ? "Registered provider account on NestMap."
                : "Provider profile details are privacy-limited on this public page."}
            </p>
          </div>
        </div>

        {provider?.bio ? (
          <p className="text-sm leading-6">{provider.bio}</p>
        ) : (
          <p className="text-muted-foreground text-sm leading-6">
            Property details and message context are shared directly by the provider.
          </p>
        )}

        <div className="border-border/70 bg-background/50 rounded-lg border px-3 py-2 text-xs">
          <p className="inline-flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {isOwner
              ? "You are viewing your own published listing."
              : "Provider identity checks continue in the contact flow."}
          </p>
          <p className="text-muted-foreground mt-1">
            {formatContactPreference(provider?.preferredContactMethod ?? null)}
          </p>
        </div>

        {!provider ? (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <UserRound className="size-3.5" aria-hidden="true" />
            Public profile expansion is planned in later trust-layer PTs.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
