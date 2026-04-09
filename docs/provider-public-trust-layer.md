# Provider Public Trust Layer (PT25)

## Scope

PT25 strengthens listing-detail provider trust presentation with grounded, privacy-safe signals:

- public provider summary refinement on listing detail
- joined-date trust cue (`Member since ...`)
- published listing count trust cue
- conditional verified-email indicator plumbing (shown only when a reliable public source exists)

This PT does not add reviews/ratings, fake response metrics, or identity/KYC systems.

## Public Provider Summary Surface

Primary UI surface:

- `src/components/listings/listing-provider-card.tsx`

Data source:

- `src/lib/listings/public-listing-detail.ts`

The provider card now separates:

- identity (name/avatar/context)
- trust metadata
- contact guidance and available contact methods

## Public-Safe Trust Signals

Current public trust signals:

- provider display name
- avatar URL (when set)
- member since (from profile `created_at`)
- published listing count

Signals intentionally deferred:

- verified email (hidden unless a reliable public verification source is available)
- response-rate/response-time metrics (not shown; no fake placeholders)

## Listing Count Definition

`publishedListingCount` is defined as:

- **the number of listings owned by the provider with `listing_status = 'published'`**

This definition is intentionally public-facing and avoids mixing draft/paused/archived/internal states into a trust signal shown to seekers.

## Verified Email Indicator Rule

The UI model includes an `emailVerified` field, but indicator rendering is strictly conditional:

- show only when `emailVerified === true`
- hide for `false`/`null`

Current state:

- no reliable public verification field is exposed yet, so the indicator is currently not displayed

This avoids misleading “verified” claims.

## Privacy Rules

PT25 keeps trust metadata constrained to fields already intended for listing-facing provider context.

It does not introduce:

- admin-only internals
- fabricated trust badges
- fake response analytics

## Future Extension Path

Future PTs can extend this trust layer by adding:

- verified-email derivation from a dedicated public-safe source
- moderation-safe provider trust flags
- real response quality metrics once backend support exists

without replacing the PT25 provider summary structure.
