# Upload and Storage Hardening (SH-PT05)

## Purpose

This document defines the media security contract for RoofHub listing images.

SH-PT05 hardens the upload/storage lifecycle so file handling is deterministic, ownership-aware, and harder to abuse.

## Media lifecycle map

Authoritative flow for listing photos:

1. Provider selects files in wizard photos step.
2. Client pre-validates selection count/type/size and duplicate local picks.
3. Upload helper validates file metadata and checks binary signature (JPEG/PNG/WEBP magic bytes).
4. Upload helper generates canonical object path:
   - `owner/{owner_id}/listing/{listing_id}/{uuid}.{ext}`
5. File uploads to private Supabase bucket `listing-images` using `upsert: false`.
6. Photos step sync action validates payload shape, ownership/path binding, and cover/order normalization.
7. `listing_images` rows are rewritten for the listing in normalized order.
8. Removed object paths are cleaned from storage with ownership-scoped path validation.
9. Signed URLs are regenerated for draft/editor surfaces.

## Allowed file types and size limits

- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- Max single-file size: `10MB`
- Max photo count per listing: `20`

Enforcement model:

- UI picker restrictions are UX only.
- Upload helper validates type/size and binary signature.
- Bucket-level MIME/size limits remain enforced by Supabase.

## Object path convention

Canonical storage path:

- `owner/{owner_id}/listing/{listing_id}/{uuid}.{jpg|jpeg|png|webp}`

Rules:

- Owner and listing segments must be UUIDs.
- Filename must be generated UUID-based; client-provided filenames are never canonical.
- Paths are length-bounded and whitespace/path-abuse patterns are rejected.
- Path ownership is revalidated before delete/metadata sync.

## Bucket exposure model

- Bucket: `listing-images`
- Visibility: private (`public = false`)
- Rendering uses signed URLs for permitted contexts.

Public listing pages can display listing images through signed retrieval paths, but raw bucket objects are not globally public.

## Storage policy contract

Storage policies must preserve:

- no public write access
- insert/delete only for owned listing paths (or explicit admin path)
- path validation via `public.is_valid_listing_image_path`
- visibility-aligned select access
- no default object update policy for `listing-images` (insert + delete flow reduces overwrite ambiguity)

## Ownership and mutation guardrails

- Provider identity is derived from authenticated session/profile, not client owner claims.
- Photo sync payloads are validated against draft listing owner and listing id.
- Cross-owner and cross-listing path references are rejected server-side.
- Cover and ordering updates are normalized server-side; malformed payloads fail closed.

## Overwrite strategy

- Normal upload flow is append/new-object (`upsert: false`).
- Image replacement means new object path + metadata sync, not same-key overwrite.
- Storage object update paths are intentionally constrained to avoid ambiguous same-path content swaps.

## Cleanup and failure behavior

Photo sync targets deterministic behavior:

- DB metadata rewrite is attempted atomically at action level.
- If rewrite insert fails after reset, previous metadata snapshot is restored.
- Removed object cleanup runs after metadata success and is ownership-scoped.
- Cleanup failures surface an explicit warning message; they are never silent.

Failure scenarios to preserve:

- upload succeeds, metadata sync fails: action returns bounded error and UI remains recoverable
- metadata rewrite insert fails: previous listing image metadata is restored
- storage cleanup fails for removed files: warning is returned, retry is allowed

## What future PTs must preserve

- Private-bucket + signed URL model unless product requirements explicitly change.
- Strict owner/listing-scoped path convention.
- No trust in client-provided filename/path identity.
- Binary-signature-aware type validation before upload.
- `upsert: false` default upload behavior.
- Explicit cleanup warnings for partial storage-delete failures.

## Deferred from SH-PT05

- malware scanning pipeline
- background reconciliation jobs for long-tail orphaned storage objects
- advanced media transformations/variants pipeline
