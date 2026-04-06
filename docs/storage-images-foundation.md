# Storage and Image Upload Foundation (NM-PT06)

This document defines the storage model established by PT06.

## Bucket Strategy

- Bucket id/name: `listing-images`
- Visibility: **private**
- Max file size: `10MB` (`10485760` bytes)
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`

Rationale:

- Draft listing images should not be publicly reachable by static URL.
- Access to objects must align with listing visibility and ownership rules.
- Public listing pages can still render images via signed/authenticated retrieval in future PTs.

## Object Path Convention

Canonical path pattern:

- `owner/{owner_id}/listing/{listing_id}/{generated_filename}`

Example:

- `owner/11111111-1111-4111-8111-111111111111/listing/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/4f7c2e18-6f8e-4a93-8b4d-4d7424d4812a.jpg`

Rules:

- owner/listing IDs must be UUIDs
- file extension must be `jpg|jpeg|png|webp`
- filenames are generated UUID-based values (no user filename uniqueness assumptions)
- normal flows should use new unique paths, not overwrite/upsert

## Storage Policies

Implemented via:

- `supabase/migrations/20260406205032_nm_pt06_storage_images.sql`

Key behavior:

- `anon`/`authenticated` can `SELECT` only objects in `listing-images` where parent listing is visible by policy:
  - published listing, or
  - listing owner, or
  - admin
- `authenticated` can `INSERT/UPDATE/DELETE` only for objects whose path owner/listing matches an owned listing (or admin)
- public/anon writes are blocked
- cross-owner path writes are blocked

## App-Side Foundation

Core modules:

- `src/lib/storage/listing-images.ts`
  - constants (bucket, size, mime, max count)
  - file validation helpers
  - deterministic path generator/parser
  - cover/order normalization
  - DB row payload mapping for `listing_images`
- `src/lib/supabase/storage/listing-images.ts`
  - upload helper(s)
  - signed URL helper for private bucket retrieval
  - object cleanup helper(s)
  - DB + storage cleanup sync helper
- `src/hooks/use-listing-image-upload-state.ts`
  - local preview state
  - object URL lifecycle cleanup
  - cover image selection
  - deterministic ordering and reorder support
  - pending deletion queue for safe cleanup flows

## Cover and Ordering Model

- Steady-state target: exactly one cover image per listing.
- First image defaults to cover when none exists.
- Reordering keeps `sort_order` sequential from `0..n-1`.
- Cover state is normalized after add/remove/reorder operations.

## Validation Rules

- Supported types: JPEG, PNG, WEBP
- Max single-file size: 10MB
- Max image count per listing: 20
- Empty files and duplicate local selections are rejected

Validation runs client-side for immediate UX and is also constrained by bucket MIME/size limits.

## Cleanup Strategy

- Removed images are queued by storage path (`pendingDeletionPaths`) in upload state.
- Cleanup should call storage object delete helpers, then delete matching `listing_images` rows.
- Deletion is ownership-safe via storage/object policies plus listing-image RLS.

Failure handling direction:

- if storage delete fails, do not delete DB row
- if DB row delete fails after storage delete, surface error and reconcile on next edit cycle

## Notes for PT07+

- PT07 can plug auth-aware listing create/edit flows into these helpers without redesigning path or policy strategy.
- Public listing pages should use signed/authenticated URL retrieval for private bucket content.
