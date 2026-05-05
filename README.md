# NestMap

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT04 Database Schema v1` is established:

- Next.js App Router + TypeScript scaffold
- Supabase App Router SSR integration (`@supabase/supabase-js`, `@supabase/ssr`)
- SQL migration setup under `supabase/migrations/`
- MVP relational schema (profiles, listings, listing_images, favorites, conversations, messages, listing_reports)
- generated TypeScript database types in `src/types/database.ts`
- existing PT02 shell and PT03 integration structure preserved

This stage intentionally excludes business features (auth, listings, map provider logic, messaging, dashboards, moderation).

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
