import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background/70 min-h-24 w-full rounded-lg border px-3 py-2.5 text-sm transition-all outline-none",
        "placeholder:text-muted-foreground/90",
        "focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-3",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/35 aria-invalid:ring-3",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
