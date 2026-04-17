# Audit Trails and Security Observability (SH-PT08)

## Purpose

This document defines RoofHub's security-focused audit trail model.

SH-PT08 adds durable, structured, privacy-aware observability for high-impact auth, provider, moderation, reporting, and messaging-critical actions.

## Durable storage model

Audit trail storage is now implemented with:

- table: `public.security_audit_events`
- writer function: `public.log_security_audit_event(...)`
- migration: `supabase/migrations/20260410153000_nm_sh_pt08_audit_observability.sql`

Design goals:

- durable history for security-relevant actions (not console-only)
- append-focused event writing through a bounded RPC function
- strict metadata size/type checks at DB level
- explicit access boundaries via RLS

## Access boundaries

- `security_audit_events` is RLS-enabled.
- direct table access is revoked from `anon` and `authenticated`.
- only admin users can read audit rows (`security_audit_events_select_admin` policy).
- writes are performed through `log_security_audit_event(...)`, which enforces normalized input and actor consistency when authenticated.

No public routes expose audit history.

## Structured event model

Core fields:

- `event_type`
- `actor_user_id`
- `actor_role`
- `target_type`
- `target_id`
- `listing_id`
- `conversation_id`
- `report_id`
- `from_status`
- `to_status`
- `metadata` (sanitized JSON object)
- `created_at`

Event naming uses dotted domains (for example `auth.sign_in.failed`, `provider.listing_status.changed`).

## Redaction and safe logging rules

All app-layer audit writes pass through `src/lib/security/audit.ts`, which:

- sanitizes metadata recursively
- redacts sensitive keys (`password`, `token`, `secret`, `cookie`, `authorization`, API-key-like fields, verifier/secret fields)
- redacts token-like string payloads (JWT/bearer-like patterns)
- truncates deep or oversized metadata payloads
- bounds array/key/string sizes for safe operational logs

Never log:

- passwords
- access/refresh tokens
- session cookies
- OAuth secrets/verifiers
- raw authorization headers
- service-role credentials
- raw message bodies in audit metadata

## Audited event map

### Auth/session

- `auth.sign_in.succeeded`
- `auth.sign_in.failed`
- `auth.sign_up.completed`
- `auth.sign_up.pending_verification`
- `auth.sign_up.failed`
- `auth.password_reset.requested`
- `auth.password_reset.completed`
- `auth.sign_out.completed`
- `auth.callback.succeeded`
- `auth.callback.failed`
- `auth.profile_bootstrap.failed`

Notes:

- sign-in/sign-up/reset request flows store hashed identity context where relevant (for example email hash), not raw credentials.
- callback failure categories are sanitized and bounded.

### Provider listing lifecycle

- `provider.listing_draft.created`
- `provider.listing_draft.step_saved`
- `provider.listing_photos.synced`
- `provider.listing.published`
- `provider.listing.publish_failed`
- `provider.listing_status.changed`
- `provider.listing_status.change_denied`
- `provider.listing_status.change_failed`

Status transitions include `from_status` and `to_status` when applicable.

### Company listing approval workflow (NM-PT35)

- Persisted workflow timeline events are captured in `public.listing_workflow_events`.
- Timeline event types:
  - `created`
  - `submitted_for_review`
  - `needs_changes`
  - `approved`
  - `published`
  - `unpublished`
- Workflow transition actions also emit security audit events through existing provider listing status events:
  - `provider.listing_status.changed`
  - `provider.listing_status.change_failed`
- Workflow timeline notes are bounded and sanitized for length; no secrets/tokens are allowed in note metadata.

### Reporting and moderation

- `moderation.report.created`
- `moderation.report.duplicate`
- `moderation.visibility.changed`
- `moderation.visibility.failed`

Moderation visibility events include optional `report_id` linkage when action is initiated from report queue context.

### Messaging-critical

- `messaging.conversation.created` (covers created vs existing outcomes)
- `messaging.message.sent`

Message audit metadata records only safe descriptors (for example message length), never raw body duplication.

### Profile role-sensitive

- `profile.role.changed`

### Company workspace profile and branding

- `organization.profile.updated`
- `organization.profile.update_failed`
- `organization.logo.updated`
- `organization.logo.removed`
- `organization.logo.update_failed`

### Company team invites and membership lifecycle

- `organization.invite.created`
- `organization.invite.create_failed`
- `organization.invite.accepted`
- `organization.invite.accept_failed`
- `organization.invite.revoked`
- `organization.invite.revoke_failed`
- `organization.member.role_changed`
- `organization.member.role_change_failed`
- `organization.member.suspended`
- `organization.member.reactivated`
- `organization.member.status_update_failed`
- `organization.member.removed`
- `organization.member.remove_failed`

## Company activity log surfaces (NM-PT39)

PT39 adds trusted internal activity-log rendering for company operations:

- company dashboard feed and dedicated activity log route are backed by persisted events
- listing workflow timeline remains sourced from `public.listing_workflow_events`
- membership/invite/admin operational timeline events are sourced from `public.security_audit_events`
- reviewer notes are rendered in timeline context from persisted workflow notes

Access boundaries:

- company activity feed RPC now requires reviewer-capable membership (`owner`, `admin`, `manager`) or app admin
- listing workflow timeline still requires authenticated company membership through trusted server/RPC checks
- no internal activity log data is exposed on public listing/company surfaces

## Failure observability model

Important failures now emit bounded, structured audit events in these flows:

- auth callback/sign-in/sign-up/profile-bootstrap failures
- provider publish and status mutation failures
- moderation visibility failures
- report creation failures (sanitized outcome metadata)
- company profile/branding mutation failures (sanitized outcome metadata)

If audit DB writes fail, a sanitized structured diagnostic event (`audit.write_failed`) is emitted to server logs without secret exposure.

## Validation notes (SH-PT08)

Validated in this PT:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx supabase db lint --local`
- `npm audit --package-lock-only --omit=dev --audit-level=high`

## Deferred from SH-PT08

- external SIEM/drain integrations
- long-term retention/rotation automation
- alert pipelines on specific audit event thresholds

These are intentionally deferred to later PTs so SH-PT08 stays scoped to durable event capture and safe observability foundations.
