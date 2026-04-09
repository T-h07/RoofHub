# Security Baseline (SH-PT01)

## Purpose

This document defines the minimum security contract for RoofHub.  
It is the baseline future PTs must preserve and extend.

This is a guardrail milestone, not a full hardening rollout.

Supply-chain execution details are defined in `docs/supply-chain-guardrails.md`.

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
- Never use client-supplied owner/provider/admin ids as authority.
- Preserve RLS assumptions; app code must not "re-authorize" by weak client filters.
- Admin-only behavior must have explicit role checks in server code.
- Provider-only behavior must derive provider identity from authenticated profile context.
- Keep the role/ownership/participant contract aligned with `docs/authorization-boundary-audit.md`.

### 3) Route handlers and server actions

- Treat all route handlers and server actions as untrusted entry points.
- Validate params/query/body/form data with strict typing and allowlists.
- Avoid broad wildcard updates/deletes when a scoped predicate is available.
- For security-sensitive actions, return bounded error messages to clients and keep detailed reasons in internal logs only.

### 4) Upload and storage flows

- Enforce approved MIME types, max file size, and max file count.
- Keep deterministic path format and parse/verify ownership before delete/sync operations.
- No broad public write access.
- Do not rely on overwrite/upsert behavior as standard flow.
- Public/private bucket usage must be explicit and documented.

### 5) Messaging, moderation, and privilege boundaries

- Conversations and messages are participant-scoped only.
- Conversation creation must enforce listing contactability and anti-self-contact checks.
- Moderation actions are admin-only and must not be bypassed by provider/user controls.
- Listing visibility must obey listing status (`published`-only for public discovery surfaces).
- Status transitions must remain centralized and validated.

### 6) Input/output safety

- Validate all form payloads and query params before business logic.
- Keep query parsing typed and bounded (numeric ranges, enums, defaults).
- Render user-generated content safely; avoid unsafe HTML interpolation.
- Keep public/private data separation explicit in loaders and projections.

### 7) Logging and error handling

- User-facing errors: clear, generic, and action-oriented.
- Internal logs: diagnostic, but never include secrets/tokens/passwords/auth codes/cookies.
- Security-sensitive failures must not fail silently.
- Redact sensitive fields by default (`Authorization`, cookies, API keys, OAuth codes, reset tokens, service keys).

Planned for SH-PT08 (not implemented here):
- structured security/audit event logging and retention policy
- standardized event taxonomy for auth failures, admin actions, moderation transitions, and sensitive mutation denials

### 8) Environment and secrets

- `.env.local` and any real `.env*` values are never committed.
- `.env.example` contains placeholders only.
- `NEXT_PUBLIC_*` variables are public-by-definition and must not contain secrets.
- Supabase service-role key is server-only and must never appear in client bundles.
- Keep Vercel envs separated per environment (Development, Preview, Production).
- `NEXT_PUBLIC_SITE_URL` and Supabase redirect URL config must remain aligned with auth callback behavior.

Google OAuth note:
- OAuth is not currently enabled.
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

## Required review points for high-risk changes

The following changes require explicit security review before merge:

- auth/session flows, callback handling, sign-in/sign-up/reset logic
- authorization logic, ownership checks, admin/provider boundaries
- route handler/server action changes on sensitive data
- storage/upload/delete path and bucket/policy behavior
- messaging participant rules and moderation status transitions
- new external input parsers or render paths for user content
- environment/secrets model changes
- dependency additions in sensitive domains
- CI/security workflow changes or scanner suppression changes

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

## Intentionally deferred from SH-PT01

- full rate limiting rollout
- full audit logging implementation
- CSP/header hardening program
- full historical security audit of all features
- schema/RLS redesign

These are separate PTs and should build on this baseline, not replace it.
