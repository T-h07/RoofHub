# Provider Map Pin Placement Flow (NM-PT17)

This document describes the provider listing-location flow added on top of the PT16 draft wizard.

## Route Integration

PT17 extends existing provider routes instead of introducing a disconnected map page:

- `/dashboard/listings/new`
- `/dashboard/listings/[id]/edit?step=<wizard-step>`

Wizard steps now include:

- `basics`
- `pricing`
- `facts`
- `location`
- `amenities`
- `contact`
- `review`

## Location Step Behavior

Location is handled in the new wizard `location` step:

- click/tap map to place pin
- drag marker to refine coordinates
- clear pin when needed
- fallback coordinate inputs for manual correction/recovery

Map component:

- `src/components/listings/provider-location-picker-map.tsx`

Wizard integration:

- `src/components/listings/provider-listing-wizard.tsx`

The location step is designed for desktop and mobile touch interaction, with explicit guidance text and concise controls.

## Persistence Model

Location data persists through the existing server action flow:

- `src/lib/listings/provider-wizard/actions.ts`

Step mutation path:

- `saveProviderWizardStepAction` now handles `step === "location"`
- owner/admin scope checks remain enforced before update
- persisted fields:
  - `latitude`
  - `longitude`
  - `address_text`
  - `public_location_mode`

Draft continuity remains id-based, so provider reload/edit routes restore saved pin state.

## Address Text and Pin Relationship

Address text is complementary metadata, not a geocoding source in PT17:

- map pin determines coordinates
- address text provides human context
- UI copy explicitly avoids implying address auto-places the marker

## Public Location Mode (Exact vs Approximate)

Provider-facing control supports:

- `exact`
- `approximate`

Meaning:

- system stores exact internal coordinates for provider workflow
- public rendering mode is selected per listing for seeker-facing map visibility behavior

`hidden` is intentionally not exposed in this PT17 provider step.

## Validation

Location validation is now a first-class wizard validator:

- `src/lib/listings/provider-wizard/validation.ts`

Rules:

- pin is required for passing `location` step validation
- latitude and longitude ranges are validated
- public location mode must be selected (`exact` or `approximate`)
- review-step blockers now include location readiness

## Review Step Integration

Review summary now includes:

- coordinate preview
- address text summary
- selected public mode
- direct jumpback to `location` step

This keeps draft quality checks coherent before PT18 media/publish work.

## PT18+ Extension Path

PT18 can build directly on this foundation by adding:

- photo upload + management in the same draft lifecycle
- publish readiness checks that include existing location validation
- publish transitions relying on already-persisted coordinates and public mode

PT19/PT20 can extend provider editing/status management without replacing the location architecture.
