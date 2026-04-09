# Agent instructions (scope: this repository)

## Platform invariants
- Keep this app aligned with the current platform choices: Next.js App Router + Vercel hosting + Supabase backend services.
- Preserve the existing Supabase browser/server separation (`src/lib/supabase/client.ts` vs `src/lib/supabase/server.ts` / `proxy.ts`).
- Preserve local/preview/production environment separation; do not collapse environment behavior into one shared unsafe default.
- Follow repository branch discipline in `docs/repository-workflow.md` and commit rules in `docs/commit-conventions.md`.

## Mandatory security rules
- Never hardcode secrets, tokens, or credentials in source, tests, fixtures, logs, or docs.
- Never expose privileged Supabase credentials (for example service-role keys) in client code, `NEXT_PUBLIC_*` variables, or browser payloads.
- Treat route handlers, server actions, auth/session code, upload/storage code, messaging flows, moderation flows, and admin logic as security-sensitive by default.
- Enforce authorization server-side on every sensitive mutation/read path. Route protection alone is not sufficient.
- Derive actor identity from authenticated server context; never trust client-supplied role, owner/provider/admin identifiers, or participant claims.
- Keep RLS as a core trust boundary. Do not bypass RLS assumptions with broad privileged queries or ad-hoc filtering in UI code.
- Validate all external input (query params, form data, route params, webhook/body payloads) before use.
- Do not use unsafe HTML rendering for user-generated content; default to escaped rendering.
- Use safe redirect/callback behavior: allow only trusted relative paths or explicitly allowlisted origins.
- Keep upload/storage flows ownership-aware and deterministic:
  - validate file type/size/count
  - use deterministic path conventions
  - avoid broad overwrite/upsert behavior as a default
- Keep public/private visibility rules explicit. Do not accidentally expose draft, hidden, moderated, or private data.
- User-facing errors must be human-readable and generic; logs may be diagnostic but must redact secrets and tokens.

## Dependency and package hygiene
- Do not add packages without clear need.
- Any dependency touching auth, validation, parsing, rendering, crypto, upload, storage, or networking requires explicit security review notes.
- Keep lockfile changes intentional and scoped to the dependency change.
- Prefer well-maintained packages; avoid abandoned or low-trust additions without justification.

## Supply-chain guardrails
- Keep `package-lock.json` as source-of-truth for reproducible installs; do not omit lockfile updates when dependencies change.
- Do not modify or disable repository security workflows (`security-secrets`, `security-dependencies`, `security-codeql`) without explicit justification and docs updates.
- Do not suppress dependency/code/secret scanner findings without PR-level reasoning and narrow scope.
- For new dependencies, document:
  - why existing dependencies are insufficient
  - package maintenance/safety signal
  - security impact on trust boundaries (especially auth/crypto/upload/parsing/rendering/networking)
- Keep automated dependency updates (`.github/dependabot.yml`) scoped and maintainable; avoid update spam patterns.

## Required workflow for security-sensitive changes
- Update `docs/security-baseline.md` when behavior, trust boundaries, or assumptions change.
- Run and complete `docs/security-checklist.md` before merge for security-sensitive work.
- Follow `docs/supply-chain-guardrails.md` when changing dependencies, lockfiles, or security workflows.
- Add tests or explicit validation notes for sensitive behavior changes (authz, ownership, visibility, storage, redirects, moderation).
- Document newly added route handlers/server actions and their authorization/input-validation approach.

## Frontend quality guardrails
- Preserve coherent existing visual identity when extending UI.
- Favor strong hierarchy, spacing consistency, and readable state handling over placeholder scaffolds.
- For any UI changes affecting security UX (errors, warnings, admin/dev surfaces), keep copy clear and avoid leaking sensitive implementation details.
