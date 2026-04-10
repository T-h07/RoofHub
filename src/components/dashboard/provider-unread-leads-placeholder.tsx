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
          Messaging
        </div>
        <CardTitle>Track incoming inquiries in one place.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm leading-6">
          View conversation threads, message history, and follow-ups from the inbox. Unread counts
          sync with your active listing conversations.
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
