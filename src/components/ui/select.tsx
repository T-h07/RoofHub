import * as React from "react";

import { cn } from "@/lib/utils";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input bg-background/70 h-10 w-full min-w-0 rounded-lg border px-3 text-sm transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-3",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/35 aria-invalid:ring-3",
        className
      )}
      {...props}
    />
  );
}

export { Select };
