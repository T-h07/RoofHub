# Auth and Session Hardening (SH-PT02)

This document records the current RoofHub auth/session model, the SH-PT02 hardening changes, and the operational settings required in Supabase/Vercel.

It is intentionally implementation-aligned and scoped to the existing Next.js App Router + Supabase SSR architecture.

## Scope

- In scope: session handling, callback/redirect safety, logout invalidation semantics, protected-route behavior, profile-bootstrap consistency, environment auth configuration.
- Out of scope: MFA rollout, rate limiting, full audit logging, social-provider expansion, auth UX redesign.

## Current model before SH-PT02 (PT07 baseline)

Session creation:
- Password sign-in via `supabase.auth.signInWithPassword` in `src/lib/auth/actions.ts`.
- Sign-up session (when immediate session is issued) via `supabase.auth.signUp`.
- Callback exchange via `/auth/callback` route and Supabase `exchangeCodeForSession` / `verifyOtp`.

Session refresh/revalidation:
- SSR cookie refresh path through `proxy.ts` -> `src/lib/supabase/proxy.ts` -> `supabase.auth.getUser()`.
- Browser/server separation preserved via:
  - browser client: `src/lib/supabase/client.ts`
  - server client: `src/lib/supabase/server.ts`

Session invalidation:
- Sign-out via `supabase.auth.signOut` server action.

Protected route behavior:
- Auth protection in proxy based on path prefixes in `src/lib/auth/routing.ts`.
- Unauthenticated access redirected to sign-in with `next`.

Known weak spots observed pre-hardening:
- Minimal redirect-path sanitizer.
- No explicit user-facing distinction between auth-required vs expired/revoked sessions.
- Potential partial-auth state when profile bootstrap fails after auth succeeds.
- Callback failure path did not encode explicit hardening reason semantics.

## SH-PT02 hardening changes

### 1) Redirect and callback safety tightened

- Hardened `getSafeRedirectPath` in `src/lib/auth/routing.ts`:
  - requires relative paths
  - rejects `//` forms, backslashes, and control chars
  - normalizes via URL parsing and strips fragments
- Added typed auth redirect reasons (`auth_required`, `session_expired`, `session_revoked`, `signed_out`, `callback_invalid`, `profile_unavailable`).

### 2) Session revalidation failure handling improved

- `src/lib/supabase/proxy.ts` now distinguishes:
  - unauthenticated/no session -> `auth_required`
  - stale or revoked auth-cookie session -> `session_expired` or `session_revoked`
- On protected-route redirects with stale auth cookies, Supabase auth cookies are cleared before redirect.
- On guest auth routes with stale cookies, stale auth cookies are cleared to reduce repeated invalid-session loops.

### 3) Sign-out invalidation semantics tightened

- `signOutAction` now explicitly uses local session scope:
  - `supabase.auth.signOut({ scope: "local" })`
- Post sign-out redirect now carries explicit user-facing state:
  - `/auth/sign-in?reason=signed_out`
- Layout revalidation remains in place to prevent stale authenticated shell fragments.

### 4) Profile bootstrap consistency hardening

- After successful sign-in/sign-up session creation, profile bootstrap failure triggers best-effort local sign-out rollback to avoid partial-auth state.
- Callback route applies the same pattern: if profile bootstrap fails after session exchange, session is locally signed out and user is redirected with `reason=profile_unavailable`.

### 5) Auth failure UX now maps to security-relevant states

- Sign-in form now displays clear, bounded messages for auth reasons without leaking backend internals.

## Threat model summary (auth/session path)

Trust boundaries:
- Browser <-> Next.js App Router server actions/routes
- Next.js server <-> Supabase Auth API
- Supabase auth cookies crossing proxy boundary

High-value assets:
- Auth session cookies and refresh tokens
- Account-to-profile linkage integrity
- Protected route access state

Primary abuse paths and mitigations:
- Open redirect via crafted `next`: mitigated by strict relative-path sanitization.
- Stale/revoked cookie confusion: mitigated by proxy-side stale cookie detection + cookie clearing + reasoned redirect.
- Partial-auth state after callback/sign-in profile failure: mitigated by rollback sign-out.
- Silent logout confusion: mitigated by explicit signed-out reason state.

## Session lifetime and Supabase settings guidance

Session lifetime is primarily a Supabase Auth configuration concern, not a client-side timer concern.

Recommended to configure in Supabase dashboard:
- JWT/access token lifetime (short-lived access tokens).
- Session time-boxing (absolute max lifetime) where available.
- Inactivity timeout where available.
- Single active session per user where available and desired.

App-side SH-PT02 behavior is compatible with these settings and handles revoked/expired session recovery via reasoned sign-in redirects.

## Single-active-session policy (gating and behavior)

- Enforcement is infra-level (Supabase Auth setting), not reliably enforceable by frontend-only code.
- If enabled in Supabase:
  - displaced sessions are recognized when auth revalidation fails on next request
  - app redirects to sign-in with `reason=session_revoked` or `reason=session_expired`
- If not enabled:
  - multiple active sessions remain possible by design

This is an honest, configuration-gated control and must not be claimed as enforced unless Supabase settings are enabled.

## Environment and deployment requirements

- Keep callback and site URL config aligned across local/preview/production.
- `NEXT_PUBLIC_SITE_URL` remains fallback-only when forwarded host headers are unavailable.
- Supabase Auth URL configuration must include each environment callback origin:
  - local
  - preview
  - production
- Google OAuth app-side callback/start flow now exists in repo state; successful provider login still depends on Supabase + Google Cloud configuration.

## Deferred items (not in SH-PT02)

- MFA enrollment/challenge flow
- adaptive auth risk scoring/challenge escalation beyond SH-PT06 baseline throttling
- auth event audit trail pipeline
- provider-specific OAuth rollout

## Validation executed in SH-PT02

- `npm run typecheck`
- `npm run lint`
- `npm audit --package-lock-only --omit=dev --audit-level=high`
