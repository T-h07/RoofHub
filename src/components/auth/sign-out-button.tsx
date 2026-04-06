"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  compact?: boolean;
  className?: string;
};

export function SignOutButton({ compact = false, className }: SignOutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={compact ? "ghost" : "outline"}
      size={compact ? "sm" : "default"}
      disabled={pending}
      className={cn(compact ? "text-muted-foreground hover:text-foreground" : "", className)}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
