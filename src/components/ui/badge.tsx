import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center justify-center rounded-full border px-2.5 text-[0.7rem] font-semibold tracking-wide uppercase transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-soft text-muted-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/16 text-warning",
        destructive: "border-transparent bg-destructive/14 text-destructive",
        outline: "border-input bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

function Badge({
  className,
  variant,
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
