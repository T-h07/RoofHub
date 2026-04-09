# Listing Photos and Publish Flow (PT18)

This document defines how provider draft listings move from photo management to publish state.

## Scope

PT18 extends the existing provider wizard routes:

- `/dashboard/listings/new`
- `/dashboard/listings/[id]/edit?step=<wizard-step>`

Wizard steps now include:

- `basics`
- `pricing`
- `facts`
- `location`
- `amenities`
- `contact`
- `photos`
- `review`

## Photo Step Integration

Photo management is part of the same draft lifecycle, not a separate subsystem.

Photo step behavior:

- providers can add JPEG/PNG/WEBP files (PT06 rules)
- providers can remove photos
- providers can reorder photos (drag or move up/down)
- providers can set a single cover photo
- photo order and cover state persist to `listing_images`

Draft image state is handled in `use-listing-image-upload-state` and synced server-side with:

- `syncProviderListingPhotosAction`

This action:

- validates payload paths belong to the draft listing owner/listing id
- normalizes order + cover
- rewrites `listing_images` rows in stable order
- restores previous `listing_images` snapshot when rewrite insert fails
- cleans up dropped storage objects after successful metadata rewrite
- surfaces explicit cleanup warnings when object deletion is partial
- returns refreshed signed URLs for the wizard

## Cover Image Rules

Cover behavior is deterministic:

- one cover image is always selected when photos exist
- if no explicit cover is selected, first image becomes cover
- removing current cover reassigns cover during normalization

Public listing surfaces continue to prioritize `is_cover` first, then `sort_order`.

## Publish Readiness Rules

Drafts remain partial; publish requires stricter checks.

Readiness is evaluated via `evaluateProviderPublishReadiness` and enforced server-side by
`publishProviderListingDraftAction`.

Current publish blockers:

- basics invalid (title/description)
- pricing invalid or non-positive price
- facts invalid (including required area/city)
- location invalid (pin + public location mode)
- no photos
- no cover photo

Review step shows blockers and links back to the blocked wizard steps.

## Draft -> Published Transition

Publish mutation:

- validates provider ownership/access
- validates publish readiness
- checks status transition safety with `canTransitionProviderListingStatus`
- updates listing:
  - `listing_status = 'published'`
  - `published_at = now()`
  - `archived_at = null`

Status transitions are centralized in:

- `src/lib/listings/provider-wizard/status-transitions.ts`

Current allowed map:

- `draft -> published | archived`
- `published -> paused | archived`
- `paused -> published | archived`
- `archived -> (none)`

## Post Publish Destination

After successful publish, the wizard redirects to:

- `/listing/[slug]`

This gives providers an immediate public confirmation surface for the live listing.

## PT19/PT20 Extension Points

PT19/PT20 can build on:

- centralized transition policy in `status-transitions.ts`
- reusable publish readiness model in `publish.ts`
- persisted ordered/cover photo model in `listing_images`
- server actions:
  - `syncProviderListingPhotosAction`
  - `publishProviderListingDraftAction`

Expected next extensions:

- dashboard controls for additional transitions (`published`, `paused`, `archived`)
- listing management views for status changes without reworking PT18 publish logic
- richer provider media management on top of the existing photo persistence model
