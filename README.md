# NestMap

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT08 Profile and Role Bootstrapping` is established:

- Next.js App Router + TypeScript scaffold
- Supabase App Router SSR integration (`@supabase/supabase-js`, `@supabase/ssr`)
- SQL migration setup under `supabase/migrations/`
- MVP relational schema (profiles, listings, listing_images, favorites, conversations, messages, listing_reports)
- RLS enabled on all user-facing tables with owner/participant/admin policy boundaries
- private `listing-images` bucket strategy with storage object path and policy rules
- upload/validation/preview/cover/order/cleanup helper foundation for listing images
- auth routes and flows: sign up, sign in, sign out, forgot password, reset password
- callback-based auth redirect handling for SSR-safe session creation
- profile bootstrap on authenticated access with trusted `profiles` linkage
- role model foundation: `seeker`, `provider`, `admin`
- editable profile page for public-facing fields (`/profile`)
- role-aware desktop/mobile navigation visibility
- route protection for `/dashboard`, `/favorites`, `/messages`, and `/profile`
- generated TypeScript database types in `src/types/database.ts` (schema + policy helper functions)
- existing PT02 shell and PT03 integration structure preserved

This stage intentionally excludes business features beyond foundational auth/session plumbing (full role workflows, listings CRUD, map logic, moderation, and messaging product behavior).

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- ESLint
- Prettier
- clsx + tailwind-merge
- lucide-react

Theme direction:

- default dark mode is intentionally locked for NestMap’s product shell at this stage.

## Supabase Environment Setup

Create `.env.local` in the project root:

```bash
```

Rules:

- never commit `.env.local` or real secrets
- do not hardcode keys in source
- do not expose privileged keys (for example service role) to browser code
- configure the same variables in Vercel for Development, Preview, and Production environments
- `NEXT_PUBLIC_SITE_URL` is optional as a fallback; request-origin headers are used first for auth redirects

Connectivity check:

- run `npm run dev`
- open `/api/internal/supabase` to verify server-side Supabase wiring

## Database Schema (PT04)

Schema migrations live in `supabase/migrations`.

Local migration workflow:

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local
npx supabase gen types typescript --local > src/types/database.ts
```

See `docs/database-schema-v1.md` for table-level scope and schema decisions.

## RLS Security Layer (PT05)

RLS and access policies are implemented in SQL migrations and documented in:

- `docs/rls-policies.md`

Quick local validation flow:

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local
npx supabase gen types typescript --local > src/types/database.ts
```

## Storage Foundation (PT06)

Storage foundation details are documented in:

- `docs/storage-images-foundation.md`

The storage model uses a private Supabase bucket (`listing-images`) and ownership-aware object paths:

- `owner/{owner_id}/listing/{listing_id}/{filename}`

## Auth Foundation (PT07)

Auth flow documentation:

- `docs/auth-flows.md`

Implemented routes:

- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/callback`

Protected routes:

- `/dashboard`
- `/favorites`
- `/messages`

## Profile and Role Foundation (PT08)

Profile and role documentation:

- `docs/profile-role-foundation.md`

Implemented profile route:

- `/profile`

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful scripts:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run format`

## Branch Workflow

- Branch from `dev`.
- Use naming: `feature|fix|chore|docs/nm-ptXX-short-slug`.
- Do not commit directly to `main`.
- Merges into `dev` and `main` are manual by the repository owner.

See:

- `docs/repository-workflow.md`
- `docs/commit-conventions.md`
