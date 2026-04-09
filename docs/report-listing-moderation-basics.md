# Report Listing and Moderation Basics (PT24)

## Scope

PT24 adds the first real marketplace safety layer:

- listing report modal/form with persisted backend submission
- typed reason-code model shared by UI and server validation
- admin moderation starter route
- admin hide/unhide listing actions backed by real listing status updates

This milestone is intentionally a starter moderation surface, not a full trust-and-safety platform.

## Reporting Flow

User-facing report entry remains on listing detail CTA rail:

- `src/components/listings/listing-detail-cta-rail.tsx`
- `src/components/listings/report-listing-dialog.tsx`

Server action persistence:

- `src/lib/listings/detail-actions.ts`

Behavior:

- report submission requires an authenticated account
- guests are redirected to sign-in from report CTA
- report reason is validated against shared typed reason codes
- optional details are validated (max length + non-blank semantics)
- duplicate reports (`listing_id + reporter_id` unique key) are handled idempotently with a friendly success message
- self-reporting (owner reporting own listing) is blocked intentionally

## Reason Codes

Reason codes are centralized in:

- `src/lib/moderation/reporting.ts`

Current set (schema-aligned):

- `spam`
- `fraud`
- `duplicate`
- `incorrect_information`
- `inappropriate`
- `other`

These values map directly to `public.report_reason` and are reused across report UI labels and backend checks.

## Admin Moderation Route

Route:

- `/admin/moderation`

Files:

- `src/app/admin/moderation/page.tsx`
- `src/app/admin/moderation/loading.tsx`
- `src/components/moderation/admin-moderation-queue.tsx`
- `src/components/moderation/moderation-report-status-badge.tsx`
- `src/lib/moderation/access.ts`
- `src/lib/moderation/queries.ts`

Access model:

- route is auth-protected (added `/admin` to protected route prefixes)
- admin role is required server-side via `getAdminRouteContext(...)`
- non-admin users do not receive moderation controls

## Hide / Unhide Moderation Actions

Action implementation:

- `src/lib/moderation/actions.ts` (`updateListingModerationVisibilityAction`)

Rules:

- **Hide** sets listing status to `hidden_by_admin`
- **Unhide** removes moderation-hidden status and restores listing to:
  - `published` when prior publish timestamp exists
  - otherwise `draft` as safe fallback

This keeps public visibility controlled by listing status and avoids provider-side overrides of admin moderation state.

## Public Visibility Alignment

Public routes already rely on `PUBLIC_DISCOVERY_STATUS = "published"`:

- explore
- map
- listing detail
- favorites/public listing joins

Therefore, `hidden_by_admin` listings are excluded from public discovery by existing query/policy behavior once moderation hide is applied.

## UI and Architecture Notes

PT24 adds a dedicated moderation domain layer:

- `src/lib/moderation/types.ts`
- `src/lib/moderation/reporting.ts`
- `src/lib/moderation/access.ts`
- `src/lib/moderation/queries.ts`
- `src/lib/moderation/actions.ts`

This keeps reporting/moderation logic centralized and future-ready for deeper admin tooling.

## Next PT Handoff

Future moderation PTs can extend this baseline with:

- report status workflows (triage/resolution ownership)
- moderation history/audit trails
- richer queue filters and assignment views
- provider-facing moderation notices and appeal flows

without replacing the PT24 report persistence or listing visibility foundation.
