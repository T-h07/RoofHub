# Security Checklist (SH-PT01)

Use this checklist before merging any security-sensitive change.

Security-sensitive includes: auth/session, authorization, server actions, route handlers, uploads/storage, messaging/moderation/admin boundaries, env/secrets, and dependency changes affecting trust boundaries.

For dependency/lockfile/scanner specifics, also follow `docs/supply-chain-guardrails.md`.

## Access and authorization

- [ ] Auth is required where needed (no guest bypass on protected behavior).
- [ ] Authorization is enforced server-side (not only by route protection/UI state).
- [ ] Session revalidation behavior is server-enforced and remains SSR cookie-based.
- [ ] Sign-out reliably invalidates protected-route access after refresh/navigation.
- [ ] Ownership is derived from authenticated context, not client-supplied ids.
- [ ] Admin/provider/user boundary checks are explicit.
- [ ] RLS assumptions are preserved (no app-side bypass pattern introduced).

## Input and output safety

- [ ] Route params, query params, and form/body payloads are validated and typed.
- [ ] Callback and redirect parameters are sanitized and constrained to safe targets.
- [ ] Unsafe or unbounded parsing paths were not introduced.
- [ ] User-generated text is rendered safely (no unsafe HTML interpolation).
- [ ] Public/private data exposure was reviewed for all changed queries/responses.

## Storage and visibility

- [ ] Upload constraints are enforced (type, size, count).
- [ ] Storage paths remain deterministic and ownership-scoped.
- [ ] Delete/sync operations verify object ownership/path validity.
- [ ] Listing/report/message visibility still respects status and participant rules.
- [ ] Moderation-related status transitions still enforce admin authority.

## Errors, logging, and secrets

- [ ] User-facing errors are clear but do not reveal sensitive internals.
- [ ] Logs avoid secrets/tokens/passwords/cookies/auth codes.
- [ ] No real secrets were added to code, docs, fixtures, or committed env files.
- [ ] `NEXT_PUBLIC_*` variables were reviewed to ensure no secret values are required.

## Dependencies and change hygiene

- [ ] New/updated sensitive dependencies were reviewed and justified.
- [ ] Lockfile updates are intentional and scoped.
- [ ] `package-lock.json` updates match dependency manifest changes (no drift/omission).
- [ ] Dependency Review check passes (or documented exception approved by maintainers).
- [ ] Secret scan and CodeQL checks were reviewed for this change set.
- [ ] Changed routes/server actions are documented if trust boundaries changed.
- [ ] Tests or validation notes cover the security-sensitive behavior.
- [ ] `docs/security-baseline.md` was updated if assumptions/guardrails changed.
- [ ] If scanner suppression/workflow changes were made, justification and scope are documented.
