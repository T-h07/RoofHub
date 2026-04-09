# Messaging UI (PT22)

## Scope

PT22 adds the authenticated inbox/chat interface on top of PT21 messaging backend rules.

This milestone intentionally does **not** add realtime transport (PT23).

## Route Model

- Authenticated route: `/messages`
- Listing contact handoff: `/messages?listingId=<listing-id>`
- Canonical thread route: `/messages?conversationId=<conversation-id>`

Behavior:

- listing handoff uses PT21 create-or-get conversation action
- successful handoff canonicalizes to `conversationId`
- invalid/blocked handoff returns a non-raw user-facing error banner

## UI Structure

Main UI composition:

- conversation list pane
- thread panel
- message composer

Responsive behavior:

- desktop/tablet: split list + thread layout
- mobile: list -> thread drill-in pattern with back action to list

## Conversation List

Conversation list is loaded from:

- `loadMessagingConversationSummariesQuery(...)`

List includes:

- listing title/context
- participant context label (provider/seeker-safe fallback)
- last message preview
- activity timestamp
- unread count badge

Empty state:

- guides users to start from listing detail contact flow

## Thread Panel

Thread panel is loaded from:

- `loadMessagingThreadQuery(...)`

Thread includes:

- listing context header (title, status badge, location/price summary)
- listing cover image (when available via signed URL)
- listing deep-link to `/listing/[slug]` when available
- chronological message history with day separators and per-message timestamps

Read-state integration:

- opening a thread triggers `markConversationReadAction(...)` server-side before data load

## Message Composer

Message composer behavior:

- validates trimmed non-empty message body
- enforces PT21 message length limit
- sends through `sendConversationMessageAction(...)`
- surfaces pending/error states cleanly
- updates active thread and conversation summary locally after successful send

## Unread State Surface

Unread data source remains PT21 `messages.read_at` model.

PT22 UI behavior:

- unread badges appear per-thread in list
- unread aggregate appears in inbox list header
- unread clears when thread is opened (server mark-read call)

## Loading / Error / Recovery

Implemented states:

- route loading skeleton: `src/app/messages/loading.tsx`
- inbox load failure empty-state
- thread-specific unavailable state with back-to-inbox recovery
- send failure inline error + toast

No raw backend internals are shown to end users.

## Notes and Limitations

- Counterpart display names are not exposed in PT22 because existing profile RLS policies are self/admin scoped; UI uses participant-role-safe labels instead.
- Realtime updates are not part of PT22 and are intentionally deferred to PT23.

## PT23 Handoff

PT23 can now add realtime behavior on top of this stable UI structure:

- live thread insert subscriptions
- conversation list live ordering/unread updates
- optimistic send reconciliation
- reconnect/fallback handling without replacing PT22 layout components
