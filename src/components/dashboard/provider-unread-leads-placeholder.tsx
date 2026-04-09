import Link from "next/link";
import { MailPlus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProviderUnreadLeadsPlaceholder() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="text-muted-foreground inline-flex items-center gap-2 text-xs uppercase tracking-wide">
          <MailPlus className="size-3.5" aria-hidden="true" />
          Messaging integration
        </div>
        <CardTitle>Unread lead count is live and inbox UI is now available.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm leading-6">
          Conversation list, thread history, and message composer now run through the protected listing-bound
          messaging flow. Realtime updates still land in the next PT.
        </p>
        <Link
          href="/messages"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          Open inbox
        </Link>
      </CardContent>
    </Card>
  );
}
