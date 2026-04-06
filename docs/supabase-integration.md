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
- `src/types/database.ts`: generated Supabase database types (from local schema)
- `src/app/api/internal/supabase/route.ts`: internal connectivity probe
- `supabase/migrations/`: SQL-first schema migrations

## Security rules

- never hardcode keys in source
- never expose privileged keys to client components
- keep browser code on publishable key only
- reserve service-role/privileged keys for explicit server-only workflows in future PTs
- fail early on missing required environment variables

Schema details and migration workflow are documented in `docs/database-schema-v1.md`.
