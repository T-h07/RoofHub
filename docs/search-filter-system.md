# Search and Filter System (NM-PT11)

This document describes the expanded discovery filter model built on top of PT10.

## Route

- Route: `/explore`
- Public and server-rendered.
- Discovery state is URL-driven and server-parsed.

## URL Parameter Scheme

Implemented query parameters:

- `q`: keyword search
- `city`: city filter (text)
- `neighborhood`: neighborhood filter (text)
- `listingType`: `rent | sale`
- `propertyType`: `apartment | house | studio | land | commercial`
- `priceMin`, `priceMax`: numeric price range
- `areaMin`, `areaMax`: numeric area range (`m²`)
- `bedsMin`: minimum bedrooms
- `bathsMin`: minimum bathrooms
- `furnished`, `parking`, `pets`, `availableNow`: boolean toggles (`1` when enabled)
- `sort`: `newest | price_asc | price_desc`
- `page`: pagination index

Compatibility aliases retained from PT09/PT10 CTAs:

- `intent` -> `listingType`
- `location` -> `city`

## Parsing and Validation Strategy

- URL parsing is centralized in `src/lib/listings/explore-search-params.ts`.
- Invalid or out-of-range values are sanitized to safe defaults/nulls.
- Empty/default values are omitted from generated URLs.
- Numeric ranges auto-normalize when `min > max`.
- Filters are treated as the source of truth only after URL parsing.

## Query Strategy

- Query logic is centralized in `src/lib/listings/public-explore.ts`.
- Listing visibility remains constrained to `listing_status = 'published'`.
- All PT11 filters are applied server-side in one query path.
- Keyword search is pragmatic MVP search across public listing text fields:
  - `title`
  - `description`
  - `city`
  - `neighborhood`
  - `property_type`

## Beds/Baths Interpretation

PT11 uses minimum-value semantics:

- `bedsMin`: listings with `bedrooms >= bedsMin`
- `bathsMin`: listings with `bathrooms >= bathsMin`

This favors practical browse behavior and keeps filter composition predictable.

## Available Now Interpretation

`availableNow` currently means:

- `available_from <= today`

Listings without an `available_from` value are excluded when this toggle is enabled.

## UI Behavior

- Desktop: persistent filter sidebar + search/sort/result toolbar.
- Mobile: filter sheet with same controls and explicit apply/clear actions.
- Active filters render as removable chips.
- Filter/sort changes reset pagination to page 1 to avoid stale-page empty states.

## PT12/PT13 Integration

Map/list integration now builds on this URL-driven state:

- `parseExploreSearchParams` remains the canonical non-geo filter contract
- shared public listing filter logic stays server-side authority
- PT13 adds optional map bounds via `bbox=west,south,east,north`
- `/map` combines `bbox` with the same PT11 filters instead of introducing a separate map-only filter model
- map-area application is explicit through a “Search this area” action (not auto-refetch on every movement)
