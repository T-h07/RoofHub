# Google OAuth Logic Foundation

## Purpose

This document captures the app-side Google OAuth implementation completed before external provider setup is finalized.

The app now includes:

- Google OAuth entry route: `/auth/oauth/google`
- OAuth callback route: `/auth/callback` (shared with existing auth flows)
- callback code exchange + SSR session handling
- profile bootstrap compatibility after OAuth session creation
- safe redirect/next handling
- graceful failure states when provider setup is incomplete

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

## Graceful pre-configuration behavior

If provider setup is not ready yet:

- Google button remains visible.
- OAuth start/callback failures are handled with bounded, user-safe error states.
- App does not pretend OAuth is fully live.

Common controlled statuses:

- `provider_not_ready`
- `origin_not_trusted`
- `start_temporarily_unavailable`
- `callback_exchange_failed`
- `callback_provider_error`

## Manual setup still required

### Supabase (Dashboard)

1. Enable Google provider in Auth settings.
2. Set Google client id/secret in provider configuration.
3. Ensure Auth URL config includes:
   - Site URL for production domain
   - Additional redirect URLs for local/preview callback URLs.

### Google Cloud Console

1. Configure OAuth consent screen.
2. Create OAuth client credentials.
3. Add authorized redirect URI values:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
   - preview callback URIs as needed.

### Vercel environment

1. Keep `NEXT_PUBLIC_SITE_URL` environment-specific and canonical.
2. Keep `AUTH_ALLOWED_ORIGINS` populated with trusted local/preview/production origins.
3. Keep secrets server-only; never expose provider secrets via `NEXT_PUBLIC_*`.

## Validation notes

Validate after setup:

- sign-in page Google start
- sign-up page Google start
- callback success path to intended `next`
- callback failure path with bounded message
- profile bootstrap completion for first-time OAuth accounts
