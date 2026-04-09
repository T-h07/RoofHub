import Image from "next/image";
import {
  Mail,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicListingDetailProvider } from "@/lib/listings/public-listing-detail";

type ListingProviderCardProps = {
  provider: PublicListingDetailProvider | null;
  isOwner: boolean;
};

type ContactMethod = NonNullable<PublicListingDetailProvider["preferredContactMethod"]>;

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

  if (method === "whatsapp") {
    return "Prefers WhatsApp follow-up.";
  }

  if (method === "viber") {
    return "Prefers Viber follow-up.";
  }

  return "Prefers email follow-up.";
}

function formatContactMethodLabel(method: ContactMethod) {
  if (method === "in_app") {
    return "In-app message";
  }

  if (method === "phone") {
    return "Phone";
  }

  if (method === "whatsapp") {
    return "WhatsApp";
  }

  if (method === "viber") {
    return "Viber";
  }

  return "Email";
}

function getContactMethodValue(
  provider: PublicListingDetailProvider,
  method: ContactMethod
) {
  if (method === "in_app") {
    return "Use Contact provider to start a protected in-app conversation.";
  }

  if (method === "phone") {
    return provider.phone ?? "Shared after opening a conversation.";
  }

  if (method === "email") {
    return provider.contactEmail ?? "Shared after opening a conversation.";
  }

  if (method === "whatsapp") {
    return (
      provider.whatsappPhone ??
      provider.phone ??
      "Shared after opening a conversation."
    );
  }

  return (
    provider.viberPhone ??
    provider.phone ??
    "Shared after opening a conversation."
  );
}

function getContactMethodIcon(method: ContactMethod) {
  if (method === "in_app") {
    return MessageCircle;
  }

  if (method === "phone") {
    return PhoneCall;
  }

  if (method === "email") {
    return Mail;
  }

  return MessageSquareText;
}

export function ListingProviderCard({
  provider,
  isOwner,
}: ListingProviderCardProps) {
  const displayName = provider?.displayName ?? "NestMap Provider";
  const resolvedContactMethods: ContactMethod[] = provider
    ? provider.contactMethods.length > 0
      ? provider.contactMethods
      : provider.preferredContactMethod
        ? [provider.preferredContactMethod]
        : ["in_app"]
    : [];
  const primaryContactMethod = provider?.preferredContactMethod ?? resolvedContactMethods[0] ?? null;

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
            {formatContactPreference(primaryContactMethod)}
          </p>
        </div>

        {provider ? (
          <div className="border-border/70 bg-background/45 rounded-lg border px-3 py-2.5">
            <p className="text-xs font-medium tracking-tight">
              Available contact methods
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {resolvedContactMethods.map((method) => {
                const isPrimary =
                  provider.preferredContactMethod === method ||
                  (!provider.preferredContactMethod &&
                    resolvedContactMethods[0] === method);

                return (
                  <span
                    key={`provider-contact-method-${method}`}
                    className="border-border/70 bg-background/55 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight"
                  >
                    {formatContactMethodLabel(method)}
                    {isPrimary ? (
                      <span className="bg-accent/20 text-accent-foreground rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]">
                        Primary
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>

            <div className="mt-2.5 space-y-2">
              {resolvedContactMethods.map((method) => {
                const MethodIcon = getContactMethodIcon(method);

                return (
                  <div
                    key={`provider-contact-channel-${method}`}
                    className="text-muted-foreground flex items-start gap-2.5 text-xs leading-5"
                  >
                    <MethodIcon
                      className="text-foreground/75 mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5">
                      <p className="text-foreground/90 font-medium tracking-tight">
                        {formatContactMethodLabel(method)}
                      </p>
                      <p>{getContactMethodValue(provider, method)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
