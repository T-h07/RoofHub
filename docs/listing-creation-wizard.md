# Listing Creation Wizard (PT16)

## Objective

Establish the first provider-side listing creation flow with real Supabase persistence, role-safe ownership boundaries, and a reusable step architecture for PT17/PT18 extensions.

## Routes

- `GET /dashboard`
  - Provider dashboard surface with draft listing summaries and entry CTA.
- `GET /dashboard/listings/new`
  - New listing wizard entry (provider-only).
- `GET /dashboard/listings/[id]/edit?step=<step>`
  - Existing draft editor with URL-synced wizard step state.

`step` values:

- `basics`
- `pricing`
- `facts`
- `location` (added in PT17)
- `amenities`
- `contact`
- `review`

## Access and Ownership Model

- Authentication uses existing protected `/dashboard` route handling.
- Wizard route handlers enforce provider role (`provider` or `admin`) before rendering mutation surfaces.
- Draft mutations use server-side profile identity, never client owner ids.
- Listing updates are owner-scoped (or admin-scoped) and remain aligned with existing `listings` RLS policies.

## Draft Persistence Strategy

- Draft is created from `basics` step using a stable id and provider ownership.
- After initial creation, flow redirects to id-based editor route:
  - `/dashboard/listings/[id]/edit`
- Each step saves to Supabase via server actions.
- Retry behavior is id-safe for draft creation (duplicate id conflict resumes same draft instead of creating a second row).

## Wizard Field Coverage (PT16)

### 1) Basics

- `title`
- `description`

### 2) Type and Pricing

- `listing_type`
- `property_type`
- `price_amount`
- `currency_code`
- `deposit_amount` (rent-aware)

### 3) Property Facts

- `area_m2`
- `bedrooms`
- `bathrooms`
- `floor_number`
- `total_floors`
- `city`
- `neighborhood`
- `address_text`
- `available_from`

### 4) Amenities

- `furnished`
- `parking`
- `pets_allowed`
- `elevator`
- `balcony`
- `internet_included`
- `utilities_included`
- `heating_type`

### 5) Contact Settings

Profile-backed (not listing-column-backed in PT16):

- `profiles.preferred_contact_method`
- `profiles.phone`

### 6) Review

- Draft completeness validation across prior required sections.
- Section-level edit shortcuts back into wizard steps.
- Clear distinction between PT16 draft readiness and future publish readiness.

## Validation Model

- Step-level validation before advancing.
- Field-level error surfaces in each step UI.
- Review validation reports incomplete sections as blockers.
- Validation intentionally allows draft flexibility while preventing structurally invalid data.

## Schema Adjustment for Draft Compatibility

Migration added:

- `supabase/migrations/20260409114500_nm_pt16_listing_draft_location_nullable.sql`

Changes:

- `listings.latitude` and `listings.longitude` are nullable for draft lifecycle.
- New constraint requires both coordinates when `listing_status = 'published'`.

This keeps PT16 map-free draft flow valid while preserving publish-time location guarantees for PT17/PT18.

## PT18 Extension Path

PT17 now extends the PT16 wizard with:

- dedicated location step
- map pin placement + drag adjustment
- coordinate persistence
- exact vs approximate public location mode controls

PT18 should extend review/publish lifecycle by adding:

- photo upload management
- publish readiness checks
- publish transition actions
