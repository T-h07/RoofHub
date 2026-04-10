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
- `preferred_contact_method`
- `avatar_url`
- role selection between `seeker` and `provider` for non-admin accounts

Not included in this PT:

- avatar file upload/storage workflow
- advanced account security settings
- full provider onboarding

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
