# Supabase Integration Notes (NM-PT03)

## Installed packages

- `@supabase/supabase-js`
- `@supabase/ssr`

## Hosted project wiring (current target)

- Project ref: configured privately in the provider dashboard
- Project URL: configured privately in the provider dashboard
- Publishable key: configured privately in the provider dashboard

## Environment variables

Required app variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional app variable already present:

- `NEXT_PUBLIC_MAP_STYLE_URL`

Local `.env.local` (not committed):

```bash
```

Optional server-only connection string pattern for CLI tooling:

```bash
```

Rules:

- never commit `.env.local` or real credentials
- never expose `DATABASE_URL` or service-role values to `NEXT_PUBLIC_*`
- configure equivalent envs in Vercel Development/Preview/Production

## Supabase CLI workflow (hosted project)

This repository already includes:

- `supabase/config.toml`
- `supabase/migrations/*`
- `supabase/seed.sql`

To connect local CLI to the hosted project:

1. `npx supabase login`
2. `npx supabase link --project-ref <your-project-ref>`
3. `npx supabase migration list --local`
4. `npx supabase migration list --linked`
5. `npx supabase db push`

If you prefer direct DB-url mode for migration checks/push, use a server-only shell variable:

1. set `DATABASE_URL` locally (never commit)
2. `npx supabase migration list --db-url "$DATABASE_URL"`
3. `npx supabase db push --db-url "$DATABASE_URL"`

## Local drift verification

Use these repository scripts to fail fast on schema/type drift instead of relying on runtime compatibility:

1. `npm run supabase:db:reset`
2. `npm run verify:supabase:drift`

If `src/types/database.ts` is stale, regenerate it with:

1. `npm run supabase:types:generate`
2. commit the updated types with the migration change

## File layout

- `src/lib/supabase/env.ts`: runtime env validation and Supabase config access
- `src/lib/supabase/client.ts`: browser-safe Supabase client
- `src/lib/supabase/server.ts`: server-safe Supabase client with cookie integration
- `src/lib/supabase/proxy.ts`: session refresh helper used by `proxy.ts`
- `src/lib/supabase/storage/listing-images.ts`: storage upload/delete/signed-url helper layer
- `src/lib/storage/listing-images.ts`: image path + validation + DB mapping utilities
- `src/hooks/use-listing-image-upload-state.ts`: local preview/cover/order/cleanup state helper
- `src/types/database.ts`: generated Supabase database types
- `src/app/api/internal/supabase/route.ts`: internal connectivity probe
- `supabase/migrations/`: SQL-first schema migrations

## Manual OAuth provider configuration (still required)

App-side OAuth routes are implemented, but dashboard/provider setup is still manual:

- Supabase Dashboard:
  - enable Google provider
  - set Google client ID + secret
  - set site URL and additional redirect URLs (local/preview/production)
- Google Cloud Console:
  - configure OAuth consent screen
  - add authorized redirect URIs:
    - `http://localhost:3000/auth/callback`
    - `https://YOUR_DOMAIN/auth/callback`
    - any preview callback URLs used in Vercel

## Security rules

- never hardcode keys in source
- never expose privileged keys to client components
- keep browser code on publishable key only
- reserve service-role/privileged keys for explicit server-only workflows
- fail early on missing required environment variables

Schema details remain documented in `docs/database-schema-v1.md`.
Repository-wide guardrails remain in:

- `docs/security-baseline.md`
- `docs/security-checklist.md`
