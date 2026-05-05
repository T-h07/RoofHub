# NestMap

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT03 Supabase Project Integration` is established:

- Next.js App Router + TypeScript scaffold
- Supabase libraries wired for App Router SSR (`@supabase/supabase-js`, `@supabase/ssr`)
- explicit browser and server Supabase client helpers in `src/lib/supabase/`
- proxy-based session refresh foundation for SSR-safe auth cookies (`proxy.ts`)
- typed database scaffold in `src/types/database.ts`
- internal connectivity probe route at `/api/internal/supabase`
- existing PT02 design system and shell preserved

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
