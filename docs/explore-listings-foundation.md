# Explore/List View Foundation (NM-PT10)

This document summarizes the first production browse experience for public listings.

## Public Browse Route

- Public route: `/explore`
- The route is integrated into existing shell/navigation and remains guest-accessible.

## Fetching Strategy

- Server-first rendering in `src/app/explore/page.tsx`.
- URL query params are parsed server-side and translated into a server-side Supabase query.
- Query logic is centralized in `src/lib/listings/public-explore.ts`.
- Interactive controls (sort/filter changes) are client components that update URL params; data fetching stays server-owned.

## Public Listing Visibility Rules

- Explore fetches from `public.listings` with `listing_status = 'published'`.
- This aligns with PT05 RLS behavior and avoids leaking draft/paused/archived listings.
- Card data payload is intentionally scoped to browse needs (title, price, location, key facts, cover image metadata).

## Card Foundation

- Reusable card component: `src/components/listings/listing-card.tsx`.
- Supports:
  - cover image with signed URL fallback behavior for private bucket assets
  - listing type and property type labels
  - title, price, city/neighborhood, bedrooms/bathrooms/area
  - clear status affordance for future detail-page handoff

## Basic Filters and Sort

Implemented URL-driven controls:

- Sort:
  - `newest` (default)
  - `price_asc`
  - `price_desc`
- Filters:
  - `listingType` (`rent` / `sale`)
  - `propertyType`
  - `city`

Compatibility aliases for existing homepage CTAs:

- `intent` -> `listingType`
- `location` -> `city`

## Pagination Choice

- PT10 uses URL-driven pagination (page query param), not infinite scroll.
- Rationale:
  - SSR-friendly and stable with App Router
  - shareable URLs
  - predictable state for upcoming PT11 filters and PT12/PT13 map/list coordination

## Explore States

- Loading skeleton route boundary: `src/app/explore/loading.tsx`
- User-safe error boundary: `src/app/explore/error.tsx`
- Empty states for:
  - no matched listings
  - out-of-range pages
  - backend/query failure fallback

## PT11 Extension Path

PT11 should build on this foundation by extending, not replacing:

- `src/lib/listings/explore-search-params.ts` for richer URL filter parsing
- `src/lib/listings/public-explore.ts` for advanced query composition
- `src/components/explore/explore-results-shell.tsx` for expanded filter controls
- existing pagination/sort/filter URL contracts to preserve shareable browse state

