# NestMap

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT01 App Foundation` is established:

- Next.js App Router + TypeScript scaffold
- Tailwind CSS + shadcn/ui baseline setup
- foundational app shell (`header`, `container`, `footer`)
- starter route structure for `/`, `/explore`, `/map`, and `/dashboard`
- shared utilities and config for future PT work

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
