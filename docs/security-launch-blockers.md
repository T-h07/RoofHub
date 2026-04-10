# Security Launch Blockers (SH-PT09)

Only concrete, launch-blocking items are listed here.

## Blocker 1: Trusted auth origins must be configured in production

- Severity: **High**
- Why blocking:
  - Auth callback/reset redirect URL generation now requires trusted origins to avoid host/origin confusion.
  - Missing or incomplete `AUTH_ALLOWED_ORIGINS` can break sign-up/password-reset callback URL generation.
- Required mitigation before launch:
  - Set `AUTH_ALLOWED_ORIGINS` in Vercel Production to include every trusted app origin.
  - Keep `NEXT_PUBLIC_SITE_URL` set to canonical production app origin.
  - Validate sign-up and password-reset email flows end-to-end on production domain.

## Blocker 2: Supabase Auth redirect/site URL allowlists must match production domains

- Severity: **High**
- Why blocking:
  - Mismatched Supabase Auth redirect/site URL settings can cause callback failure or unsafe redirect drift.
- Required mitigation before launch:
  - In Supabase Auth settings, set:
    - `Site URL` to canonical production origin.
    - `Additional redirect URLs` for required preview/staging callbacks (if used).
  - Validate callback routes for sign-in/sign-up/password-reset on production domain.

## Blocker 3: Production session security settings must be explicitly validated

- Severity: **High**
- Why blocking:
  - Session security posture (timebox/inactivity/reuse behavior) is partly dashboard-configured and cannot be guaranteed from repo code alone.
- Required mitigation before launch:
  - Confirm Supabase Auth production settings for:
    - refresh-token rotation
    - approved session lifetime/timebox/inactivity policy
    - password and email-confirmation policy as product policy requires
  - Record final values in release checklist/runbook.

## Conditional blocker: Google OAuth launch readiness (only if Google sign-in is in launch scope)

- Severity: **High (conditional)**
- Why blocking:
  - Google OAuth is not currently active in shipped app code paths and provider/platform config is not complete for launch.
- Required mitigation before launch (if Google sign-in is required):
  - complete OAuth provider configuration in Google Cloud + Supabase
  - add/validate app-side OAuth start flow and callbacks
  - verify local/preview/production redirect URIs and error handling

If Google sign-in is not in launch scope, treat this as deferred scope and remove from blocker gate.
