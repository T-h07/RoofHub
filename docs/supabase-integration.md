# Supabase Integration Notes (NM-PT03)

## Installed packages

- `@supabase/supabase-js`
- `@supabase/ssr`

## Environment variables

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional project variable already present:

- `NEXT_PUBLIC_MAP_STYLE_URL`

Local usage:

- set values in `.env.local`
- never commit `.env.local`

Vercel usage:

- configure the same values in Project Settings for:
  - Development
  - Preview
  - Production

## File layout

- `src/lib/supabase/env.ts`: runtime env validation and Supabase config access
- `src/lib/supabase/client.ts`: browser-safe Supabase client
- `src/lib/supabase/server.ts`: server-safe Supabase client with cookie integration
- `src/lib/supabase/proxy.ts`: session refresh helper used by `proxy.ts`
- `src/lib/supabase/storage/listing-images.ts`: storage upload/delete/signed-url helper layer
- `src/lib/storage/listing-images.ts`: image path + validation + DB mapping utilities
- `src/hooks/use-listing-image-upload-state.ts`: local preview/cover/order/cleanup state helper
- `src/types/database.ts`: generated Supabase database types (from local schema)
- `src/app/api/internal/supabase/route.ts`: internal connectivity probe
- `supabase/migrations/`: SQL-first schema migrations

## Security rules

- never hardcode keys in source
- never expose privileged keys to client components
- keep browser code on publishable key only
- reserve service-role/privileged keys for explicit server-only workflows in future PTs
- fail early on missing required environment variables

## RLS and authorization

- PT05 enables RLS on all user-facing public tables.
- Access control is enforced in DB policies for anon/authenticated/admin flows.
- Policy details and storage policy direction are documented in `docs/rls-policies.md`.
- PT06 implements storage bucket + `storage.objects` policies for listing images.
- Storage behavior is documented in `docs/storage-images-foundation.md`.
- PT07 adds SSR-safe auth flows and callback handling for sign-up/sign-in/password reset.
- Auth flow details are documented in `docs/auth-flows.md`.

Schema details and migration workflow remain documented in `docs/database-schema-v1.md`.
