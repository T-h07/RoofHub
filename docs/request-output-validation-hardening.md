# Input/Output Validation Hardening (SH-PT04)

## Purpose

This document defines the request-boundary and output-safety contract for RoofHub.

SH-PT04 hardens how payloads are accepted, normalized, validated, and rendered so malformed or hostile input is rejected predictably before business logic runs.

## Boundary map (authoritative entry points)

Treat these as untrusted input boundaries:

- Auth forms and callback params (`src/lib/auth/*`, `src/app/auth/callback/route.ts`)
- Profile update form payloads (`src/lib/profile/actions.ts`)
- Company workspace create payloads (`src/lib/company/actions.ts`)
- Company profile edit payloads and logo actions (`src/lib/company/profile-actions.ts`)
- Company team invite/member payloads (`src/lib/company/team-actions.ts`, `src/lib/company/team-validation.ts`)
- Provider listing wizard create/edit/publish payloads (`src/lib/listings/provider-wizard/*`)
- Provider status transition actions (`src/lib/listings/provider-dashboard/actions.ts`)
- Listing favorites/report actions (`src/lib/listings/favorite-actions.ts`, `src/lib/listings/detail-actions.ts`)
- Messaging create/send/read/list/thread actions (`src/lib/messaging/actions.ts`, `src/lib/messaging/queries.ts`)
- Moderation actions/queue filters (`src/lib/moderation/actions.ts`, `src/lib/moderation/queries.ts`)
- Explore/map query params (`src/lib/listings/explore-search-params.ts`, `src/lib/listings/map-bounds.ts`)
- Route params for listing slug and provider edit id (`src/lib/listings/public-listing-detail.ts`, `src/app/dashboard/listings/[id]/edit/page.tsx`)
- Route params for company slug (`src/lib/company/public-profile.ts`, `src/app/companies/[slug]/page.tsx`)
- Route params for company invite token (`src/app/profile/company/invites/[token]/page.tsx`)
- Upload/storage metadata mutation payloads (`src/lib/listings/provider-wizard/publish-actions.ts`, `src/lib/storage/listing-images.ts`)

## Validation contract

- Server-side validation is authoritative. Client validation is UX only.
- Server actions must treat input payloads as unknown runtime data and reject invalid shapes.
- External values must be normalized into explicit typed models before persistence or query execution.
- Unknown enum/state values must fail closed.
- Route and search params must use strict parsers (no permissive partial numeric parsing).
- Company workspace setup must validate name/description bounds server-side and derive ownership from authenticated server context.
- Company profile setup must validate contact email/phone/website/coverage bounds server-side and derive edit authority from authenticated owner membership context.
- Company team invite flows must validate invite method, target (email/user id), role, and mutation references (membership/invite ids) before execution.
- Company invite acceptance must validate token shape and enforce authenticated user-to-invite target matching server-side.

## Query and route param rules

- Parse numeric params with strict token checks; reject values with trailing junk.
- Clamp and bound pagination/limits and range filters.
- Keep explicit defaults when params are missing/invalid.
- Validate dynamic route identifiers early:
  - UUID route ids short-circuit to `notFound()` when malformed.
  - Listing slugs must match expected slug pattern and max length.
  - Company slugs must match expected slug pattern and max length.
- For map bounds, require four strictly-formed coordinates before query construction.

## Output safety and user-generated content

- User-generated text is rendered as plain text by default.
- Do not use `dangerouslySetInnerHTML` for listing descriptions, provider bios, report details, or messages.
- Preserve readability with safe formatting (`whitespace-pre-wrap`, paragraph splitting), not HTML injection.
- Public company profile surfaces must project only intended public-facing organization fields.
- Any future rich-text requirement must define an explicit allowlist-based sanitization model first.

## Error handling contract

- User-facing errors must be bounded, actionable, and non-sensitive.
- Do not return raw backend exception text directly to users.
- Security-sensitive failures must fail closed (no silent success fallbacks).
- Keep detailed diagnostics in server logs only, with secret/token redaction per `docs/security-baseline.md`.

## Upload and storage boundary rules

- Validate upload payload structure server-side (ids, paths, sort order, cover flags).
- Enforce max image count and deterministic owner/listing scoped paths.
- Enforce strict canonical listing image path shape (`owner/{owner_uuid}/listing/{listing_uuid}/{uuid}.{ext}`).
- Enforce strict canonical company logo path shape (`organization/{organization_uuid}/{uuid}.{ext}`).
- Validate accepted image content via file signature checks where upload code handles media files directly.
- Reject payloads with invalid/foreign storage paths before mutation.
- Do not rely on client ordering/cover assumptions without server normalization.

## Enum/status hardening rules

- Status and action fields must use explicit allowlists:
  - provider lifecycle statuses
  - moderation actions (`hide`/`unhide`)
  - report reasons and moderation filters
  - listing type/property type/contact preference values
- Keep UI options and server allowlists aligned; server allowlists are source of truth.

## What future PTs must preserve

- Strict parser behavior for explore/map query params and bounds.
- Runtime payload guards on sensitive server actions (messaging, moderation, provider mutations, favorites).
- Slug/UUID route validation short-circuit behavior.
- Safe text rendering defaults across public and authenticated surfaces.
- Generic user-safe error messaging for backend failures.
- Company ownership/membership resolution must continue to come from persisted organization membership data, not client role toggles.
- Company invite and membership mutations must continue to use server-side validated identifiers (no client-only role/member authority assumptions).

## Deferred from SH-PT04

- Full storage subsystem redesign and deep object-lifecycle automation (handled in later security/storage PTs).
- Adaptive abuse controls beyond baseline SH-PT06 server-side throttling.
- Advanced observability alerting/retention automation beyond SH-PT08 baseline audit capture.
