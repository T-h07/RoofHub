# RoofHub

RoofHub is a map-first real estate marketplace built with Next.js + Supabase. It supports rental and sale discovery, provider inventory operations, messaging, moderation, and security-focused production guardrails.

## Stable Version

- Branch: `launch-ready-finalization`
- SemVer: `1.0.0`
- Release tag: `v1.0.0`
- State: launch-ready code baseline (no deployment action performed)

## Core Capabilities

- Public discovery across list and map surfaces (`/explore`, `/map`, `/listing/[slug]`)
- Authenticated favorites and account/profile management
- Provider listing lifecycle flow (draft -> review -> publish -> maintenance)
- Company-aware workspace and team membership model
- Listing-bound messaging with realtime updates and safe participant access
- Moderation queue with controlled visibility states

## Security Posture

- Server/client Supabase separation is enforced (`src/lib/supabase/client.ts` vs `src/lib/supabase/server.ts`)
- Route and mutation protection is server-enforced
- RLS is treated as a core trust boundary
- Traffic controls and abuse throttling are implemented for sensitive paths
- Structured security audit events with redaction are in place
- Repository secret scanning is integrated in local and CI workflows

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Postgres, Storage, RLS)
- MapLibre

## Quick Start

```bash
npm install
```

Create your local environment file:

```bash
touch .env.local
```

Windows PowerShell:

```powershell
New-Item -Path .env.local -ItemType File
```

Then add your environment values to `.env.local` and run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Safety Rules

- `.env.local` must stay untracked
- Never commit real credentials, tokens, database URLs, or provider secrets
- Keep server-only credentials on the server runtime only

## Quality Gates

Run these before every release candidate:

```bash
npm run check:secrets
npm run lint
npm run typecheck
npm run build
```

## Developer Scripts

- `npm run dev` - run local dev server
- `npm run lint` - lint codebase
- `npm run typecheck` - TypeScript checks
- `npm run check:secrets` - tracked file secret scan
- `npm run check:secrets:staged` - staged file secret scan
- `npm run build` - production build verification
- `npm run format` - Prettier formatting

## Documentation Index

Product and architecture:

- `docs/home-page-foundation.md`
- `docs/explore-listings-foundation.md`
- `docs/map-page-foundation.md`
- `docs/listing-detail-page.md`
- `docs/provider-dashboard-my-listings.md`
- `docs/realtime-messaging.md`

Security and production hardening:

- `docs/security-baseline.md`
- `docs/security-checklist.md`
- `docs/auth-session-hardening.md`
- `docs/authorization-boundary-audit.md`
- `docs/request-output-validation-hardening.md`
- `docs/traffic-control-hardening.md`
- `docs/audit-observability-hardening.md`
- `docs/production-hardening-launch-review.md`
- `docs/supply-chain-guardrails.md`

Workflow:

- `docs/repository-workflow.md`
- `docs/commit-conventions.md`

## Branch and Merge Model

- `main`: stable/release-ready only
- `dev`: integration branch
- work branches: `feature/*`, `fix/*`, `chore/*`, `docs/*`

Do not commit directly to `main`.

## Launch-Ready Scope

This repository is finalized to a stable engineering baseline. It is ready for controlled release, with deployment intentionally left to manual owner action.
