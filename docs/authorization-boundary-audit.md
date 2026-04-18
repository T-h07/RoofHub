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
  - `/dashboard`, `/dashboard/listings`, `/dashboard/listings/new`, `/dashboard/listings/[id]/edit`, `/dashboard/listings/[id]/workflow`
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

### Company listing ownership model (NM-PT34 foundation)

- Listings now support dual ownership mode:
  - individual listing: `organization_id` is `null`
  - company-owned listing: `organization_id` references an active organization workspace
- Listing actor attribution is explicit:
  - `created_by_user_id` tracks the original creator
  - `assigned_agent_user_id` tracks current responsible agent when applicable
  - `published_by_user_id` tracks publish actor when applicable
- Server-side listing creation resolves company ownership from persisted profile + organization membership context, not client-submitted organization ids.
- Listings insert/update/delete RLS checks enforce:
  - provider ownership (`owner_id = auth.uid()`) or admin
  - active organization membership when `organization_id` is set
- Listing image read/write policies inherit the same organization-membership boundary for owner-scoped access on company-owned listings.
- Public company listing feeds are organization-aware (`organization_id`), with legacy fallback for older owner-scoped records.

### Company team invites and membership management (NM-PT33)

- Team invite creation is owner/admin-scoped and server-enforced.
- Invite targets are validated server-side for either:
  - explicit RoofHub user id, or
  - normalized email, with account linking supported at acceptance time.
- Invite acceptance is bound to authenticated identity:
  - target-user invites require `auth.uid()` match
  - email invites require signed-in primary email match
- Role, suspend/reactivate, and remove actions are owner/admin-scoped and server-enforced.
- Admin scope is intentionally constrained:
  - admin cannot assign owner/admin roles
  - admin cannot mutate/remove owner/admin members
- Owner continuity is protected:
  - role/status/remove paths cannot leave an organization without at least one active owner.
- Company team read surfaces distinguish active members, suspended members, and pending invites from persisted server-backed state.

### Company listing approval workflow V1 (NM-PT35)

- Company-owned listings now use enforced workflow statuses:
  - `draft`
  - `submitted_for_review`
  - `needs_changes`
  - `approved`
  - `published`
  - `unpublished`
- Workflow transitions are server-trusted through `transition_company_listing_workflow(...)`; client state is not authority.
- Submit-for-review is allowed for listing creator/assigned agent and reviewer-capable roles.
- Needs-changes, approve, publish, and unpublish are restricted to reviewer-capable roles (`owner`, `admin`, `manager`) or platform admin.
- Company listing inserts are constrained to `draft` status; invalid direct transitions are blocked through trigger-level enforcement.
- Public visibility remains `listing_status = 'published'`; `approved` is internal-only until an explicit publish action.
- Workflow timeline rows are persisted in `listing_workflow_events` and are readable only by active organization members or platform admins.

### Company dashboard and approval queue (NM-PT36)

- Company dashboard data is resolved from trusted server membership context (`getCurrentUserCompanyContext`) and not client-supplied organization identifiers.
- Dashboard metrics, pending-review queue, and activity feed use dedicated security-definer RPCs:
  - `get_company_dashboard_overview(...)`
  - `get_company_dashboard_pending_queue(...)`
  - `get_company_dashboard_activity_feed(...)`
- These RPCs require active organization membership (or admin role) before returning company-internal data.
- Pending-review queue actions remain reviewer-scoped in UI and server workflows (`owner`/`admin`/`manager`).
- Company workflow listing reads now use trusted RPC access (`get_company_listing_workflow_listing(...)`) so reviewer-capable members can access review surfaces without broadening generic listing read policies.
- Team-invite activity in dashboard feed is constrained to owner/admin membership visibility.

### Company permissions hardening (NM-PT40)

- Company permission checks are centralized through `src/lib/company/permissions.ts` and reused across team mutations, dashboard loaders, and workflow role derivation.
- Team invite/member mutations now enforce organization-scoped target resolution before RPC execution, reducing cross-company direct-object mutation risk.
- Team invite token reads now include app-layer access verification (invite target identity or active owner/admin membership), not RLS-only assumptions.
- Company pending-review queue RPC access is reviewer-scoped (`owner`/`admin`/`manager`) and no longer broadly available to all active members.
- Company workflow listing context reads are restricted to reviewer roles or listing-responsible actors (creator/assigned agent), not generic same-org membership.
- Workflow timeline table reads are restricted to reviewer roles or listing-responsible actors to reduce internal overexposure of review notes/history.
- Owner private listing reads now require active company membership when `organization_id` is set, preventing suspended/removed members from retaining owner-id private access.
- Listing image storage object read/write/delete owner paths now require active company membership for company-owned listings, closing suspended-owner residual media access.
- Invite-email visibility policy now uses server-trusted primary email resolution (`current_user_primary_email()`), avoiding JWT-claim trust assumptions.
- Listing update RLS now preserves immutable attribution fields (`owner_id`, `organization_id`, `created_by_user_id`, `published_by_user_id`) while allowing legitimate owner edits after reviewer publish actions.
- Organization-member RLS policies use helper-based owner/admin checks (`is_organization_owner_or_admin`) instead of self-referential policy subqueries, preventing company-context resolution failures.

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
