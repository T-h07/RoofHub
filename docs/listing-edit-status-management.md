# Listing Edit and Status Management (PT20)

## Route and Access

- Edit route: `/dashboard/listings/[id]/edit`
- Access uses the existing provider route context and owner/admin scoped listing query checks.
- Guests are redirected through auth gating.
- Non-provider users see provider-access guidance.
- Non-owners cannot load another provider’s listing editor.

## Edit Flow Strategy

PT20 reuses the existing provider wizard foundation from PT16–PT18 instead of introducing a second edit form stack.

- The edit route hydrates wizard values from the existing listing record.
- The same step validators and save actions are reused for detail updates.
- The same photo-management flow from PT18 is reused for add/remove/reorder/cover.

This keeps create/edit behavior consistent and future PT extensions centralized.

## Provider-Controlled Status Model

Status values now handled in the provider maintenance flow:

- `draft`
- `published`
- `paused`
- `rented`
- `sold`
- `archived`
- `hidden_by_admin` (admin-controlled)

Migration:

- `supabase/migrations/20260409211500_nm_pt20_listing_status_hidden_by_admin.sql`

## Transition Rules (Provider Controls)

Transition rules remain centralized in:

- `src/lib/listings/provider-wizard/status-transitions.ts`

Current provider-controlled transitions:

- `draft -> published | archived`
- `published -> paused | archived | sold | rented`
- `paused -> published | archived | sold | rented`
- `archived -> draft`
- `sold -> archived`
- `rented -> archived`
- `hidden_by_admin -> (no provider-controlled transitions)`

Additional guard:

- provider mutation action explicitly rejects attempts to set `hidden_by_admin`.

## Hidden by Admin Handling

`hidden_by_admin` is treated as moderation-controlled state:

- shown clearly in status badges and filter surfaces
- shown with explicit messaging in the edit route
- provider can still update listing content/photos
- provider cannot clear moderation-hidden status from provider actions
- publish action from hidden-by-admin state is blocked with explicit feedback

## Public Visibility Rules

Public discovery remains tied to published state only:

- explore/list/detail/favorites/report visibility checks use the same public discovery status constant
- non-published statuses (`draft`, `paused`, `sold`, `rented`, `archived`, `hidden_by_admin`) are not exposed in public listing queries

Visibility utility:

- `src/lib/listings/visibility.ts`

## Published Edit Safety

PT20 hardens edit behavior so active listings are not silently broken:

- published listing pricing cannot be saved with `price <= 0`
- published listings cannot save photo state with zero images
- published listings cannot save photo state without a cover image

This preserves public listing integrity while still allowing ongoing maintenance.

## Dashboard and My Listings Integration

PT20 extends PT19 provider management with hidden moderation support:

- status badges include `hidden_by_admin`
- status filters include `hidden_by_admin`
- overview metrics include `hiddenByAdmin`
- lifecycle action menu reflects transition availability and moderation lock state

## Next PT Handoff

Future PTs can build on this without replacing it:

- admin moderation UI can own `hidden_by_admin` transitions on top of existing status model
- messaging/leads can connect to existing provider edit/dashboard surfaces
- additional lifecycle actions can extend centralized transition helpers and mutation actions
