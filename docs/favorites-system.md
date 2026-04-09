# Favorites System (NM-PT15)

This document describes the persisted favorites flow implemented in PT15.

## Storage and Security Model

Favorites are stored in:

- `public.favorites`

Rules:

- source of truth is the database (not local storage)
- reads and writes are protected by existing RLS policies
- users can only manage their own favorites
- duplicate favorite rows are naturally blocked by `(user_id, listing_id)` key constraints

## Reusable Mutation Layer

Server action:

- `src/lib/listings/favorite-actions.ts`

Primary action:

- `setFavoriteStatusAction({ listingId, favorited })`

Behavior:

- requires authenticated session
- validates listing visibility (`listing_status = 'published'`)
- inserts/removes favorite row
- returns typed mutation result for optimistic UI rollback

## Reusable Toggle Component

Client component:

- `src/components/listings/favorite-toggle.tsx`

Used on:

- explore listing cards
- listing detail CTA rail

Guest behavior:

- guests are redirected to sign-in with `next` path preserved
- no fake local-only save state is shown as persisted

Optimistic behavior:

- UI flips immediately on tap/click
- on failure, state rolls back to previous value
- error feedback is surfaced without raw backend details

## Saved-State Integration

Explore query integration:

- `src/lib/listings/public-explore.ts`
- server fetch now enriches listing cards with `isFavorited` for authenticated viewers

Detail page integration:

- existing server detail loader keeps per-viewer `isFavorited` for single listing
- CTA rail uses `FavoriteToggle` for consistent behavior

## Favorites Page

Route:

- `/favorites` (authenticated)

Files:

- `src/app/favorites/page.tsx`
- `src/app/favorites/loading.tsx`
- `src/app/favorites/error.tsx`
- data helper: `src/lib/listings/favorites.ts`

Behavior:

- server-rendered favorite listings for current user
- supports removing saved items from the same page via toggle
- polished empty/loading/error states
- shows notice when some saved records are currently unavailable due to listing visibility changes

## PT16 Extension Path

PT16 can build on this foundation by:

- adding richer saved-list workflows (sorting/grouping/smart views) without changing persistence model
- reusing `FavoriteToggle` and `setFavoriteStatusAction` for additional discovery surfaces
- layering analytics/relevance features on top of persisted favorites rather than replacing them
