# Listing Detail Page (NM-PT14)

This document describes the public listing detail page introduced in PT14.

## Route

- Public route: `/listing/[slug]`
- Slug-driven and shareable.
- Invalid or unavailable slugs resolve to route-level `not-found`.

## Data Fetching Strategy

Server-first listing detail loading is centralized in:

- `src/lib/listings/public-listing-detail.ts`

Key behavior:

- fetches a single listing by `slug`
- enforces `listing_status = 'published'`
- relies on existing RLS/public visibility model
- includes typed listing payload, sorted image records, and signed image URLs

Additional state from the same loader:

- current viewer auth id (if any)
- whether listing is already favorited by that viewer
- owner/self-view state

## Detail Composition

Detail UI is modular and split by intent:

- `src/components/listings/listing-detail-summary.tsx`
- `src/components/listings/listing-image-gallery.tsx`
- `src/components/listings/listing-detail-facts.tsx`
- `src/components/listings/listing-location-map.tsx`
- `src/components/listings/listing-provider-card.tsx`
- `src/components/listings/listing-detail-cta-rail.tsx`

The route page is:

- `src/app/listing/[slug]/page.tsx`

Loading/not-found states:

- `src/app/listing/[slug]/loading.tsx`
- `src/app/listing/[slug]/not-found.tsx`

## Images

Gallery behavior:

- cover-first ordering
- responsive hero image with thumbnail strip
- robust fallback when signed URL is unavailable
- private bucket compatibility via signed URL generation

## Location and Privacy

Location rendering honors `public_location_mode`:

- `exact`: full map snippet + address when available
- `approximate`: map snippet with explicit approximation messaging
- `hidden`: no map pin preview; privacy-safe fallback state

Map snippet is intentionally lightweight and links to full `/map`.

## Provider Information

Provider surface uses only data available under current policy boundaries:

- attempts provider preview query via current RLS constraints
- if provider row is not publicly accessible, the card falls back to privacy-safe trust copy
- no private fields (for example phone) are exposed

## CTA Surfaces

Implemented CTA surfaces:

- Favorite CTA:
  - wired with server action toggle (`favorites` table)
  - guest flow prompts sign-in
- Contact CTA:
  - future-ready entry to `/messages` thread context
  - guest flow uses sign-in redirect to intended message path
- Report CTA:
  - wired with authenticated report submission (`listing_reports`)
  - guest flow prompts sign-in

Server actions:

- `src/lib/listings/detail-actions.ts`

Client CTA forms:

- `src/components/listings/favorite-listing-form.tsx`
- `src/components/listings/report-listing-dialog.tsx`

## Discovery Continuity

PT14 updates existing discovery surfaces to route into detail:

- explore listing cards now link to `/listing/[slug]`
- map popup and map side-pane now link to `/listing/[slug]`

## PT15 / PT21+ Extension Path

PT15 can build directly on the current favorite integration by:

- moving from single-page toggle to richer saved-collection UX
- adding optimistic favorite badges across explore/map/detail surfaces

PT21-PT23 can build directly on current contact entry points by:

- replacing placeholder `/messages` behavior with real conversation creation/open logic
- preserving existing `listingId` + `providerId` route intent carried from detail CTA
