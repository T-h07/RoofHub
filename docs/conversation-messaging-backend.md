# Conversation Model and Messaging Backend (PT21)

## Scope

PT21 establishes the backend/domain layer for listing-bound conversations and persisted messages.

This milestone intentionally does **not** implement the full inbox/thread UI or realtime transport.

## Core Conversation Rule

Conversation creation is implemented in:

- `src/lib/messaging/actions.ts` (`createOrGetConversationForListingAction`)

Rules enforced:

- new conversations are created only from a real listing id
- provider participant is derived from `listings.owner_id`
- seeker participant is derived from the authenticated viewer profile
- only seeker-role accounts can initiate new listing conversations
- self-conversations are blocked (`provider_id <> seeker_id`)
- listing must be contactable (`listing_status = 'published'`)

## One Thread per Seeker + Provider + Listing

DB constraint already exists from PT04:

- `conversations_listing_participants_unique (listing_id, provider_id, seeker_id)`

PT21 create-or-get flow behavior:

- inserts a new conversation when none exists
- on unique conflict (`23505`), loads and returns the existing thread
- repeated contact attempts reuse the same conversation id

## Message Persistence

Message send is implemented in:

- `src/lib/messaging/actions.ts` (`sendConversationMessageAction`)

Behavior:

- sender id is always authenticated user id (no sender spoofing)
- empty/oversized payloads are rejected
- messages persist in `public.messages`
- each message is bound to exactly one `conversation_id`

## Unread State Foundation

Unread model uses existing `messages.read_at`:

- unread for a participant = messages in that conversation where:
  - `sender_id != current_user_id`
  - `read_at is null`
- `markConversationReadAction` marks counterpart messages as read
- provider unread lead count is now queryable via:
  - `loadProviderUnreadLeadCount(...)` in `src/lib/messaging/queries.ts`

## Participant Ownership and Access Rules

Access remains participant-only at the data layer:

- `conversations`: participant/admin select
- `messages`: participant/admin select
- message insert requires sender to be a conversation participant

PT21 adds stronger write guards in migration:

- `supabase/migrations/20260409234000_nm_pt21_conversations_messaging_backend.sql`

Added hardening:

- seeker-only conversation insert policy for published listings
- trigger-driven `conversations.last_message_at` updates on message insert
- participant message updates restricted to read-state changes (content immutability guard)
- conversation participant/listing context immutability on update

## Listing Status Contactability Rule

For **new** conversations:

- allowed only when listing is `published`

For **existing** conversations:

- participants can continue thread access even if listing status changes later
- listing snippet visibility in conversation queries depends on current listing read policies/RLS

## Query Foundations for PT22

Server query helpers are implemented in:

- `src/lib/messaging/queries.ts`

Available query primitives:

- `loadMessagingConversationSummariesQuery(...)`
- `loadMessagingThreadQuery(...)`
- `loadProviderUnreadLeadCount(...)`

These provide typed, backend-first conversation summary/thread data without requiring UI stubs.

## Route Integration

`/messages` now uses the backend contact handoff:

- `?listingId=<id>` triggers create-or-get conversation logic
- route canonicalizes to `?conversationId=<id>`
- scaffold copy now reflects real backend state instead of static placeholder-only messaging

Listing detail contact CTA now links with listing context only:

- `src/app/listing/[slug]/page.tsx` -> `/messages?listingId=<listing-id>`

## PT22 / PT23 Handoff

PT22 can now build the full inbox/thread UI directly on top of:

- create-or-get conversation action
- send message action
- mark-read action
- typed conversation summary/thread query helpers

PT23 can add realtime subscriptions and live unread updates on top of the same persisted model and participant rules, without redesigning conversation identity or ownership semantics.