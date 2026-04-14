"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  UserRoundMinus,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createCompanyTeamInviteAction,
  removeCompanyTeamMemberAction,
  revokeCompanyTeamInviteAction,
  updateCompanyTeamMemberRoleAction,
  updateCompanyTeamMemberStatusAction,
} from "@/lib/company/team-actions";
import {
  COMPANY_TEAM_INVITE_IDLE_STATE,
  COMPANY_TEAM_MUTATION_IDLE_STATE,
  type CompanyInviteWithRelations,
  type CompanyTeamInviteMethod,
  type CompanyTeamMemberWithProfile,
  ORGANIZATION_MEMBER_ROLE_LABELS,
  ORGANIZATION_MEMBER_STATUS_LABELS,
} from "@/lib/company/team-types";
import { cn } from "@/lib/utils";

type CompanyTeamManagementProps = {
  viewerMembershipRole: "owner" | "admin";
  members: CompanyTeamMemberWithProfile[];
  pendingInvites: CompanyInviteWithRelations[];
};

type MemberStatusDialogState = {
  membershipId: string;
  memberName: string;
  nextStatus: "active" | "inactive";
};

type MemberRemovalDialogState = {
  membershipId: string;
  memberName: string;
};

type InviteRevocationDialogState = {
  inviteId: string;
  inviteTarget: string;
};

function toInitials(displayName: string) {
  const tokens = displayName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) {
    return "RH";
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleDateString();
}

function getMemberDisplayName(member: CompanyTeamMemberWithProfile) {
  return member.profile?.display_name?.trim() || `User ${member.user_id.slice(0, 8)}`;
}

function getInviteTargetLabel(invite: CompanyInviteWithRelations) {
  if (invite.targetProfile?.display_name) {
    return invite.targetProfile.display_name;
  }

  if (invite.invite_email) {
    return invite.invite_email;
  }

  if (invite.target_user_id) {
    return `User ${invite.target_user_id.slice(0, 8)}`;
  }

  return "Pending invite";
}

function getStatusBadgeVariant(status: CompanyTeamMemberWithProfile["member_status"]) {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "inactive") {
    return "warning" as const;
  }

  return "outline" as const;
}

function getRoleOptions(viewerMembershipRole: "owner" | "admin") {
  if (viewerMembershipRole === "owner") {
    return ["owner", "admin", "manager", "agent"] as const;
  }

  return ["manager", "agent"] as const;
}

export function CompanyTeamManagement({
  viewerMembershipRole,
  members,
  pendingInvites,
}: CompanyTeamManagementProps) {
  const router = useRouter();
  const [inviteMethod, setInviteMethod] = useState<CompanyTeamInviteMethod>("email");
  const [inviteState, inviteFormAction, isInvitePending] = useActionState(
    createCompanyTeamInviteAction,
    COMPANY_TEAM_INVITE_IDLE_STATE
  );
  const [isMutationPending, startMutation] = useTransition();
  const [memberStatusDialog, setMemberStatusDialog] = useState<MemberStatusDialogState | null>(null);
  const [memberRemovalDialog, setMemberRemovalDialog] = useState<MemberRemovalDialogState | null>(null);
  const [inviteRevocationDialog, setInviteRevocationDialog] =
    useState<InviteRevocationDialogState | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.member_status === "active"),
    [members]
  );
  const suspendedMembers = useMemo(
    () => members.filter((member) => member.member_status === "inactive"),
    [members]
  );
  const activeOwnerCount = useMemo(
    () => activeMembers.filter((member) => member.role === "owner").length,
    [activeMembers]
  );

  async function copyInviteLink(path: string) {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      toast.success("Invite link copied.");
    } catch {
      toast.error("Could not copy invite link.");
    }
  }

  function runMutationAction(
    action: (
      previousState: typeof COMPANY_TEAM_MUTATION_IDLE_STATE,
      formData: FormData
    ) => Promise<typeof COMPANY_TEAM_MUTATION_IDLE_STATE>,
    formData: FormData
  ) {
    startMutation(async () => {
      const result = await action(COMPANY_TEAM_MUTATION_IDLE_STATE, formData);

      if (result.status === "success") {
        toast.success(result.message ?? "Team workspace updated.");
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Team workspace update failed.");
    });
  }

  function onRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    runMutationAction(updateCompanyTeamMemberRoleAction, formData);
  }

  function confirmStatusChange() {
    if (!memberStatusDialog) {
      return;
    }

    const formData = new FormData();
    formData.set("membershipId", memberStatusDialog.membershipId);
    formData.set("nextStatus", memberStatusDialog.nextStatus);

    runMutationAction(updateCompanyTeamMemberStatusAction, formData);
    setMemberStatusDialog(null);
  }

  function confirmMemberRemoval() {
    if (!memberRemovalDialog) {
      return;
    }

    const formData = new FormData();
    formData.set("membershipId", memberRemovalDialog.membershipId);

    runMutationAction(removeCompanyTeamMemberAction, formData);
    setMemberRemovalDialog(null);
  }

  function confirmInviteRevocation() {
    if (!inviteRevocationDialog) {
      return;
    }

    const formData = new FormData();
    formData.set("inviteId", inviteRevocationDialog.inviteId);

    runMutationAction(revokeCompanyTeamInviteAction, formData);
    setInviteRevocationDialog(null);
  }

  const roleOptions = getRoleOptions(viewerMembershipRole);

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
          <p className="type-label">Invite staff</p>
          <h2 className="type-section-title">Add team members by email or RoofHub user ID</h2>
          <p className="type-body-muted">
            Owner and admin members can send secure invitations and assign workspace roles before
            acceptance.
          </p>
        </header>

        <div className="space-y-4">
          <div className="border-border/70 bg-surface-soft inline-flex rounded-xl border p-1">
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                inviteMethod === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setInviteMethod("email")}
            >
              Invite by email
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                inviteMethod === "userId"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setInviteMethod("userId")}
            >
              Invite by RoofHub user ID
            </button>
          </div>

          {inviteState.status === "error" && inviteState.message ? (
            <AuthStatusMessage tone="error" message={inviteState.message} />
          ) : null}
          {inviteState.status === "success" && inviteState.message ? (
            <AuthStatusMessage tone="success" message={inviteState.message} />
          ) : null}

          <form action={inviteFormAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <input type="hidden" name="inviteMethod" value={inviteMethod} />

            {inviteMethod === "email" ? (
              <Field className="lg:col-span-1">
                <Label htmlFor="invite-email">Team member email</Label>
                <Input
                  id="invite-email"
                  name="inviteEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="teammate@company.com"
                  aria-invalid={Boolean(inviteState.errors?.inviteEmail)}
                />
                {inviteState.errors?.inviteEmail ? (
                  <FieldError>{inviteState.errors.inviteEmail}</FieldError>
                ) : null}
                <FieldHelp>
                  Use the email the teammate signs into RoofHub with for direct acceptance matching.
                </FieldHelp>
              </Field>
            ) : (
              <Field className="lg:col-span-1">
                <Label htmlFor="invite-user-id">RoofHub user ID</Label>
                <Input
                  id="invite-user-id"
                  name="targetUserId"
                  autoComplete="off"
                  placeholder="9f637cdb-5c66-4f4b-8f93-5c130c1405dc"
                  aria-invalid={Boolean(inviteState.errors?.targetUserId)}
                />
                {inviteState.errors?.targetUserId ? (
                  <FieldError>{inviteState.errors.targetUserId}</FieldError>
                ) : null}
                <FieldHelp>Only valid user IDs can be invited through this path.</FieldHelp>
              </Field>
            )}

            <Field>
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" name="role" defaultValue="agent">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="agent">Agent</option>
              </Select>
              {inviteState.errors?.role ? <FieldError>{inviteState.errors.role}</FieldError> : null}
              <FieldHelp>Assigned when the invite is accepted.</FieldHelp>
            </Field>

            <div className="flex items-end">
              <Button type="submit" disabled={isInvitePending} className="w-full lg:w-auto">
                {isInvitePending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {isInvitePending ? "Sending..." : "Create invite"}
              </Button>
            </div>
          </form>

          {inviteState.status === "success" && inviteState.inviteLinkPath ? (
            <div className="border-border/75 bg-surface-soft flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm">
              <p className="text-muted-foreground min-w-0 flex-1 truncate">
                Secure invite link ready: {inviteState.inviteLinkPath}
              </p>
              <button
                type="button"
                onClick={() => copyInviteLink(inviteState.inviteLinkPath!)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Copy className="size-4" />
                Copy link
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="space-y-1.5">
            <p className="type-label">Members</p>
            <h2 className="type-section-title">Active team members</h2>
          </div>
          <Badge variant="outline">{activeMembers.length} active</Badge>
        </header>

        {activeMembers.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No active members"
            description="Invite teammates to turn this company workspace into a multi-member operation."
          />
        ) : (
          <ul className="space-y-3">
            {activeMembers.map((member) => {
              const memberName = getMemberDisplayName(member);
              const isTargetPrivileged = member.role === "owner" || member.role === "admin";
              const isLastOwner = member.role === "owner" && activeOwnerCount <= 1;
              const adminRestricted = viewerMembershipRole === "admin" && isTargetPrivileged;
              const canManageStatus = !adminRestricted && !isLastOwner;
              const canManageRemoval = !adminRestricted && !isLastOwner;

              return (
                <li
                  key={member.id}
                  className="border-border/75 bg-card/58 rounded-xl border px-4 py-3 sm:px-4 sm:py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="bg-primary/14 text-primary inline-flex size-9 items-center justify-center rounded-full text-xs font-semibold">
                          {toInitials(memberName)}
                        </div>
                        <p className="truncate text-sm font-semibold">{memberName}</p>
                        <Badge variant="outline">{ORGANIZATION_MEMBER_ROLE_LABELS[member.role]}</Badge>
                        <Badge variant={getStatusBadgeVariant(member.member_status)}>
                          {ORGANIZATION_MEMBER_STATUS_LABELS[member.member_status]}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Joined {formatDateLabel(member.joined_at)} • User ID {member.user_id}
                      </p>
                      {isLastOwner ? (
                        <p className="text-warning text-xs">
                          This is the last active owner. Keep at least one owner active.
                        </p>
                      ) : null}
                      {adminRestricted ? (
                        <p className="text-muted-foreground text-xs">
                          Admin members can only manage manager and agent roles.
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_auto_auto] sm:items-end">
                      <form onSubmit={onRoleSubmit} className="space-y-1.5">
                        <input type="hidden" name="membershipId" value={member.id} />
                        <Label className="text-xs" htmlFor={`member-role-${member.id}`}>
                          Role
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            id={`member-role-${member.id}`}
                            name="newRole"
                            defaultValue={member.role}
                            disabled={isMutationPending || adminRestricted}
                          >
                            {roleOptions.map((roleOption) => (
                              <option key={`${member.id}-${roleOption}`} value={roleOption}>
                                {ORGANIZATION_MEMBER_ROLE_LABELS[roleOption]}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" variant="outline" size="sm" disabled={isMutationPending || adminRestricted}>
                            {isMutationPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                            Update
                          </Button>
                        </div>
                      </form>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isMutationPending || !canManageStatus}
                        onClick={() =>
                          setMemberStatusDialog({
                            membershipId: member.id,
                            memberName,
                            nextStatus: "inactive",
                          })
                        }
                      >
                        <UserRoundMinus className="size-4" />
                        Suspend
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isMutationPending || !canManageRemoval}
                        onClick={() =>
                          setMemberRemovalDialog({
                            membershipId: member.id,
                            memberName,
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-4 flex items-center justify-between gap-3 border-b pb-3">
            <h3 className="type-section-title">Pending invites</h3>
            <Badge variant="outline">{pendingInvites.length} pending</Badge>
          </header>

          {pendingInvites.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No pending invites"
              description="Invites you create will appear here until accepted, revoked, or expired."
            />
          ) : (
            <ul className="space-y-3">
              {pendingInvites.map((invite) => {
                const invitePath = `/profile/company/invites/${invite.invite_token}`;
                const inviteTarget = getInviteTargetLabel(invite);

                return (
                  <li
                    key={invite.id}
                    className="border-border/70 bg-card/55 rounded-xl border px-3.5 py-3"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{inviteTarget}</p>
                        <Badge variant="outline">{ORGANIZATION_MEMBER_ROLE_LABELS[invite.role]}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Expires {formatDateLabel(invite.expires_at)} • Sent {formatDateLabel(invite.created_at)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyInviteLink(invitePath)}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Copy className="size-4" />
                          Copy link
                        </button>
                        <Link href={invitePath} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Open invite
                        </Link>
                        <button
                          type="button"
                          disabled={isMutationPending}
                          onClick={() =>
                            setInviteRevocationDialog({
                              inviteId: invite.id,
                              inviteTarget,
                            })
                          }
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          <UserRoundX className="size-4" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <header className="border-border/70 mb-4 flex items-center justify-between gap-3 border-b pb-3">
            <h3 className="type-section-title">Suspended members</h3>
            <Badge variant="outline">{suspendedMembers.length} suspended</Badge>
          </header>

          {suspendedMembers.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No suspended members"
              description="Suspended members appear here and can be reactivated when needed."
            />
          ) : (
            <ul className="space-y-3">
              {suspendedMembers.map((member) => {
                const memberName = getMemberDisplayName(member);
                const adminRestricted =
                  viewerMembershipRole === "admin" && (member.role === "owner" || member.role === "admin");

                return (
                  <li
                    key={member.id}
                    className="border-border/70 bg-card/55 rounded-xl border px-3.5 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{memberName}</p>
                        <p className="text-muted-foreground text-xs">
                          {ORGANIZATION_MEMBER_ROLE_LABELS[member.role]} • User ID {member.user_id}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isMutationPending || adminRestricted}
                        onClick={() =>
                          setMemberStatusDialog({
                            membershipId: member.id,
                            memberName,
                            nextStatus: "active",
                          })
                        }
                      >
                        <ShieldCheck className="size-4" />
                        Reactivate
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={Boolean(memberStatusDialog)} onOpenChange={(open) => !open && setMemberStatusDialog(null)}>
        <DialogContent showClose={!isMutationPending}>
          <DialogHeader>
            <DialogTitle>
              {memberStatusDialog?.nextStatus === "inactive" ? "Suspend team member" : "Reactivate team member"}
            </DialogTitle>
            <DialogDescription>
              {memberStatusDialog?.nextStatus === "inactive"
                ? `${memberStatusDialog?.memberName} will lose active company workspace access until reactivated.`
                : `${memberStatusDialog?.memberName} will regain active company workspace access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberStatusDialog(null)}
              disabled={isMutationPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmStatusChange} disabled={isMutationPending}>
              {isMutationPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(memberRemovalDialog)} onOpenChange={(open) => !open && setMemberRemovalDialog(null)}>
        <DialogContent showClose={!isMutationPending}>
          <DialogHeader>
            <DialogTitle>Remove team member</DialogTitle>
            <DialogDescription>
              {memberRemovalDialog?.memberName} will be removed from this company workspace. Historical
              audit records remain intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberRemovalDialog(null)}
              disabled={isMutationPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmMemberRemoval}
              disabled={isMutationPending}
            >
              {isMutationPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(inviteRevocationDialog)}
        onOpenChange={(open) => !open && setInviteRevocationDialog(null)}
      >
        <DialogContent showClose={!isMutationPending}>
          <DialogHeader>
            <DialogTitle>Revoke pending invite</DialogTitle>
            <DialogDescription>
              Invite for {inviteRevocationDialog?.inviteTarget} will become invalid immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteRevocationDialog(null)}
              disabled={isMutationPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmInviteRevocation}
              disabled={isMutationPending}
            >
              {isMutationPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Revoke invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
