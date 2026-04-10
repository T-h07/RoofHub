# Google OAuth Live Flow

## Purpose

This document captures the live app-side Google OAuth flow.

The app now includes:

- Google OAuth entry route: `/auth/oauth/google`
- OAuth callback route: `/auth/callback` (shared with existing auth flows)
- callback code exchange + SSR session handling
- profile bootstrap compatibility after OAuth session creation
- safe redirect/next handling
- clean failure states for real provider/runtime errors

## Callback URLs

Configured callback target pattern used by app code:

- Local: `http://localhost:3000/auth/callback`
- Production pattern: `https://YOUR_DOMAIN/auth/callback`

The callback URL is generated from trusted origins through:

- `NEXT_PUBLIC_SITE_URL`
- `AUTH_ALLOWED_ORIGINS`

## Implemented app-side flow

1. User clicks Google entry on sign-in/sign-up forms.
2. App route `/auth/oauth/google` starts OAuth via Supabase `signInWithOAuth`.
3. `redirectTo` is set to `/auth/callback` with safe `next` + intent context.
4. Callback route exchanges code/session (`exchangeCodeForSession`) and bootstraps profile.
5. Success redirects to sanitized `next` path.
6. Failures redirect back to auth entry with bounded OAuth status messaging.

## Existing auth compatibility preserved

- Email/password sign-in and sign-up still use existing server actions.
- Forgot/reset password callback behavior remains functional.
- Proxy route protection and session refresh behavior remain unchanged.
- Profile bootstrap still uses `ensureProfileForCurrentUser` (no second profile path).

## Controlled OAuth status states

Common controlled statuses:

- `provider_not_ready`
- `origin_not_trusted`
- `start_rate_limited`
- `callback_exchange_failed`
- `callback_provider_error`

## Ongoing manual platform requirements

### Supabase (Dashboard)

1. Keep Google provider enabled in Auth settings.
2. Keep Google client id/secret configured in provider configuration.
3. Keep Auth URL config aligned with deployed environments:
   - Site URL for production domain
   - Additional redirect URLs for local/preview callback URLs.

### Google Cloud Console

1. Configure OAuth consent screen.
2. Keep OAuth client credentials active.
3. Add authorized redirect URI values:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
   - preview callback URIs as needed.

### Vercel environment

1. Keep `NEXT_PUBLIC_SITE_URL` environment-specific and canonical.
2. Keep `AUTH_ALLOWED_ORIGINS` populated with trusted local/preview/production origins.
3. Keep secrets server-only; never expose provider secrets via `NEXT_PUBLIC_*`.

## Validation notes

Validate flow behavior:

- sign-in page Google start
- sign-up page Google start
- callback success path to intended `next`
- callback failure path with bounded message
- profile bootstrap completion for first-time OAuth accounts
