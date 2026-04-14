# Authorization Boundary Audit (SH-PT03)

## Purpose

This document captures the enforced authorization model for RoofHub after SH-PT03.
It defines who can access or mutate which objects, and which checks must remain in app code vs RLS.

## Role and actor model

- `seeker`: can browse public listings, save favorites, create listing-bound conversations as a participant, send/read messages in participant threads, submit listing reports.
- `provider`: can manage only their own listings and listing photos, publish/pause/archive/sell/rent only their own listings, participate in listing-bound conversations where they are the provider participant.
- `admin`: can access moderation surfaces and moderation actions; is not implicitly treated as a provider owner in provider listing management flows.

Provider account classification (foundation for NM-PT31):

- `profiles.role` remains the coarse role boundary (`seeker` / `provider` / `admin`).
- `profiles.provider_account_type` distinguishes provider shape:
  - `individual`: provider acts as an individual account.
  - `company`: provider acts through an owned company workspace.
- Company ownership authority is derived from `organization_members` with `role = 'owner'` and `member_status = 'active'`.

## Route-level access boundaries

- Public routes:
  - `/`, `/explore`, `/map`, `/listing/[slug]`
  - `/companies/[slug]`
  - Public listing data must remain constrained to `listing_status = 'published'`.
- Authenticated routes:
  - `/favorites`, `/messages`, `/profile`
- Provider-scoped routes:
  - `/dashboard`, `/dashboard/listings`, `/dashboard/listings/new`, `/dashboard/listings/[id]/edit`
  - Provider role is required; ownership checks still apply in every mutation/read query.
- Admin-scoped route:
  - `/admin/moderation`
  - Admin role is required server-side.

Route protection improves UX but is not an authorization substitute.

## Object-level authorization rules

### Listings and listing images

- Provider listing reads and mutations are owner-scoped (`owner_id = authenticated profile id`).
- Listing status transitions from provider flows are owner-scoped.
- Provider code paths do not grant admin cross-owner lifecycle mutation by default.
- Admin-controlled states (for example `hidden_by_admin`) cannot be set/cleared from provider flows.

### Organizations and organization members (NM-PT31 foundation)

- Organization records are not directly user-insertable from client context; bootstrap runs through a trusted server path.
- Company workspace bootstrap is atomic:
  - create `organizations` row
  - create `organization_members` owner row
  - upgrade profile provider mode to company path
- Organization reads are membership-scoped (active member) or admin-scoped.
- Organization/member mutation is owner-scoped (active owner) or admin-scoped.
- App-layer ownership checks must continue to use persisted membership state, never client-supplied company flags.
- Company profile editing (`/profile/company/edit`) is owner-scoped and server-enforced.
- Company branding media mutation (company logo upload/remove) is owner-scoped and backed by canonical storage path policies.
- Public company profile reads are constrained to active organizations and published listings.

### Favorites

- Favorite create/delete/read operations are scoped to the authenticated user id.
- Favoriting requires listing visibility rules compatible with public listing exposure.

### Reports and moderation

- Report creation is authenticated and user-scoped.
- Moderation queue/actions are admin-only.
- Admin hide/unhide transitions must remain server-enforced and separate from provider lifecycle actions.

## Messaging participant boundaries

- Conversation creation derives participants from server-side state:
  - provider participant from listing owner
  - seeker participant from authenticated profile
- Listing id alone is not authority to read/write a conversation.
- Thread reads, message sends, and read-state updates require participant membership checks.
- Conversation list/thread loaders must not leak non-participant conversations.
- Admin is intentionally blocked from normal participant inbox surfaces in app-layer messaging context.

## Public/private visibility boundaries

- Public discovery/detail surfaces expose published listings only.
- Public company profile surfaces expose active organizations only.
- `draft`, `paused`, `archived`, `sold`, `rented`, and `hidden_by_admin` must not appear in public explore/map/detail/favorites results.
- Provider internal surfaces can show owner-managed lifecycle states, including moderation-hidden status visibility for the owner.

## RLS and app-layer responsibility split

- RLS remains mandatory trust boundary for table-level access.
- App-layer checks are mandatory for:
  - route-level role gating
  - object ownership checks before mutation
  - participant checks for messaging behavior
  - explicit not-found/forbidden behavior control
- Neither layer is optional:
  - do not rely only on route/UI checks
  - do not rely only on app checks while bypassing RLS assumptions

## BOLA/BFLA guardrails

When changing sensitive actions or queries:

- Never mutate fetched objects by id without ownership/participant verification.
- Never trust client-supplied `owner_id`, `provider_id`, `seeker_id`, or role claims.
- Never expose admin/provider functions through generic authenticated paths.
- Fail closed for unauthorized access (`forbidden` or bounded `not found` as appropriate).

## Validation notes (SH-PT03)

Validated in this PT:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --package-lock-only --omit=dev --audit-level=high`

Targeted hardening outcomes:

- provider listing management queries/actions are now strictly owner-scoped
- admin is no longer implicitly treated as provider owner in provider listing flows
- messaging thread/list/read paths now enforce participant checks in app layer

## What future PTs must preserve

- Provider role checks do not imply cross-owner access.
- Admin capabilities stay explicit and moderation-scoped unless a separately approved feature extends scope.
- Messaging access remains participant-only.
- Public listing surfaces remain published-only by default.
- Any authorization model changes require updates to this document, `docs/security-baseline.md`, and `docs/security-checklist.md`.
- Future company member invites/roles must extend this document before merge.
