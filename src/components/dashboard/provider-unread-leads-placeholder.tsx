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
          Messaging handoff
        </div>
        <CardTitle>Thread UI and realtime delivery land in the next messaging PTs.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm leading-6">
          Conversation and unread backend flows are now active. This space stays focused on the next layer:
          inbox composition, thread UX, and realtime message delivery states.
        </p>
        <Link
          href="/messages"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          Open messages scaffold
        </Link>
      </CardContent>
    </Card>
  );
}
