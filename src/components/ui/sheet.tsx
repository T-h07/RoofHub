"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Sheet = DrawerPrimitive.Root;
const SheetTrigger = DrawerPrimitive.Trigger;
const SheetClose = DrawerPrimitive.Close;
const SheetPortal = DrawerPrimitive.Portal;
const SheetTitle = DrawerPrimitive.Title;
const SheetDescription = DrawerPrimitive.Description;

function SheetOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]", className)}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 border-border bg-popover text-popover-foreground shadow-2xl outline-none",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b p-5",
        bottom: "inset-x-0 bottom-0 border-t p-5",
        left: "inset-y-0 left-0 h-full w-[88vw] max-w-sm border-r p-5",
        right: "inset-y-0 right-0 h-full w-[88vw] max-w-sm border-l p-5",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

type SheetContentProps = DrawerPrimitive.Popup.Props &
  VariantProps<typeof sheetVariants> & {
    showClose?: boolean;
  };

function SheetContent({
  className,
  side = "right",
  showClose = true,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Popup className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showClose && (
          <SheetClose className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </DrawerPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-1.5 pr-8", className)} {...props} />;
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
