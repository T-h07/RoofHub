"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn("fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]", className)}
      {...props}
    />
  );
}

type DialogContentProps = DialogPrimitive.Popup.Props & {
  showClose?: boolean;
};

function DialogContent({ className, children, showClose = true, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        className={cn(
          "border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-2xl outline-none",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogClose className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
