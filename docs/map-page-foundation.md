# Map Infrastructure and Public Map Page (NM-PT12)

This document describes the first production map foundation for NestMap.

## Route

- Route: `/map`
- Public and server-rendered shell.
- Consumes the same URL-driven discovery state model as `/explore`.

## Map Library and Runtime Strategy

- Map rendering uses MapLibre via:
  - `maplibre-gl`
  - `react-map-gl/maplibre`
- Browser-only map runtime is isolated in:
  - `src/components/map/public-listings-map.tsx` (`"use client"`)
- Server page (`src/app/map/page.tsx`) handles search param parsing and public listing data fetch.

## Environment Configuration

Required env value:

- `NEXT_PUBLIC_MAP_STYLE_URL`

Config helper:

- `src/lib/config/map.ts`

Behavior:

- validates `NEXT_PUBLIC_MAP_STYLE_URL` as a URL
- returns a clean configuration error state on `/map` if missing/invalid
- keeps style URL deployment-safe for local, Vercel Development, Preview, and Production

## Public Listing Marker Data

Server map query:

- `src/lib/listings/public-map.ts`

Public visibility guarantees:

- published listings only (`listing_status = 'published'`)
- respects existing RLS/public listing model
- excludes `public_location_mode = 'hidden'` from map marker output

Filter model alignment:

- `/map` parses URL state with `parseExploreSearchParams` (same as `/explore`)
- query filters are applied through shared helper:
  - `src/lib/listings/public-listing-filters.ts`

## Marker and Popup Transformation

Marker payload normalizes:

- id/slug/title
- listing type + property type
- price/currency
- city/neighborhood
- bedrooms/bathrooms/area
- latitude/longitude
- public location mode
- signed cover image URL fallback

Map interaction implemented:

- click/tap marker to open popup
- compact popup preview with:
  - image fallback
  - price
  - title
  - city/neighborhood
  - key facts
  - “Open in list” action
- popup keeps detail-page affordance lightweight until PT14

## UX and State Coverage

- route-level loading: `src/app/map/loading.tsx`
- route-level error boundary: `src/app/map/error.tsx`
- in-map initialization overlay while map surface loads
- in-map retry state for runtime map load failure
- empty-state handling when no mapped listings match current URL filters

Mobile behavior:

- touch-friendly marker buttons and controls
- constrained popup footprint
- map-first layout with responsive height and readable toolbar actions

## Discovery System Alignment

- `/explore` now includes a map-view action preserving active URL filter state
- `/map` includes a list-view action preserving URL filter state
- query model remains URL-first and shareable across both routes

## PT13 Extension Path

PT13 should build on this foundation by:

- adding bounds/viewport params to the shared URL state contract
- implementing “search this area” on top of the existing server query helper structure
- introducing clustering without replacing marker/popup data normalization
- coordinating map/list selection and pagination behavior using shared query primitives
