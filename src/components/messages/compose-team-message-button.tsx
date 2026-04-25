"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInternalCompanyConversationAction } from "@/lib/messaging/actions";
import type { MessagingAssignableCompanyMember } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

type ComposeTeamMessageButtonProps = {
  className?: string;
  members: MessagingAssignableCompanyMember[];
};

export function ComposeTeamMessageButton({ className, members }: ComposeTeamMessageButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [directMemberUserId, setDirectMemberUserId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberUserIds, setGroupMemberUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetState() {
    setKind("direct");
    setDirectMemberUserId("");
    setGroupTitle("");
    setGroupMemberUserIds([]);
    setErrorMessage(null);
  }

  async function handleCreateConversation() {
    setErrorMessage(null);

    if (kind === "direct" && !directMemberUserId) {
      setErrorMessage("Choose one teammate to start a direct conversation.");
      return;
    }

    if (kind === "group") {
      if (groupTitle.trim().length < 2 || groupTitle.trim().length > 120) {
        setErrorMessage("Group title must be between 2 and 120 characters.");
        return;
      }

      if (groupMemberUserIds.length < 2) {
        setErrorMessage("Select at least two teammates for a group conversation.");
        return;
      }
    }

    setIsSubmitting(true);

    const result = await createInternalCompanyConversationAction({
      kind,
      participantUserIds: kind === "direct" ? [directMemberUserId] : groupMemberUserIds,
      title: kind === "group" ? groupTitle.trim() : undefined,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    const nextConversationId = result.data.conversation.id;
    setIsOpen(false);
    resetState();
    router.push(`/messages?section=in_company&conversationId=${nextConversationId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 text-xs", className)}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        New message
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            resetState();
          }
        }}
      >
        <DialogContent className="w-[min(92vw,38rem)]">
          <DialogHeader>
            <DialogTitle>New team conversation</DialogTitle>
            <DialogDescription>
              Choose a teammate for a direct message or create a group conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-border/70 bg-card/55 inline-flex gap-1 rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setKind("direct")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  kind === "direct"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                )}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setKind("group")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  kind === "group"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                )}
              >
                Group
              </button>
            </div>

            {kind === "direct" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Select teammate</p>
                <Select
                  value={directMemberUserId}
                  onChange={(event) => setDirectMemberUserId(event.currentTarget.value)}
                  className="h-10"
                >
                  <option value="">Choose one teammate</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName} • {member.role}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Group title</p>
                  <Input
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.currentTarget.value)}
                    maxLength={120}
                    placeholder="e.g. Downtown inventory review"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    Select teammates ({groupMemberUserIds.length} selected)
                  </p>
                  <div className="border-border/70 bg-card/55 max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {members.map((member) => {
                      const isSelected = groupMemberUserIds.includes(member.userId);

                      return (
                        <label
                          key={member.userId}
                          className={cn(
                            "hover:bg-accent/60 flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-sm",
                            isSelected ? "bg-primary/10" : ""
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{member.displayName}</span>
                            <span className="text-muted-foreground text-xs">{member.role}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setGroupMemberUserIds((current) =>
                                current.includes(member.userId)
                                  ? current.filter((userId) => userId !== member.userId)
                                  : [...current, member.userId]
                              );
                            }}
                            className="size-4"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetState();
              }}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateConversation()}
              disabled={isSubmitting}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Create conversation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
