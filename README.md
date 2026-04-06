# NestMap

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT02 Design System and Global UI Shell` is established:

- Next.js App Router + TypeScript scaffold
- Tailwind CSS + shadcn/ui baseline setup with reusable primitives
- locked dark theme with semantic tokens and typography hierarchy
- refined global shell (`header`, responsive nav, `footer`, container system)
- global feedback foundations (dialog, sheet/drawer, toast, empty state, field pattern)
- starter route structure for `/`, `/explore`, `/map`, and `/dashboard` using shared shell components

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
