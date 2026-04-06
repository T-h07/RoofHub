# Database Schema v1 (NM-PT04)

This document describes the first relational MVP schema for NestMap, implemented in:

- `supabase/migrations/20260406155410_nm_pt04_schema_v1.sql`

## Tables Included

Required tables implemented:

- `profiles`
- `listings`
- `listing_images`
- `favorites`
- `conversations`
- `messages`
- `listing_reports`

Optional tables intentionally deferred in v1:

- `listing_views`
- `moderation_actions`

## Core Modeling Decisions

- `profiles.id` is a foreign key to `auth.users(id)` for future Supabase Auth alignment.
- `listings.owner_id` links to `profiles(id)` and all listing child tables cascade from `listings`.
- Coordinates are stored as numeric `latitude`/`longitude` columns (PostGIS intentionally deferred).
- Conversations enforce one thread per `listing + provider + seeker` via unique constraint.
- Conversations also enforce provider ownership of listing via composite FK: `(listing_id, provider_id) -> listings(id, owner_id)`.
- Favorites prevent duplicates with composite primary key `(user_id, listing_id)`.
- Listing reports use constrained reason/status enums and moderation lifecycle timestamps.

## Constraints and Data Quality

The migration enforces:

- strict foreign keys across all relationships
- non-empty constraints for key text fields
- nonnegative/positive checks for pricing and dimensions
- constrained enums for stable domains (roles, listing/report statuses, listing/property types)
- timestamp defaults with `timestamptz`
- `updated_at` trigger updates on mutable core tables

## Indexing Coverage

Indexes are included for common MVP query patterns:

- listings browse/filter (`owner_id`, `listing_status`, `listing_type`, `property_type`, `city`, `price_amount`, `created_at`)
- listing map support (`latitude`, `longitude`)
- listing media ordering (`listing_id`, `sort_order`, cover image uniqueness)
- favorites read/count paths (`user_id`, `listing_id`)
- inbox/message retrieval (`provider_id`, `seeker_id`, `last_message_at`, `conversation_id`, `created_at`)
- report moderation queues (`status`, `created_at`)

## Local Migration Workflow

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local
```

Type generation after schema changes:

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

## Notes for PT05+

- PT05 RLS policies are now defined in `docs/rls-policies.md` and applied via migration.
- PT06 storage foundation is defined in `docs/storage-images-foundation.md` and uses `listing_images.storage_path` as canonical object reference.
- PT07+ auth flows can rely on the `profiles` linkage to `auth.users`.
