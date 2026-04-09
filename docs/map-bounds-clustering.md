# Map Bounds, Clustering, and Search This Area (NM-PT13)

This document describes the PT13 map-discovery upgrade built on top of PT12.

## Route and Discovery Alignment

- Route: `/map`
- Public and server-rendered.
- Reuses the PT11 discovery model (`parseExploreSearchParams`) for non-geo filters.
- Does not create a second map-only filter system.

## Bounds State Model

Map bounds are represented with a typed shape:

- `MapSearchBounds` in `src/lib/listings/map-bounds.ts`
  - `west`, `south`, `east`, `north`

Map-specific URL parameter:

- `bbox=west,south,east,north`

Utilities in `src/lib/listings/map-bounds.ts`:

- parse/validate `bbox`
- serialize normalized bounds
- compare pending viewport vs applied bounds (`areBoundsMeaningfullyDifferent`)

## Server Query Behavior

Server map query remains centralized in:

- `src/lib/listings/public-map.ts`

PT13 addition:

- `loadPublicMapListings(state, { bounds })`
- when bounds are present, query applies:
  - `longitude >= west`
  - `longitude <= east`
  - `latitude >= south`
  - `latitude <= north`

Public visibility constraints remain unchanged:

- `listing_status = 'published'`
- `public_location_mode != 'hidden'`
- shared PT11 filters still apply through `applyPublicListingFilters`

## Clustering Configuration

Map rendering and cluster logic are in:

- `src/components/map/public-listings-map.tsx`

PT13 cluster setup uses MapLibre source clustering:

- GeoJSON source with `cluster: true`
- `clusterRadius: 52`
- `clusterMaxZoom: 14`

Cluster layers:

- cluster circles (`listing-clusters`)
- cluster count labels (`listing-cluster-count`)
- unclustered points (`listing-points`)
- unclustered point labels (`listing-point-labels`)

Cluster interaction:

- clicking cluster circle/count expands to cluster zoom (`getClusterExpansionZoom`)
- single listing points keep popup interaction

## Search This Area Flow

The map does not refetch on every pan/zoom.

Behavior:

- viewport movement updates pending bounds state on `moveend`
- when bounds differ meaningfully from last applied bounds, UI shows `Search this area`
- applying search writes `bbox` to URL and resets `page`
- `Search all visible areas` clears `bbox` from URL while preserving other filters

This keeps refresh/share/back-forward behavior predictable.

## Result Count and Split Layout

`src/app/map/page.tsx` now:

- parses `bbox` from search params
- applies bounds in server query
- shows applied result status/count summary
- preserves URL state for retry and map/list navigation

Desktop refinement:

- map + results split layout
- right pane uses `src/components/map/map-results-pane.tsx`
- list pane mirrors applied map result set and keeps scanning fast

Mobile behavior:

- map-first surface remains primary
- search-this-area controls stay touch-friendly
- list access is kept lightweight via list-view actions

## Loading, Empty, and Error States

PT13 keeps explicit states:

- map surface initialization overlay
- runtime retry state for style/runtime failures
- empty states for:
  - no mapped results in applied bounds
  - no mapped inventory yet

## PT14 Extension Path

PT14 can build directly on this foundation by:

- replacing list/popup “Open in list” affordances with listing detail routing (`/listing/[slug]` or equivalent)
- adding selected-listing synchronization between desktop split list and map marker/popup state
- preserving `bbox` + shared filters while deep-linking into detail and returning to map context
