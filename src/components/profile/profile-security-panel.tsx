"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, LogOut, Mail, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthStatusMessage } from "@/components/auth/auth-status-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldHelp } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ThemePreferenceSelector } from "@/components/theme/theme-preference-selector";
import { signOutAction } from "@/lib/auth/actions";
import { ORGANIZATION_MEMBER_ROLE_LABELS } from "@/lib/company/team-types";
import { deleteAccountAction } from "@/lib/profile/actions";
import { PROFILE_DELETE_ACTION_IDLE_STATE } from "@/lib/profile/types";

import { ProfileSectionShell } from "./profile-section-shell";
import type { ProfileAccountSnapshot } from "./types";

type ProfileSecurityPanelProps = {
  account: ProfileAccountSnapshot;
};

function getDefaultOrganizationDeleteMode(account: ProfileAccountSnapshot) {
  return account.ownedCompanyForDeletion?.transferCandidates.length
    ? "transfer_company"
    : "delete_company";
}

export function ProfileSecurityPanel({ account }: ProfileSecurityPanelProps) {
  const router = useRouter();
  const [deleteState, deleteAction, isDeletePending] = useActionState(
    deleteAccountAction,
    PROFILE_DELETE_ACTION_IDLE_STATE
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleteConfirmationEmail, setDeleteConfirmationEmail] = useState("");
  const [organizationDeleteMode, setOrganizationDeleteMode] = useState<
    "delete_company" | "transfer_company"
  >(getDefaultOrganizationDeleteMode(account));
  const [transferTargetUserId, setTransferTargetUserId] = useState("");

  const requiresEmailDeleteConfirmation = Boolean(account.email?.trim());
  const hasOwnedCompany = Boolean(account.ownedCompanyForDeletion);
  const transferModeSelected = hasOwnedCompany && organizationDeleteMode === "transfer_company";
  const transferTargetSelected = transferTargetUserId.trim().length > 0;
  const deleteConfirmationReady =
    deleteConfirmationText.trim() === "DELETE" &&
    (!requiresEmailDeleteConfirmation ||
      deleteConfirmationEmail.trim().toLowerCase() === account.email?.trim().toLowerCase()) &&
    (!transferModeSelected || transferTargetSelected);

  useEffect(() => {
    if (deleteState.status === "success") {
      router.replace(deleteState.redirectTo ?? "/");
      router.refresh();
    }
  }, [deleteState.redirectTo, deleteState.status, router]);

  return (
    <>
      <ProfileSectionShell
        eyebrow="Security and lifecycle"
        title="Session controls and destructive actions"
        description="Keep device-local appearance separate from authenticated session controls and irreversible account operations."
      >
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border/70 bg-surface-soft/88 px-4 py-3.5">
            <ThemePreferenceSelector />
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-surface-soft/88 px-4 py-3.5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Shield className="text-primary size-4" />
              Active session controls
            </p>
            <p className="text-muted-foreground inline-flex items-center gap-2 text-xs leading-5">
              <Mail className="size-3.5" />
              {account.email ?? "Signed-in email unavailable"}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              End the current browser session immediately without affecting the rest of your account settings.
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="mt-3 w-full justify-center sm:w-auto">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>

          <div className="bg-destructive/7 space-y-3 rounded-xl border border-destructive/30 px-4 py-3.5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <AlertTriangle className="text-destructive size-4" />
              Danger zone
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              Permanent deletion removes your RoofHub account, listings, favorites, conversations, messages, reports, and linked media.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-3 w-full justify-center sm:w-auto"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              Delete account permanently
            </Button>
          </div>
        </div>
      </ProfileSectionShell>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletePending) {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setDeleteConfirmationText("");
              setDeleteConfirmationEmail("");
              setTransferTargetUserId("");
              setOrganizationDeleteMode(getDefaultOrganizationDeleteMode(account));
            }
          }
        }}
      >
        <DialogContent showClose={!isDeletePending} className="sm:max-w-[37rem]">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 text-base">
              <AlertTriangle className="text-destructive size-4" />
              Permanently delete RoofHub account
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              This action cannot be undone. RoofHub will permanently remove your account identity,
              listings, favorites, messages, reports, and linked media objects.
            </DialogDescription>
          </DialogHeader>

          <form action={deleteAction} className="mt-4 space-y-4">
            <Field>
              <Label htmlFor="delete-confirm-text">
                Type <span className="font-semibold">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirm-text"
                name="confirmDeleteText"
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.currentTarget.value)}
                placeholder="DELETE"
                disabled={isDeletePending}
                autoComplete="off"
              />
            </Field>

            {requiresEmailDeleteConfirmation ? (
              <Field>
                <Label htmlFor="delete-confirm-email">Confirm account email</Label>
                <Input
                  id="delete-confirm-email"
                  name="confirmEmail"
                  type="email"
                  value={deleteConfirmationEmail}
                  onChange={(event) => setDeleteConfirmationEmail(event.currentTarget.value)}
                  placeholder={account.email ?? ""}
                  disabled={isDeletePending}
                  autoComplete="off"
                />
                <FieldHelp>Enter {account.email} exactly to enable permanent deletion.</FieldHelp>
              </Field>
            ) : (
              <input type="hidden" name="confirmEmail" value="" />
            )}

            {hasOwnedCompany ? (
              <div className="space-y-4 rounded-xl border border-destructive/35 bg-destructive/7 px-4 py-3">
                <p className="text-sm font-semibold tracking-tight">Company ownership decision</p>
                <p className="text-muted-foreground text-sm leading-6">
                  You currently own <span className="font-medium">{account.ownedCompanyForDeletion?.organizationName}</span>.
                  Choose whether to transfer ownership or delete this company profile with its listings.
                </p>

                <Field>
                  <Label htmlFor="organization-delete-mode">Company action</Label>
                  <Select
                    id="organization-delete-mode"
                    name="organizationDeleteMode"
                    value={organizationDeleteMode}
                    onChange={(event) =>
                      setOrganizationDeleteMode(
                        event.currentTarget.value === "delete_company"
                          ? "delete_company"
                          : "transfer_company"
                      )
                    }
                    disabled={isDeletePending}
                  >
                    <option value="transfer_company">Transfer company ownership to a member</option>
                    <option value="delete_company">Delete company profile and listings</option>
                  </Select>
                </Field>

                {organizationDeleteMode === "transfer_company" ? (
                  <Field>
                    <Label htmlFor="transfer-target-user-id">Transfer ownership to</Label>
                    <Select
                      id="transfer-target-user-id"
                      name="transferTargetUserId"
                      value={transferTargetUserId}
                      onChange={(event) => setTransferTargetUserId(event.currentTarget.value)}
                      disabled={isDeletePending}
                    >
                      <option value="">Select a member</option>
                      {account.ownedCompanyForDeletion?.transferCandidates.map((candidate) => (
                        <option key={candidate.userId} value={candidate.userId}>
                          {candidate.displayName} ({ORGANIZATION_MEMBER_ROLE_LABELS[candidate.role]})
                        </option>
                      ))}
                    </Select>
                    <FieldHelp>
                      Ownership will move to this active member before your account is deleted.
                    </FieldHelp>
                  </Field>
                ) : (
                  <>
                    <input type="hidden" name="transferTargetUserId" value="" />
                    <FieldHelp>
                      All company listings will be deleted. Team members lose this workspace and are reset to individual provider mode when they have no other active company memberships.
                    </FieldHelp>
                  </>
                )}
              </div>
            ) : (
              <>
                <input type="hidden" name="organizationDeleteMode" value="" />
                <input type="hidden" name="transferTargetUserId" value="" />
              </>
            )}

            {deleteState.status === "error" && deleteState.message ? (
              <AuthStatusMessage tone="error" message={deleteState.message} />
            ) : null}

            {deleteState.status === "success" && deleteState.message ? (
              <AuthStatusMessage tone="success" message={deleteState.message} />
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isDeletePending}
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!deleteConfirmationReady || isDeletePending}>
                {isDeletePending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isDeletePending ? "Deleting account..." : "Delete account permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
