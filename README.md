# RoofHub

Map-first real estate marketplace for rental and sale listings.

## Current Stage

`NM-PT25 Provider Public Trust Layer` is established:

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
- public homepage foundation with hero, search CTA, intent entry points, featured listing placeholders, and provider CTA
- public explore browse route (`/explore`) with server-rendered published listings
- URL-driven search/filter/sort/pagination controls for browse state
- server-side filter model with keyword, location, numeric ranges, room minimums, and amenity toggles
- public map route (`/map`) with MapLibre rendering and URL-synced discovery state
- server-side public marker query aligned with PT11 filter parsing and public listing visibility rules
- marker and popup foundation with mobile-safe control and loading/error/empty state handling
- map clustering for higher listing density
- `Search this area` flow with typed `bbox` bounds state
- bounds-aware server queries that still reuse PT11 filter parsing
- refined desktop map/list split with synchronized applied result counts
- reusable listing card component for map/list/detail-adjacent surfaces
- public listing detail route (`/listing/[slug]`) with server-first published-only fetching
- responsive listing image gallery with signed private-bucket image URLs
- structured detail surfaces: summary, location, specs, features, description, provider card
- detail-page map snippet aligned with public location privacy mode (`exact`, `approximate`, `hidden`)
- conversion CTA surfaces: favorite toggle, contact entry, and report submission
- reusable persisted favorite toggle with optimistic rollback behavior
- authenticated favorites page (`/favorites`) with saved-list management and polished empty/error/loading states
- explore listing cards now show account-level saved state for authenticated viewers
- explore/map listing links now route into detail pages
- provider listing creation wizard routes:
  - `/dashboard/listings/new`
  - `/dashboard/listings/[id]/edit?step=<wizard-step>`
- server-backed multi-step provider draft flow (basics, pricing, facts, location, amenities, contact, review)
- provider-only wizard access control aligned with authenticated role model
- draft persistence with id-based edit continuity and step-level validation
- profile-backed contact settings integration in listing wizard flow
- coordinates nullable for draft listings with published listings requiring coordinates
- provider location step with click-to-place and drag-to-adjust map pin interactions
- persisted listing coordinates, address text, and exact vs approximate public location mode controls
- provider review step integration for location summary and edit jumpbacks
- provider photos step with real upload, reorder, cover-image selection, and persisted image state
- publish-readiness blockers surfaced in the review step with direct step jumpbacks
- real draft -> published action with server-enforced readiness checks
- centralized listing status transition foundation for later provider management workflows
- post-publish redirect to public listing detail route for immediate verification
- provider dashboard route (`/dashboard`) with real owned-listing lifecycle overview cards
- provider my-listings route (`/dashboard/listings`) with status filters and responsive management surface
- provider lifecycle actions with backend persistence: pause, archive, set active, mark sold, mark rented
- listing status model extended with `sold` and `rented` lifecycle states
- unread leads dashboard placeholder surface reserved for future messaging/leads integration
- provider listing edit route (`/dashboard/listings/[id]/edit`) now exposes status-aware maintenance controls
- provider edit flow reuses the existing multi-step wizard and photo-management foundations (no parallel edit stack)
- status model extended with `hidden_by_admin` moderation state
- provider-controlled status transitions centralized and guarded against moderation-only status changes
- hidden-by-admin listings are explicitly represented in provider UI and cannot be cleared by provider controls
- published edit safety hardening prevents active listings from being left with invalid pricing or missing photo cover sets
- public listing visibility remains explicitly tied to published state across discovery/detail/favorites/report surfaces
- messaging backend foundation is now active under `src/lib/messaging/*`
- listing contact handoff now uses create-or-get conversation behavior keyed by `(listing_id, provider_id, seeker_id)`
- new conversation creation is seeker-initiated only and restricted to published listings
- message persistence and participant-safe read-state updates are now enforced with unread derivation via `messages.read_at`
- provider dashboard unread lead metric is now backed by real unread conversation data
- authenticated inbox route now provides real conversation list + thread panel UX (`/messages`)
- listing-bound thread header now surfaces listing context (title, status, price/location summary, listing deep-link)
- message composer now sends through PT21 server action flow with pending/error handling
- unread cues now surface in conversation list and clear on thread-open via read-state mutation
- responsive messaging layout now supports desktop split view and mobile drill-in/back navigation
- messaging loading/empty/error states are now integrated for route and thread surfaces
- scoped Supabase realtime subscriptions now sync message inserts/updates across active participant threads
- optimistic send now renders immediate pending bubbles and reconciles against persisted message events
- conversation list ordering/unread cues now update live from message events with participant-safe scoping
- degraded realtime states now auto-fallback to periodic server refresh with manual refresh/retry controls
- listing report reason codes are now centralized and reused across report UX + backend validation
- report submission now handles duplicate reports idempotently and blocks self-report attempts
- admin moderation workspace route is now available at `/admin/moderation` with admin-only access
- moderation queue now surfaces report + listing context with hide/unhide controls
- admin hide/unhide now persists through `hidden_by_admin` status transitions and restores safe visibility state
- public provider summary on listing detail now includes trust-safe metadata (`member since`, published listing count)
- provider trust metadata is now sourced from real backend fields with typed fallbacks (no fabricated trust metrics)
- verified-email trust indicator is now supported as a conditional surface and remains hidden until a reliable public verification source is available
- generated TypeScript database types in `src/types/database.ts` (schema + policy helper functions)
- existing PT02 shell and PT03 integration structure preserved

This stage intentionally excludes business features beyond foundational auth/session plumbing (full role workflows, listings CRUD, full reputation/review mechanics, full favorites collections UX, and full messaging product behavior).

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

- default dark mode is intentionally locked for RoofHub’s product shell at this stage.

## Supabase Environment Setup

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_MAP_STYLE_URL=your-map-style-url
NEXT_PUBLIC_SITE_URL=your-base-url
```

Quick local setup (Windows PowerShell):

```powershell
cd C:\Users\taulanth\Desktop\nestmap
Copy-Item .env.example .env.local
```

Then set `.env.local` to:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-publishable-key>
NEXT_PUBLIC_MAP_STYLE_URL=https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Where to get the Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Dashboard -> Project Settings -> Data API -> Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase Dashboard -> Project Settings -> Data API -> Project API keys -> `anon` / publishable key
- `NEXT_PUBLIC_MAP_STYLE_URL`: optional override. If omitted or invalid, RoofHub falls back to a public dark MapLibre style.

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

## Public Home Page Foundation (PT09)

Homepage foundation documentation:

- `docs/home-page-foundation.md`

## Explore/List View Foundation (PT10)

Explore browse foundation documentation:

- `docs/explore-listings-foundation.md`

## Search and Filter System (PT11)

Search/filter documentation:

- `docs/search-filter-system.md`

## Map Infrastructure and Public Map Page (PT12)

Map page documentation:

- `docs/map-page-foundation.md`

## Map Bounds, Clustering, and Search This Area (PT13)

Map scaling and bounds-search documentation:

- `docs/map-bounds-clustering.md`

## Listing Detail Page (PT14)

Listing detail architecture documentation:

- `docs/listing-detail-page.md`

## Favorites System (PT15)

Favorites system documentation:

- `docs/favorites-system.md`

## Listing Creation Wizard (PT16)

Provider listing wizard documentation:

- `docs/listing-creation-wizard.md`

## Provider Map Pin Placement Flow (PT17)

Provider location-step documentation:

- `docs/provider-map-pin-placement.md`

## Listing Photos and Publish Flow (PT18)

Provider photo/publish documentation:

- `docs/listing-photos-publish-flow.md`

## Provider Dashboard and My Listings (PT19)

Provider dashboard documentation:

- `docs/provider-dashboard-my-listings.md`

## Listing Edit and Status Management (PT20)

Provider listing maintenance documentation:

- `docs/listing-edit-status-management.md`

## Conversation Model and Messaging Backend (PT21)

Messaging backend documentation:

- `docs/conversation-messaging-backend.md`

## Messaging UI (PT22)

Messaging UI documentation:

- `docs/messaging-ui.md`

## Realtime Messaging (PT23)

Realtime messaging documentation:

- `docs/realtime-messaging.md`

## Report Listing and Moderation Basics (PT24)

Moderation starter documentation:

- `docs/report-listing-moderation-basics.md`

## Provider Public Trust Layer (PT25)

Provider trust-layer documentation:

- `docs/provider-public-trust-layer.md`

## Security Baseline and Guardrails (SH-PT01)

- Root agent and contributor security contract: `AGENTS.md`
- Platform baseline and merge-blocking rules: `docs/security-baseline.md`
- Pre-merge checklist for sensitive work: `docs/security-checklist.md`

Security-sensitive changes must follow the baseline and complete the checklist before merge.

## Auth and Session Hardening (SH-PT02)

- Auth/session hardening model and threat-focused controls: `docs/auth-session-hardening.md`
- Foundational auth flow behavior and route map: `docs/auth-flows.md`

## Supply Chain Guardrails (SH-PT07)

- Repository-level supply-chain policy and scanner response workflow: `docs/supply-chain-guardrails.md`
- CI workflows:
  - `.github/workflows/security-secrets.yml`
  - `.github/workflows/security-dependencies.yml`
  - `.github/workflows/security-codeql.yml`
- Automated dependency update hygiene: `.github/dependabot.yml`

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
- `docs/security-baseline.md`
- `docs/security-checklist.md`
- `docs/auth-session-hardening.md`
- `docs/supply-chain-guardrails.md`
