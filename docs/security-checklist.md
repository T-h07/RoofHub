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
- [ ] Provider actions remain owner-scoped; admin is not implicitly treated as provider-owner in provider flows.
- [ ] Messaging list/thread/send/read actions enforce participant-only access.
- [ ] RLS assumptions are preserved (no app-side bypass pattern introduced).

## Input and output safety

- [ ] Route params, query params, and form/body payloads are validated and typed.
- [ ] Sensitive server-action payloads include runtime shape checks (not TypeScript-only assumptions).
- [ ] Numeric/date parsing uses strict token validation (no permissive partial parse behavior).
- [ ] Callback and redirect parameters are sanitized and constrained to safe targets.
- [ ] Unsafe or unbounded parsing paths were not introduced.
- [ ] User-generated text is rendered safely (no unsafe HTML interpolation).
- [ ] User-facing errors do not expose raw backend/provider exception text.
- [ ] Public/private data exposure was reviewed for all changed queries/responses.
- [ ] Changes preserve `docs/request-output-validation-hardening.md` guardrails.

## Traffic controls and abuse resistance

- [ ] New high-risk auth/messaging/report/provider/admin mutation paths were evaluated for rate limiting.
- [ ] Traffic controls are enforced server-side (not only in client/UI behavior).
- [ ] Layered controls were considered where needed (for example per-IP and per-account for auth flows).
- [ ] Throttled responses are bounded, user-safe, and provide retry guidance when appropriate.
- [ ] Resource-heavy routes/actions remain bounded (page size/marker/query caps) and are not trivially floodable.
- [ ] Changes preserve `docs/traffic-control-hardening.md` rules for guarded flows.

## Storage and visibility

- [ ] Upload constraints are enforced (type, size, count).
- [ ] Image content signature checks are enforced for accepted upload types where applicable.
- [ ] Storage paths remain deterministic and ownership-scoped.
- [ ] Listing image path shape remains strict (`owner/{owner_uuid}/listing/{listing_uuid}/{uuid}.{ext}`).
- [ ] Delete/sync operations verify object ownership/path validity.
- [ ] Upload flow avoids ambiguous overwrite behavior (`upsert: false` default unless explicitly justified).
- [ ] Listing/report/message visibility still respects status and participant rules.
- [ ] Moderation-related status transitions still enforce admin authority.

## Errors, logging, and secrets

- [ ] User-facing errors are clear but do not reveal sensitive internals.
- [ ] Logs avoid secrets/tokens/passwords/cookies/auth codes.
- [ ] No real secrets were added to code, docs, fixtures, or committed env files.
- [ ] `NEXT_PUBLIC_*` variables were reviewed to ensure no secret values are required.

## Audit trails and observability

- [ ] Security-relevant auth, provider, moderation, report, and messaging-critical actions are auditable.
- [ ] Structured audit events include explicit actor/target/context fields (no ad-hoc free-text-only logs).
- [ ] Audit metadata is sanitized/redacted and excludes raw secrets/tokens/message bodies.
- [ ] Durable audit storage access boundaries were reviewed (admin-only history, no public exposure).
- [ ] Changes preserve `docs/audit-observability-hardening.md` event and redaction rules.

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

## Production release readiness (when preparing launch or major environment rollout)

- [ ] `docs/production-hardening-launch-review.md` is current and status markers are accurate.
- [ ] `docs/security-launch-blockers.md` is reviewed and all blockers are either resolved or explicitly accepted by launch owner.
- [ ] `docs/security-debt-register.md` is reviewed and does not contain disguised launch blockers.
- [ ] Production `AUTH_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SITE_URL`, and Supabase redirect/site URL settings are verified to match deployed domains.

## NM-PT32 validation notes

- Company profile and branding mutations are owner-scoped through server-side membership resolution.
- Company logo storage paths are canonicalized and policy-validated (`organization/{organization_uuid}/{uuid}.{ext}`).
- Public company route exposure is constrained to active organizations plus published listings.
- Company profile input validation covers name, description, contact email/phone, website URL, and coverage text bounds.
- Structured audit events capture company profile/logo success and failure outcomes without secret-bearing metadata.

## NM-PT33 validation notes

- Team invite creation is owner/admin-scoped and server-enforced through membership-derived context.
- Invite acceptance is tied to authenticated identity (target user id or normalized invite-email match).
- Membership role/status/remove mutations are owner/admin-scoped with admin anti-escalation limits.
- Last-owner protections prevent role/status/remove operations from removing final active owner coverage.
- Invite/member actions are traffic-controlled and recorded through structured audit events.

## NM-PT34 validation notes

- Listings now support nullable `organization_id` with backward-compatible individual ownership.
- Listing actor attribution fields (`created_by_user_id`, `assigned_agent_user_id`, `published_by_user_id`) are persisted in schema and write paths.
- Provider listing creation resolves company ownership server-side from active membership context; client payload does not choose organization ownership.
- Listings insert/update/delete RLS policies now require active organization membership when `organization_id` is present.
- Listing image owner-scoped policies now enforce the same active membership requirement for company-owned listings.
- Public company profile listing feed and workspace listing counts resolve organization-owned listings with legacy owner fallback.

## NM-PT35 validation notes

- Company-owned listings now use enforced workflow statuses (`draft`, `submitted_for_review`, `needs_changes`, `approved`, `published`, `unpublished`).
- Company workflow transitions are server-trusted through a dedicated RPC with role + transition enforcement; client status toggles are not authority.
- Reviewer actions (`needs_changes`, `approve`, `publish`, `unpublish`) are restricted to owner/admin/manager roles; submit is constrained to creator/assigned-agent/reviewer.
- Submit-for-review now enforces server-side review readiness checks (same baseline validation family as publish-readiness, including required details and cover-photo presence).
- Company workflow actions are traffic-controlled at server action boundaries with listing/action scoped limits.
- Company workflow notes and timeline events are persisted (`listing_workflow_events`) and membership-scoped for reads.
- Public listing visibility remains restricted to `listing_status = 'published'`; company `approved` state is internal-only until explicit publish.
