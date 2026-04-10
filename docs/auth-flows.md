# Auth Flows and Session UX (NM-PT07)

This document summarizes the auth/session foundation added in PT07.

For the SH-PT02 hardening pass (session invalidation semantics, callback/redirect hardening, and session-failure recovery behavior), see:

- `docs/auth-session-hardening.md`

## Implemented Flows

- Email/password sign up (`/auth/sign-up`)
- Email/password sign in (`/auth/sign-in`)
- Google OAuth start (`/auth/oauth/google`)
- Sign out (header and mobile navigation)
- Forgot password (`/auth/forgot-password`)
- Reset password (`/auth/reset-password`)
- Auth callback exchange and verification (`/auth/callback`)

## Session Model

- Supabase SSR client helpers from PT03 are used for server actions, route handlers, and shell auth state.
- Session cookies are refreshed through `proxy.ts` + `src/lib/supabase/proxy.ts`.
- Header auth state is resolved server-side in `AppShell` to avoid stale client-only auth assumptions.

## Route Protection

Protected route prefixes are defined in `src/lib/auth/routing.ts` and enforced in `src/lib/supabase/proxy.ts`:

- `/dashboard`
- `/favorites`
- `/messages`
- `/profile`

Behavior:

- guest access to protected routes redirects to `/auth/sign-in?next=...`
- authenticated access to guest-only auth pages (`/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`) redirects to the requested safe `next` path or `/dashboard`
- stale/revoked auth-cookie sessions on protected routes are redirected with explicit reason states (`session_expired` / `session_revoked`) and stale auth cookies are cleared

## Redirect Logic

- `next` is sanitized to same-origin relative paths only.
- Sign in returns to intended protected destination when provided.
- Sign up uses callback redirects and supports both:
  - immediate session (if email confirmation is disabled)
  - confirmation-required flow (if enabled)
- Forgot password sends users through callback then to `/auth/reset-password`.
- Google OAuth uses `/auth/oauth/google` and returns through `/auth/callback`.
- Sign out redirects to sign-in with explicit reason state (`signed_out`).

## Profile Bootstrap Integration

- New authenticated users are bootstrapped into `public.profiles` via `ensureProfileForCurrentUser`.
- Display name source priority:
  - submitted display name
  - `user_metadata.display_name`
  - email prefix fallback
- Duplicate profile inserts are treated as safe no-op (`23505`).

## Environment and Supabase Auth URL Setup

Required in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Recommended:

- `NEXT_PUBLIC_SITE_URL` (fallback when request host headers are unavailable)

Supabase dashboard setup:

1. Set **Auth > URL Configuration > Site URL** to your production app origin.
2. Add redirect URLs for callback usage:
   - `http://localhost:3000/auth/callback`
   - your production callback URL (for example `https://roofhub.vercel.app/auth/callback`)
   - your preview callback pattern/domain as needed by your Vercel setup

Google OAuth foundation note:

- App-side Google OAuth logic is implemented (`/auth/oauth/google` start route + `/auth/callback` exchange).
- Provider enablement and credentials are still dashboard/provider configuration work.
- See `docs/google-oauth-foundation.md` for exact implementation and remaining manual setup.

## Known Limits / Next PT Notes

- Google OAuth app-side flow exists, but successful Google sign-in depends on Supabase + Google Cloud provider configuration.
- Single-active-session enforcement is configuration-gated in Supabase settings and is not claimed unless explicitly enabled in dashboard.
- Route protection is authenticated-only (full role-segmented route shells can be expanded later).
- PT08 can build on this to introduce profile/account UX and deeper guarded route groups.
