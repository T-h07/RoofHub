# Realtime Messaging (PT23)

## Scope

PT23 upgrades PT22 inbox/chat surfaces with live message sync across tabs/sessions while keeping PT21 ownership and participant rules intact.

## Realtime Approach

Chosen approach: **Supabase Realtime Postgres Changes** on `public.messages` (plus `public.conversations` insert awareness).

Why this approach:

- reuses existing PT21 persisted tables and RLS participant policies
- avoids introducing a second event bus or custom broadcast protocol
- keeps message identity anchored to persisted row ids for reconciliation
- remains maintainable for Next.js App Router + Supabase browser client setup

## Subscription Scoping

Realtime listeners are scoped in `src/components/messages/messages-workspace.tsx`:

- message insert/update listener with filter:
  - `conversation_id=in.(<current-user-conversation-ids>)`
- conversation insert listeners with participant filters:
  - `provider_id=eq.<viewer-id>`
  - `seeker_id=eq.<viewer-id>`

No global all-message subscription is used in UI state handling.

## Optimistic Send + Reconciliation

Implemented in `MessagesWorkspace`:

- composer send immediately inserts a local optimistic message (`clientState: "pending"`)
- server action persists via `sendConversationMessageAction(...)`
- persisted message reconciliation:
  - optimistic entry is replaced/removed
  - duplicate prevention is applied by message id
  - inbound realtime inserts also reconcile against pending optimistic entries

This prevents optimistic + realtime double-render collisions.

## Unread Live Updates

Unread model still relies on PT21 `messages.read_at`.

PT23 behavior:

- inbound message inserts increment unread count for non-open conversations
- open-thread inbound messages keep unread at zero and trigger `markConversationReadAction(...)`
- message update events (`read_at` changes) clear unread badges for affected conversations across tabs/sessions

## Thread Refresh Behavior

Thread panel now:

- appends incoming messages live in chronological order
- keeps ordering deterministic during optimistic/persisted reconciliation
- auto-scrolls when user is near bottom or when own outbound message appears
- avoids stale thread state when conversation context changes

## Fallback + Recovery

When realtime channel status degrades (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`):

- UI enters fallback mode with explicit messaging
- periodic server refresh is activated (15s)
- manual `Refresh now` control is available
- `Retry live sync` recreates subscriptions
- successful re-subscribe triggers resync

This avoids silent stale inbox behavior.

## Files Updated for PT23

- `src/lib/messaging/client-model.ts`
- `src/lib/messaging/actions.ts`
- `src/lib/messaging/index.ts`
- `src/components/messages/messages-workspace.tsx`
- `src/components/messages/messages-conversation-list.tsx`
- `src/components/messages/messages-thread-panel.tsx`
- `README.md`
- `docs/realtime-messaging.md`

## Next PT Handoff

Next messaging iteration can build on this realtime core for:

- richer inbox badges in provider dashboard surfaces
- presence/typing or notification hooks without changing conversation identity
- stronger retry UX and offline-aware send queueing if needed
