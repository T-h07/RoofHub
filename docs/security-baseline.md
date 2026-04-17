# Security Baseline (SH-PT01)

## Purpose

This document defines the minimum security contract for RoofHub.  
It is the baseline future PTs must preserve and extend.

This is a guardrail milestone, not a full hardening rollout.

Supply-chain execution details are defined in `docs/supply-chain-guardrails.md`.
Audit and observability execution details are defined in `docs/audit-observability-hardening.md`.

## Scope and assumptions

- Platform: Next.js App Router on Vercel with Supabase backend services.
- Supabase auth/session handling uses SSR/browser separation.
- RLS is part of the trust boundary and must remain aligned with app-side authorization checks.
- Environment model: local (`.env.local`), Vercel preview, Vercel production.

## Security principles

- Secure defaults over convenience shortcuts.
- Server-side authorization for every sensitive read/write path.
- Least privilege for credentials, data exposure, and storage access.
- Validate all external input before persistence/query/use.
- Fail safely with user-friendly errors; do not leak internals.
- Keep behavior deterministic for ownership, visibility, and status transitions.

## Sensitive subsystems and mandatory guardrails

### 1) Auth and session handling

- Route protection is required but not sufficient; each sensitive action must still enforce authorization.
- Identity comes from authenticated server context only.
- Do not trust client role/ownership claims.
- Callback/redirect handling must use safe relative paths or explicit allowlists.
- Password reset and callback flows must avoid exposing raw provider/backend errors.
- Session revalidation should remain server-enforced (SSR cookie model), not client-local storage auth assumptions.
- Sign-out must invalidate active app session state cleanly and leave no stale protected-route access.
- Session-expired/session-revoked states must fail closed and require explicit re-authentication.
- Detailed auth/session hardening behavior is documented in `docs/auth-session-hardening.md`.

### 2) Authorization, ownership, and RLS alignment

- Enforce ownership server-side for listing/profile/storage/messaging mutations.
- Enforce company workspace ownership from persisted `organization_members` records, not client mode toggles.
- Enforce company profile and branding mutations (name/contact/coverage/logo) through persisted owner membership checks.
- Enforce company invite creation, invite revocation, role updates, status updates, and member removal through persisted owner/admin membership checks.
- Enforce company listing ownership assignment through persisted active organization membership checks when `listings.organization_id` is set.
- Enforce company listing review workflow transitions (submit/needs-changes/approve/publish/unpublish) through trusted server mutations backed by persisted membership role checks.
- Restrict company listing review/publish actions to reviewer-capable membership roles (`owner`/`admin`/`manager`) with creator or assigned-agent submit constraints.
- Restrict company pending-review queue visibility to reviewer-capable membership roles (`owner`/`admin`/`manager`) on trusted server paths.
- Restrict listing workflow timeline visibility to reviewer roles or listing-responsible actors (creator/assigned agent), not broad active-member reads.
- For company operational dashboards, use trusted server-side organization resolution and membership-gated query paths (RLS-compatible or security-definer RPCs with explicit membership checks); do not trust client-selected company scope.
- Company invite acceptance must be bound to authenticated user identity (target user id match or invite-email match), never client-asserted claims.
- Invite-email identity matching must use server-trusted email resolution (`auth.users` / trusted helper), not mutable client metadata assumptions.
- Protect owner continuity for company membership mutations (at least one active owner must remain).
- Suspended/removed company members must lose private company listing and listing-media access, even when historical owner ids match.
- Never use client-supplied owner/provider/admin ids as authority.
- Preserve RLS assumptions; app code must not "re-authorize" by weak client filters.
- Admin-only behavior must have explicit role checks in server code.
- Provider-only behavior must derive provider identity from authenticated profile context.
- Company workspace creation must be transactional: organization record + owner membership bootstrap succeed/fail together.
- Keep the role/ownership/participant contract aligned with `docs/authorization-boundary-audit.md`.

### 3) Route handlers and server actions

- Treat all route handlers and server actions as untrusted entry points.
- Validate params/query/body/form data with strict typing and allowlists.
- Avoid broad wildcard updates/deletes when a scoped predicate is available.
- For security-sensitive actions, return bounded error messages to clients and keep detailed reasons in internal logs only.

### 4) Upload and storage flows

- Enforce approved MIME types, max file size, and max file count.
- Verify file signatures for accepted image types before upload; do not rely on browser picker or declared MIME alone.
- Keep deterministic path format and parse/verify ownership before delete/sync operations.
- Keep listing image path format strict (`owner/{owner_uuid}/listing/{listing_uuid}/{uuid}.{ext}`) and reject path-abuse patterns.
- Keep company logo path format strict (`organization/{organization_uuid}/{uuid}.{ext}`) and reject path-abuse patterns.
- No broad public write access.
- Do not rely on overwrite/upsert behavior as standard flow (`upsert: false` default for media uploads).
- Keep object update semantics intentionally constrained for listing images; prefer append + delete flows.
- Public/private bucket usage must be explicit and documented.
- Preserve SH-PT05 media contract in `docs/upload-storage-hardening.md`.

### 5) Messaging, moderation, and privilege boundaries

- Conversations and messages are participant-scoped only.
- Conversation creation must enforce listing contactability and anti-self-contact checks.
- Moderation actions are admin-only and must not be bypassed by provider/user controls.
- Listing visibility must obey listing status (`published`-only for public discovery surfaces).
- Company listing review states (`draft`, `submitted_for_review`, `needs_changes`, `approved`, `unpublished`) are internal-only and must never leak to public discovery/detail/company feeds.
- Public company pages must expose only intended public organization fields and published listing inventory.
- Status transitions must remain centralized and validated.

### 6) Input/output safety

- Validate all form payloads and query params before business logic.
- Keep query parsing typed and bounded (numeric ranges, enums, defaults).
- Render user-generated content safely; avoid unsafe HTML interpolation.
- Keep public/private data separation explicit in loaders and projections.
- Preserve SH-PT04 request/output guardrails documented in `docs/request-output-validation-hardening.md`.

### 7) Logging and error handling

- User-facing errors: clear, generic, and action-oriented.
- Internal logs: diagnostic, but never include secrets/tokens/passwords/auth codes/cookies.
- Security-sensitive failures must not fail silently.
- Redact sensitive fields by default (`Authorization`, cookies, API keys, OAuth codes, reset tokens, service keys).
- Security-relevant actions should be captured through durable structured audit events (see `docs/audit-observability-hardening.md`).

### 8) Environment and secrets

- `.env.local` and any real `.env*` values are never committed.
- `.env.example` contains placeholders only.
- `NEXT_PUBLIC_*` variables are public-by-definition and must not contain secrets.
- Supabase service-role key is server-only and must never appear in client bundles.
- Keep Vercel envs separated per environment (Development, Preview, Production).
- `NEXT_PUBLIC_SITE_URL` and Supabase redirect URL config must remain aligned with auth callback behavior.
- `AUTH_ALLOWED_ORIGINS` must be configured server-side for trusted auth callback/reset URL generation across local/preview/production.

Google OAuth note:

- App-side Google OAuth flow foundations may exist before provider setup is complete.
- When enabled, keep client secret server-only, configure provider redirect URIs explicitly, and document callback allowlists for local/preview/production.

### 9) Dependency and package hygiene

- No random package additions.
- Any package affecting auth, uploads, parsing, rendering, crypto, or networking requires explicit review notes.
- Keep lockfile updates intentional and scoped.
- Prefer maintained dependencies with clear release/security history.
- Keep dependency changes reproducible: `package-lock.json` is required and should reflect intentional updates only.

### 10) Supply-chain and CI security guardrails

- Secret scanning, dependency scanning, and code scanning workflows are mandatory baseline controls.
- Do not disable or weaken security workflows without documented rationale.
- Scanner suppressions must be narrow, justified, and reviewable.
- Dependabot update hygiene should remain enabled and scoped to avoid alert fatigue.
- Security workflow changes are security-sensitive changes and require checklist completion.

### 11) Traffic controls and abuse resistance

- High-risk auth, messaging, reporting, provider mutation, and moderation mutation paths must include server-side traffic controls.
- Apply controls at execution boundaries (server actions/route handlers), not only in client UX.
- Use layered controls where appropriate (for example per-IP and per-account scopes for auth-sensitive behavior).
- Keep limits explicit and documented in `docs/traffic-control-hardening.md`.
- Throttled responses must remain bounded and user-safe.

### 12) Production hardening and launch readiness

- Browser-facing security headers and baseline CSP must remain explicitly configured and reviewed.
- Release readiness must be tracked with an explicit checklist, blockers list, and security debt register.
- Do not treat manual platform config (Supabase/Vercel/OAuth) as implicitly safe; required settings must be documented and verified per environment.
- Preserve SH-PT09 release guardrails in:
  - `docs/production-hardening-launch-review.md`
  - `docs/security-launch-blockers.md`
  - `docs/security-debt-register.md`

## Required review points for high-risk changes

The following changes require explicit security review before merge:

- auth/session flows, callback handling, sign-in/sign-up/reset logic
- authorization logic, ownership checks, admin/provider boundaries
- route handler/server action changes on sensitive data
- storage/upload/delete path and bucket/policy behavior
- storage path validation, object overwrite policy changes, or media lifecycle cleanup semantics
- messaging participant rules and moderation status transitions
- new external input parsers or render paths for user content
- environment/secrets model changes
- dependency additions in sensitive domains
- CI/security workflow changes or scanner suppression changes
- high-risk mutation/read paths added without traffic-control evaluation
- audit event taxonomy/storage/redaction changes without docs and access-boundary review
- organization/company workspace schema, ownership, or membership bootstrap flow changes without boundary review

## Definition of done for security-sensitive work

A security-sensitive change is done only when:

- code enforces auth + authorization requirements server-side
- input validation and safe output handling are in place
- RLS assumptions remain valid
- storage and visibility rules are preserved
- error/log behavior follows redaction and disclosure rules
- checklist in `docs/security-checklist.md` is completed
- tests or validation notes are included for sensitive behavior
- docs are updated when trust boundaries or assumptions changed
- abuse-prone entry points include traffic-control handling or explicit documented deferral

## Merge blockers

Do not merge when any of the following is true:

- secrets or credentials are committed
- privileged keys are exposed to browser/public env
- sensitive action lacks server-side authorization checks
- client-supplied role/owner/admin identifiers are trusted
- validation is missing for external input
- visibility/status rules can expose hidden/private data
- errors leak internal backend/provider details
- checklist is skipped for security-sensitive changes
- security scanner findings are ignored without documented disposition
- high-risk mutation paths bypass required traffic-control review

## Intentionally deferred from SH-PT01

- adaptive risk-scoring abuse controls and challenge flows
- advanced audit alerting/retention automation and SIEM integrations
- strict nonce-based CSP/header hardening program
- full historical security audit of all features
- schema/RLS redesign

These are separate PTs and should build on this baseline, not replace it.
