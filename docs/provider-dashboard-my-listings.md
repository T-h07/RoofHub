# Provider Dashboard and My Listings (PT19)

## Routes

- `/dashboard` (provider-only): portfolio overview, recent listings, lifecycle entry points
- `/dashboard/listings` (provider-only): full owned-listings management surface with status filters

Both routes use `getProviderRouteContext(...)` and keep role/ownership checks aligned with existing auth + RLS patterns.

## Real Dashboard Metrics

`loadProviderListingOverviewMetrics(...)` now returns real owned-listing counts for:

- total
- published (active)
- draft
- paused
- archived
- sold
- rented

`unreadLeadsPlaceholder` is intentionally a grounded placeholder (`0`) until messaging/leads PTs hydrate real unread counts.

## My Listings Data Model

`loadProviderManagedListings(...)` returns owner-scoped listing summaries plus signed cover image URLs for listing cards/table rows:

- title, listing type, property type
- price and currency
- city/neighborhood
- status
- created/updated timestamps
- cover image path + signed URL

## Lifecycle Actions in PT19

`updateProviderListingLifecycleStatusAction(...)` provides ownership-safe server mutations with transition guards:

- pause (`published -> paused`)
- set active (`paused -> published`)
- archive (`draft|published|paused -> archived`)
- mark sold (`published|paused -> sold`, sale listings)
- mark rented (`published|paused -> rented`, rent listings)

Transition rules remain centralized in `provider-wizard/status-transitions.ts`.

## Listing Status Foundation Extension

PT19 adds enum values to `listing_status`:

- `sold`
- `rented`

Migration: `supabase/migrations/20260409193500_nm_pt19_listing_status_lifecycle.sql`

## Duplicate Listing (Optional Scope)

Duplicate listing is intentionally deferred in PT19.

Reason:

- safe duplication requires tighter PT20 editing/status semantics (especially around cloned photo/location intent and publish readiness after clone).
- current PT19 focuses on clean lifecycle control and provider workspace foundations.

## Unread Leads Placeholder

Dashboard includes a dedicated unread-leads placeholder card/section with explicit copy that messaging is upcoming.
No fake lead counts are shown.

## PT20 Handoff

PT20 can now build on:

- provider dashboard route foundations
- status-aware owned-listings management UI
- centralized lifecycle transition mutation path
- sold/rented status model extension
- clear placeholder insertion point for real unread lead/inbox integration
