# Row Level Security Policies (NM-PT05)

This document summarizes the PT05 authorization layer implemented in:

- `supabase/migrations/20260406161024_nm_pt05_rls_policies.sql`

## Security Baseline

- RLS is enabled on all user-facing MVP tables:
  - `profiles`
  - `listings`
  - `listing_images`
  - `favorites`
  - `conversations`
  - `messages`
  - `listing_reports`
- Authorization is enforced in Postgres policies, not UI logic.
- Browser-facing clients are expected to use `anon` and `authenticated` roles only.

## Admin Role Strategy

- Central helper function: `public.is_admin()`.
- Admin status is derived from `public.profiles.role = 'admin'` for `auth.uid()`.
- Function is `security definer` to avoid RLS recursion and keep policy logic consistent.

## Policy Behavior by Table

### `profiles`

- No public (`anon`) profile reads.
- Authenticated users can select/insert/update only their own row.
- Admin can select/insert/update/delete any profile row.

Note: profile fields include potentially sensitive values (`phone`, `bio`), so public profile reads are intentionally deferred until a narrower public profile surface is introduced.

### `listings`

- `anon` and `authenticated` users can read only `listing_status = 'published'`.
- Owners can read all their own listings (including draft/paused/archived).
- Owners can insert/update/delete only their own listings (`owner_id = auth.uid()`).
- Admin has full listing access.

### `listing_images`

- `anon` and `authenticated` can read images only when parent listing is visible by policy (published, owned, or admin-visible).
- Insert/update/delete allowed only for listing owner or admin.

### `favorites`

- Authenticated users can read only their own favorites.
- Insert allowed only for own `user_id` and listings visible to that user by policy.
- Delete allowed for own rows; admin delete/select is explicitly allowed.

### `conversations`

- Select allowed only for participants (`provider_id` or `seeker_id`) or admin.
- Insert allowed for admin, or seeker-initiated listing contact only:
  - `seeker_id = auth.uid()`
  - provider matches listing owner
  - listing is `published`
  - requester profile role is seeker
- Update allowed for participants/admin.
- Delete restricted to admin.

### `messages`

- Select allowed only for conversation participants or admin.
- Insert allowed only when `sender_id = auth.uid()` and sender belongs to parent conversation (or admin).
- Update allows admin and participant read-state updates (guarded by trigger-level immutability checks).
- Delete restricted to admin.

### `listing_reports`

- Authenticated users can insert reports only as themselves (`reporter_id = auth.uid()`) and only for listings visible by policy.
- Reporters can read their own reports.
- Admin can read/update/delete all reports.

## Storage Policy Status (PT06)

PT06 now implements storage access control on `storage.buckets` and `storage.objects` for listing images.

See:

- `docs/storage-images-foundation.md`

for bucket choice, object path conventions, and upload/delete policy behavior.

## PT05 Validation Snapshot

Local SQL validation covered:

- anon reads published listings only, not drafts
- owner reads and updates own draft listing
- non-owner cannot update another owner listing
- favorites are self-only
- conversation/message reads are participant-only
- non-participant message insert is blocked by RLS
- authenticated user can submit listing report
- admin can review and update reports
