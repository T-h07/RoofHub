# Public Home Page Foundation (NM-PT09)

## Scope Added

The public `/` route is now a product-facing landing page built on the existing NestMap shell and design system.

Included sections:

- hero with clear marketplace positioning (rent, buy, map-first discovery)
- main search CTA module with intent + location inputs
- browse-by-intent entry cards
- featured/new listing preview cards (placeholder data only)
- provider-focused CTA section

## Placeholder and Data Assumptions

- The featured/new listing cards are intentionally placeholder previews for layout and component validation.
- No live listing fetch is wired in this PT.
- Search CTA submits to `/explore` with query params (`intent`, `location`) so future explore data logic can read these values directly.

## Integration Hooks for PT10+

- Replace placeholder listing arrays in `src/components/home/featured-listings-section.tsx` with live listing queries.
- Keep current card composition as the baseline contract for real listing cards, then enrich with real fields (image, status, badges, metrics).
- Connect `/explore` query-state handling to the homepage search form contract.
- Optionally promote shared home listing card pieces into broader listing UI components if explore/map pages converge on a single card variant.
