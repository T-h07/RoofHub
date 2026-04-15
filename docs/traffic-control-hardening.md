# API Abuse and Rate-Limit Controls (SH-PT06)

## Purpose

This document defines RoofHub's baseline traffic-control posture for high-risk server actions and route handlers.

SH-PT06 adds targeted anti-abuse controls for brute-force, spam, and mutation flooding without replacing the existing Next.js + Supabase architecture.

## Strategy

Traffic controls are enforced server-side through a shared guard:

- helper: `src/lib/security/traffic-control.ts`
- storage + decision function:
  - `public.rate_limit_counters`
  - `public.consume_rate_limit_token(...)`
  - migration: `supabase/migrations/20260410121500_nm_sh_pt06_traffic_controls.sql`

Key model:

- controls run at the real mutation/read execution boundary (server action/route handler), not only in UI
- actor fingerprints are hashed (user/email/ip/scope combinations), so raw identifiers are not stored in limiter rows
- throttled requests return bounded user-safe messages with retry guidance
- unavailable limiter state fails closed for protected actions with bounded retry messaging

## Abuse-surface map and guarded flows

### Brute-force-sensitive

- `signInAction`
  - per-IP and per-email controls
- `signUpAction`
  - per-IP and per-email controls
- `requestPasswordResetAction`
  - per-IP and per-email controls
- `/auth/callback`
  - per-IP callback exchange guard

### Spam-sensitive

- `createOrGetConversationForListingAction`
  - per-user and per-listing conversation-creation controls
- `sendConversationMessageAction`
  - per-conversation burst control and per-user hourly control
- `submitListingReportAction`
  - per-user and per-listing report controls

### High-impact mutation-sensitive

- `saveProviderWizardStepAction` (listing draft create/edit steps)
  - per-user draft-save control
- `syncProviderListingPhotosAction`
  - per-listing photo-sync control
- `publishProviderListingDraftAction`
  - per-listing publish control
- `updateProviderListingLifecycleStatusAction`
  - per-listing status-transition control
- `transitionCompanyListingWorkflowAction`
  - per-user company listing workflow mutation control (scoped by listing id + action)
- `updateListingModerationVisibilityAction`
  - per-admin moderation mutation control
- `createCompanyWorkspaceAction`
  - per-IP company workspace bootstrap control
  - per-user company workspace bootstrap control
- `createCompanyTeamInviteAction`
  - per-user company invite creation control
- `revokeCompanyTeamInviteAction`
  - per-user company member-mutation control (scoped by invite id)
- `updateCompanyTeamMemberRoleAction`
  - per-user company member-mutation control (scoped by membership id)
- `updateCompanyTeamMemberStatusAction`
  - per-user company member-mutation control (scoped by membership id)
- `removeCompanyTeamMemberAction`
  - per-user company member-mutation control (scoped by membership id)
- `acceptCompanyTeamInviteAction`
  - per-user invite-acceptance control

### Resource-consumption-sensitive

- `/api/internal/supabase` probe route
  - per-IP probe control
- public map marker query bound tightened:
  - `PUBLIC_MAP_MARKER_LIMIT`: `250` (was `350`)
- explore city-options query bound tightened:
  - city option cap: `180` (was `250`)

## Guardrail rules for future PTs

- Do not add new sensitive mutations without explicit server-side traffic-control review.
- Do not rely on UI debounce/throttle as a security control.
- Keep controls scoped by risk:
  - auth brute-force controls
  - messaging/report spam controls
  - provider/admin mutation burst controls
- Prefer layered controls for high-risk auth paths (for example per-IP + per-account scope).
- Keep user-facing throttle errors clear and bounded; never expose backend internals.
- Keep limits maintainable; avoid global one-size-fits-all caps.
- Any change to `TRAFFIC_CONTROL_RULES` must be documented here and reviewed against usability impact.

## Fallback behavior

- Throttled requests:
  - return a bounded message with explicit retry window guidance
  - route handlers set `Retry-After` when applicable
- Limiter unavailable:
  - guarded actions return bounded "temporarily unavailable" style errors
  - no raw storage/RPC internals are exposed

## Deferred from SH-PT06

- adaptive/risk-scored anti-abuse logic
- CAPTCHA/challenge flows for targeted attack spikes
- infrastructure-level WAF tuning beyond repo-controlled code
- centralized abuse telemetry and alerting pipeline (planned security observability track)

## Validation notes

SH-PT06 validation should confirm:

- repeated auth attempts are constrained by configured windows
- repeated message sends/conversation creation are constrained
- repeated report submissions are constrained
- provider mutations remain usable under normal pacing
- moderation controls are still available to admins with bounded mutation rates
- throttled responses remain understandable and non-sensitive
