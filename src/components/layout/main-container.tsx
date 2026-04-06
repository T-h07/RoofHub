import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      default: "max-w-6xl",
      wide: "max-w-7xl",
      content: "max-w-5xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type MainContainerProps = {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof containerVariants>;

export function MainContainer({ children, className, size }: MainContainerProps) {
  return <div className={cn(containerVariants({ size }), className)}>{children}</div>;
}
