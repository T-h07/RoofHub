# Security Debt Register (SH-PT09)

This file tracks non-blocking but real security debt after launch hardening.

## Priority model

- `P1`: high-value next security sprint
- `P2`: planned hardening after P1
- `P3`: useful later-phase improvements

## Debt items

| Priority | Item | Why deferred | Suggested follow-up |
| --- | --- | --- | --- |
| P1 | Migrate CSP from baseline policy to nonce-based strict CSP | Current Next.js/map stack still relies on `'unsafe-inline'` (and dev `'unsafe-eval'`) for practical compatibility | Introduce nonce plumbing in proxy/layout, remove inline allowances incrementally, add CSP regression tests |
| P1 | Add automated production config drift checks for security-critical env/platform settings | Vercel/Supabase dashboard settings are partially manual | Add release script/checklist automation to assert required env vars, redirect origins, and auth settings |
| P2 | Add security header conformance tests in CI | Header posture is code-defined but currently validated manually | Add integration tests to verify required headers for public/auth routes |
| P2 | Expand launch runbook with incident playbooks for auth callback/redirect failures | Current docs define guardrails but not full operator runbook | Add operational runbook with rollback steps and alert triage paths |
| P2 | Add stronger session hardening options if product requires (single-session/timebox policy) | Depends on product UX and Supabase plan/config decisions | Define approved session policy and enforce via dashboard + docs |
| P3 | Add CSP report-only telemetry pipeline before strict CSP rollout | No CSP violation telemetry sink configured | Add `Content-Security-Policy-Report-Only` with durable ingestion endpoint |
| P3 | Evaluate Google OAuth rollout hardening if social sign-in becomes a product requirement | Not in current app scope | Implement OAuth code path + provider hardening checklist and tests |

## Ownership and review cadence

- Security debt owner: repository maintainer / security track owner.
- Review cadence: at least once per release cycle.
- Rule: blockers cannot be moved into this file to bypass launch gates.
