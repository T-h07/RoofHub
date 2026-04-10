import Link from "next/link";
import { Orbit } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { buildGoogleOAuthStartPath, type OAuthIntent } from "@/lib/auth/oauth";
import { cn } from "@/lib/utils";

type GoogleAuthButtonProps = {
  nextPath: string;
  intent: OAuthIntent;
  className?: string;
};

export function GoogleAuthButton({ nextPath, intent, className }: GoogleAuthButtonProps) {
  const href = buildGoogleOAuthStartPath({
    nextPath,
    intent,
  });

  const label = intent === "sign_up" ? "Continue with Google" : "Sign in with Google";

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "bg-background/72 hover:bg-secondary/72 h-10 w-full justify-center gap-2.5 text-sm font-semibold",
        className
      )}
    >
      <span className="bg-card inline-flex size-6 items-center justify-center rounded-full border">
        <Orbit className="size-3.5" />
      </span>
      {label}
    </Link>
  );
}
