import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  children: ReactNode;
  className?: string;
};

type FieldTextProps = {
  children: ReactNode;
  className?: string;
};

export function Field({ children, className }: FieldProps) {
  return <div className={cn("space-y-2.5", className)}>{children}</div>;
}

export function FieldHelp({ children, className }: FieldTextProps) {
  return <p className={cn("text-muted-foreground text-xs leading-5", className)}>{children}</p>;
}

export function FieldError({ children, className }: FieldTextProps) {
  return (
    <p className={cn("text-destructive text-xs leading-5 font-medium", className)} role="alert">
      {children}
    </p>
  );
}
