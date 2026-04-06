"use client";

import { toast } from "sonner";
import { BellRing, Compass, Plus, Search, Send, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/ui/section";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const statusBadges = [
  { label: "For rent", variant: "success" as const },
  { label: "For sale", variant: "primary" as const },
  { label: "Featured", variant: "warning" as const },
  { label: "Draft", variant: "neutral" as const },
];

export function ShellPreview() {
  return (
    <Section
      eyebrow="Design primitives"
      title="Reusable UI components ready for feature PTs"
      description="These surfaces validate the global system for cards, forms, overlays, and feedback without implementing business workflows yet."
    >
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <Badge variant="neutral">Card + badges</Badge>
              <CardTitle>Listing surface baseline</CardTitle>
              <CardDescription>
                Structured for future listing cards, dashboard summaries, and detail panes.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {statusBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-border/70 bg-muted/20 rounded-lg border px-3.5 py-3">
                <p className="type-label">Card title usage</p>
                <p className="text-foreground mt-2 text-sm font-semibold">City center apartment</p>
                <p className="text-muted-foreground mt-1 text-xs">3 beds • 2 baths • 91 m²</p>
              </div>
              <div className="border-border/70 bg-muted/20 rounded-lg border px-3.5 py-3">
                <p className="type-label">Caption usage</p>
                <p className="text-foreground mt-2 text-sm font-semibold">Map-card consistency</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Shared typography and spacing for map/list parity.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              <Search className="size-4" />
              Preview search shell
            </Button>
            <Button size="sm">
              <Plus className="size-4" />
              Add listing draft
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-2">
              <Badge variant="neutral">Fields + empty state</Badge>
              <CardTitle>Form and state foundations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <Label htmlFor="pt02-city">Preferred city</Label>
              <Input id="pt02-city" placeholder="Berlin, Munich, Hamburg..." />
              <FieldHelp>Reusable pattern for filter/search inputs.</FieldHelp>
            </Field>
            <Field>
              <Label htmlFor="pt02-note">Notes</Label>
              <Textarea id="pt02-note" placeholder="Describe priorities for this route surface." />
              <FieldError>Validation styles are wired for future form workflows.</FieldError>
            </Field>

            <EmptyState
              icon={Compass}
              title="Map selection empty state"
              description="Reusable empty-state pattern for list, map, and dashboard surfaces."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Dialog>
          <DialogTrigger
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
          >
            <SlidersHorizontal className="size-4" />
            Open modal base
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg">Modal baseline</DialogTitle>
              <DialogDescription className="type-body-muted">
                Use this for focused confirmation and short edit flows in future PTs.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose className={buttonVariants({ variant: "outline", size: "sm" })}>
                Cancel
              </DialogClose>
              <Button size="sm">Apply filters</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
          >
            <BellRing className="size-4" />
            Open sheet base
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle className="text-lg">Notification drawer baseline</SheetTitle>
              <SheetDescription className="type-body-muted">
                Prepared for messaging and activity surfaces in later PTs.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              <div className="border-border/70 bg-muted/20 text-muted-foreground rounded-lg border px-3.5 py-3 text-sm">
                New listing alerts and message previews will be rendered here.
              </div>
              <SheetClose className={cn(buttonVariants({ size: "sm" }), "w-full")}>
                Close drawer
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={() =>
            toast.success("Toast system wired", {
              description: "Use this for non-blocking feedback in future flows.",
              action: {
                label: "Undo",
                onClick: () => toast.info("Action rollback placeholder"),
              },
            })
          }
        >
          <Send className="size-4" />
          Trigger toast
        </Button>
      </div>
    </Section>
  );
}
