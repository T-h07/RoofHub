# Production Hardening and Launch Review (SH-PT09)

## Purpose

This document is RoofHub's final production-security hardening pass for launch readiness on:

- Next.js App Router (Vercel)
- Supabase Auth/Database/Storage

It provides:

- production surface map and threat-oriented review
- concrete hardening changes made in SH-PT09
- ASVS-style final checklist with explicit statuses
- links to launch blockers and non-blocking security debt

## Evidence scope reviewed

Reviewed code/config/docs in this pass:

- `next.config.ts`
- `src/lib/auth/url.ts`
- `src/lib/auth/routing.ts`
- `src/lib/auth/actions.ts`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/{env.ts,server.ts,client.ts,proxy.ts}`
- `proxy.ts`
- local environment templates (if maintained in repo)
- `supabase/config.toml`
- `.github/workflows/security-*.yml`
- `.github/dependabot.yml`
- security docs from SH-PT01 through SH-PT08

## Production surface map (threat-oriented)

### Browser/app surface

- Public pages (`/`, `/explore`, `/map`, `/listing/[slug]`) with server-rendered listing data.
- Authenticated pages (`/dashboard`, `/favorites`, `/messages`, `/profile`, `/admin/moderation`) protected by proxy + server checks.
- Threats:
  - browser injection/XSS payload delivery
  - clickjacking and framing abuse
  - mixed-content downgrade attempts

### Auth/session surface

- Email/password sign-in/up, password reset, callback-based session exchange.
- Supabase SSR cookie model in proxy and server client.
- Threats:
  - session confusion/invalid session replay
  - callback abuse and redirect manipulation
  - brute-force and credential stuffing (covered by SH-PT06 controls)

### Redirect/callback surface

- `next` redirect parameters and callback transitions.
- Absolute callback URL generation via request origin + trusted fallback.
- Threats:
  - open redirect via crafted `next`
  - hostile host/origin injection for callback URLs

### API / route-handler surface

- `src/app/auth/callback/route.ts`
- `src/app/api/internal/supabase/route.ts`
- Threats:
  - malformed callback payloads
  - traffic flood against route handlers
  - internal error disclosure

### Provider/admin mutation surface

- Listing create/edit/publish/status actions
- Moderation hide/unhide actions
- Messaging/report flows
- Threats:
  - privilege abuse, high-rate mutation abuse, data-integrity drift
  - mitigated by SH-PT03/04/05/06/08 controls

### Storage/media surface

- Private bucket + signed URLs + canonical owner/listing path scheme.
- Threats:
  - cross-owner object mutation
  - unsafe file/upload abuse
- Mitigated in SH-PT05 contract.

### Environment/config surface

- Local `.env.local`, Vercel Development/Preview/Production vars, Supabase dashboard config.
- Threats:
  - secret exposure through `NEXT_PUBLIC_*`
  - preview/prod redirect mismatch
  - auth callback origin drift

### CI/repository security surface

- Secret scanning, dependency review/audit, CodeQL, Dependabot.
- Threats:
  - leaked secrets in history
  - vulnerable dependency drift

## SH-PT09 hardening changes implemented

### 1) HTTP security headers + baseline CSP

`next.config.ts` now enforces app-wide headers:

- `Content-Security-Policy` (baseline policy with explicit directives)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` with non-required features disabled
- `X-DNS-Prefetch-Control: off`
- `X-Permitted-Cross-Domain-Policies: none`
- `Strict-Transport-Security` in production only
- `poweredByHeader: false`

Notes:

- CSP is intentionally practical for current Next.js + Map stack.
- It still allows `'unsafe-inline'` for scripts/styles (tracked as security debt for nonce-based tightening).
- Development keeps `unsafe-eval` and `ws/http` allowances for HMR only.

### 2) Trusted auth origin hardening for callback/reset URL generation

`src/lib/auth/url.ts` now:

- introduces `AUTH_ALLOWED_ORIGINS` allowlist support
- validates request-derived origins against trusted allowlist
- requires trusted origins for production callback URL generation
- rejects non-relative `buildAbsolutePath(...)` input

This reduces risk of host-header/origin confusion in auth email redirect generation.

### 3) Metadata base alignment with environment

`src/app/layout.tsx` now resolves `metadataBase` from `NEXT_PUBLIC_SITE_URL` with safe fallback.

This keeps canonical metadata host behavior aligned with environment/domain setup.

### 4) Environment contract update


- `AUTH_ALLOWED_ORIGINS` guidance for local/preview/production callback safety.

## Cookie and session config review

### Code-enforced posture

- Supabase SSR cookie model remains intact (`proxy.ts`, `src/lib/supabase/proxy.ts`, server/browser split preserved).
- Invalid/revoked session handling remains fail-closed with cookie cleanup + bounded redirect reasons (SH-PT02).
- Sign-out semantics remain explicit local invalidation (`scope: "local"`).

### Platform-enforced posture (manual verification required)

Supabase Auth dashboard must keep:

- secure session cookie behavior for production domain
- refresh token rotation enabled
- session lifetime/inactivity policy set to launch-approved values
- site URL + redirect URL allowlists aligned with deployed domains

## Environment separation audit (local / preview / production)

### Public envs (browser-visible)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_MAP_STYLE_URL`
- `NEXT_PUBLIC_SITE_URL`

### Server-only envs

- `AUTH_ALLOWED_ORIGINS`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never `NEXT_PUBLIC_*`)
- provider secrets (`GOOGLE_CLIENT_SECRET`, etc.) when enabled

### Separation rules confirmed

- Any committed environment template must contain placeholders only.
- no service-role key in client code paths.
- SSR/browser Supabase client split remains preserved.

## Redirect URL audit

Validated redirect boundaries:

- `next` params are normalized by `resolveAuthenticatedRedirect` + `getSafeRedirectPath`.
- absolute/external redirect injection through `next` remains blocked.
- callback failure/success flows use bounded safe routes.
- absolute callback/reset URLs now require trusted origin resolution (`AUTH_ALLOWED_ORIGINS` + `NEXT_PUBLIC_SITE_URL`).

## Google OAuth production-safe checklist

Current status: **app-side flow is active, provider setup is pending**.

Implemented in code:

- OAuth start route: `/auth/oauth/google`
- callback route: `/auth/callback`
- server-side session code exchange + profile bootstrap compatibility
- bounded OAuth failure redirect states

If Google auth is introduced for launch, all of the following are mandatory:

1. Google Cloud Console:
   - configure OAuth consent screen (production publishing status)
   - configure authorized JavaScript origins and redirect URIs for local/preview/production
2. Supabase Auth provider config:
   - enable Google provider
   - set client id/secret securely
   - verify site URL + additional redirect URLs
3. Vercel env config:
   - set provider client id/secret in server-only vars
   - confirm preview/prod env separation
4. App config:
   - preserve safe callback routing and safe `next` handling
5. Validation:
   - success and failure callback paths in local/preview/production

## Supabase production config review

Reviewed assumptions to preserve:

- RLS remains core trust boundary (SH-PT03 alignment maintained).
- Auth callback and reset flows depend on correct redirect URL allowlist config.
- Storage private/public posture and ownership policies remain SH-PT05-aligned.
- Audit event storage and write function from SH-PT08 remain in place.

Manual platform checks required before launch are listed in `docs/security-launch-blockers.md`.

## Vercel production config review

Reviewed assumptions to preserve:

- env var separation by environment (Development/Preview/Production)
- no secret values in `NEXT_PUBLIC_*`
- canonical `NEXT_PUBLIC_SITE_URL` for production domain
- `AUTH_ALLOWED_ORIGINS` configured with full trusted origin set

No `vercel.json` override is currently required for this hardening pass.

## Final ASVS-style launch checklist

Status model:

- `DONE`
- `BLOCKED`
- `DEFERRED`
- `NEEDS_MANUAL_PLATFORM_CONFIG`

| Area | Control | Status | Evidence / note |
| --- | --- | --- | --- |
| Headers | Baseline CSP + browser hardening headers | DONE | `next.config.ts` |
| Headers | Strict nonce-based CSP without unsafe-inline | DEFERRED | tracked in `docs/security-debt-register.md` |
| Auth/session | SSR cookie flow + fail-closed invalid-session handling | DONE | SH-PT02 code/docs preserved |
| Auth/session | Production session lifetime/timebox/inactivity policy verified | NEEDS_MANUAL_PLATFORM_CONFIG | Supabase dashboard action |
| Access control | Provider/admin/participant authorization boundaries | DONE | SH-PT03 + code preserved |
| Input/output | Server-side validation + safe rendering guards | DONE | SH-PT04 preserved |
| Storage | Upload/path/ownership hardening | DONE | SH-PT05 preserved |
| Abuse resistance | Server-side traffic controls for risky flows | DONE | SH-PT06 preserved |
| Observability | Durable structured audit trail + redaction | DONE | SH-PT08 preserved |
| Redirect safety | Safe relative path + trusted callback origin handling | DONE | `src/lib/auth/routing.ts`, `src/lib/auth/url.ts` |
| OAuth | Google OAuth production-ready configuration | NEEDS_MANUAL_PLATFORM_CONFIG | App flow exists; Supabase + Google Cloud config still required |
| Secrets/deploy | Vercel/Supabase production env and redirect allowlists verified | NEEDS_MANUAL_PLATFORM_CONFIG | pre-launch checklist |
| Repo security | Secret scan / dependency guardrails / CodeQL workflows | DONE | `.github/workflows/security-*.yml` |

## Blockers and debt linkage

- Launch blockers: `docs/security-launch-blockers.md`
- Non-blocking prioritized debt: `docs/security-debt-register.md`

## SH-PT09 validation commands

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --package-lock-only --omit=dev --audit-level=high`
