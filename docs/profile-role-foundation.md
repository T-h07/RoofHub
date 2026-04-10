# Profile and Role Foundation (NM-PT08)

This document summarizes profile bootstrapping, role handling, and role-aware shell behavior.

## Profile Bootstrap Strategy

Profile creation is now enforced through a backend-safe, idempotent path:

- auth actions (sign-in/sign-up/callback) still call profile ensure logic
- app shell loading (`AppShell`) resolves the authenticated user profile with `getCurrentUserProfile`
- if profile row is missing, the app creates it safely and re-fetches it
- profile fetch reads are compatibility-safe across full/channel-compatible/legacy column sets
- insert conflict (`23505`) is treated as an idempotent race and validated through a re-fetch

This keeps authenticated users from ending up with an identity but no usable `profiles` row.

## Role Model

Supported roles:

- `seeker`
- `provider`
- `admin`

Defaults and safety:

- new profile inserts default to `seeker`
- admin is never exposed as a user-editable option in public profile UX
- role checks are centralized under `src/lib/auth/roles.ts`

## RLS Hardening (PT08)

Migration added:

- `supabase/migrations/20260406234510_nm_pt08_profiles_role_hardening.sql`

Policy changes:

- self profile insert requires `role = 'seeker'`
- self profile update allows only `role in ('seeker', 'provider')`
- admin behavior remains covered by existing admin policy path

This closes direct self-escalation to `admin` from browser-facing clients.

## Editable Profile Fields (Current Phase)

`/profile` supports editing:

- `display_name`
- `bio`
- `phone`
- `contact_methods`
- `preferred_contact_method`
- `contact_email`
- `whatsapp_phone`
- `viber_phone`
- role selection between `seeker` and `provider` for non-admin accounts
- profile photo upload/change/remove via secure storage pathing (`profile-avatars` bucket)

Not included in this PT:

- advanced account security settings
- full provider onboarding

## Role-aware Account Hub

`/profile` now behaves as an identity-first account hub instead of a flat settings form:

- upgraded profile hero with role-aware copy and completion summary
- circular profile photo UX (upload/change/remove) replacing raw avatar URL input
- role-adaptive seeker/provider emphasis and helper text
- stronger sectioning for profile identity, contact channels, role visibility, and account controls
- destructive-danger-zone flow with typed confirmation and server-side hard-delete handling

## Profile Photo Upload Reliability

Profile photo upload depends on migration-backed storage configuration:

- bucket: `profile-avatars`
- strict object-path + owner policies from:
  - `supabase/migrations/20260410193000_nm_pt_profile_avatar_storage.sql`

If this migration is not applied on the target project, profile photo uploads fail by design.

## Hard Delete Account Flow

`/profile` now includes a real hard-delete path:

- confirmation requires typed `DELETE`
- email re-confirmation is required when account email exists
- delete logic derives actor from authenticated server session (no client user-id trust)
- privileged operations run server-side via service-role client only
- flow removes:
  - owned listing images in storage
  - profile avatar storage objects
  - actor/target/listing/conversation/report-linked security audit rows
  - auth user (which cascades profile/listings/favorites/conversations/messages/reports via FK rules)
- Supabase auth cookies are cleared after delete finalization to avoid stale local session state

Operational requirements:

- `SUPABASE_SERVICE_ROLE_KEY` must be configured on the server runtime (`.env.local` for local dev, Vercel env vars for deployed environments)
- delete-account uses server-only admin operations and intentionally fails if this env is missing
- when missing, the action returns a controlled operational error message (no secrets, no stack traces)

## Role-Aware Navigation

Desktop and mobile navigation now adapt by trusted profile role:

- guest: Home, Explore, Map (+ auth entry points)
- seeker: Home, Explore, Map, Favorites, Messages, Profile
- provider/admin: seeker nav + Dashboard

Role-aware visibility is UX only; backend security remains enforced by RLS.

## Known Limits / PT09 Notes

- provider role selection is lightweight and not yet tied to onboarding requirements
- no admin dashboard surface is introduced in PT08
- PT09 can build role-specific dashboard and route grouping on top of this profile/role baseline
