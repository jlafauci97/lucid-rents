# Review Flow Redesign

Rebuild the review submission wizard as a 6-step sidebar wizard inspired by Openigloo's UX, styled to the Lucid Rents brand (navy #0F1D2E, blue accent #3B82F6, Sora font). Adds new data fields (tenancy details, amenity confirmation, photo upload) while keeping the existing 7 review categories and subcategory issue flags.

## Step Structure

### Step 1: Building

- Address search with debounced autocomplete (existing behavior)
- Unit number — **required** (changed from optional)
- Residency status — Current / Past resident pill toggle
- Display preference — "First name + last initial" (default) / "Anonymous" toggle. Name pulled from user profile; this controls how the review appears publicly. Stored as `reviewer_display_preference` on the review row.

### Step 2: Ratings

- 7 existing categories: Noise, Physical Condition, Pests, Building Management, Utilities, Safety, General Living
- Each category: icon + name + description + 5-star rating
- When a category is rated 3 or below, subcategory issue flags expand below (existing behavior — pill badges the user can toggle)
- No overall rating field — auto-calculated on submit as the simple mean of all rated categories, rounded to the nearest 0.5. Computed server-side in the API route. At least one category must be rated (enforced by step 2 validation).

### Step 3: Your Review

- Review title (required, text input)
- Review body (required, textarea, 10-5000 characters)
- **Pro tags**: grid of 50 common positive tags (e.g., "Great management", "Quiet building", "Good natural light", "Responsive maintenance", "Pet friendly"). User clicks to toggle. Selected tags display with a green accent. At least one pro tag required.
- **Con tags**: grid of 50 common negative tags (e.g., "Thin walls", "Creaky floors", "Pest issues", "Slow maintenance", "Noisy neighbors"). User clicks to toggle. Selected tags display with a red accent. At least one con tag required.
- Tags are displayed as compact pills. Selected tags are visually prominent; unselected are muted/outline style.
- On the published ReviewCard, selected tags appear as small colored badges below the review body.

### Step 4: Your Tenancy

- Move-in date (required, date picker)
- Move-out date (conditional — only shown for past residents, required if shown)
- Lease type (required, select — city-specific options from LEASE_TYPES_BY_CITY)
- Monthly rent amount (required, number input with $ prefix)
- Landlord/management company name (optional, text input)
- "Would you recommend this building?" — Yes / No pill toggle (required)
- "Is this building pet friendly?" — Yes / No pill toggle (optional)


### Step 5: Unit Details

- **Amenity confirmation**: categorized checklist of amenities. Pre-populated with known building amenities from scraped data (pre-checked). Reviewer can uncheck incorrect ones and check additional ones from the full amenity list. Categories: Building, Outdoor, Fitness, Parking & Bikes, Laundry, Security, Pet Friendly, Storage, Luxury, Other.
- **Photo upload**: drag-and-drop zone + browse button. Accepts images only (jpg, png, webp, max 10MB each, max 5 photos). Shows thumbnail previews with remove button. Optional step — user can skip. Photos uploaded client-side directly to Supabase Storage before review submission. On submit, the API route receives the storage paths and creates `review_photos` rows. If a photo upload fails, the user sees an error on that photo and can retry or remove it — it does not block review submission.

### Step 6: Review & Submit

- Summary card showing all entered data organized by step
- Each section has an "Edit" link that jumps back to that step
- Building address + unit displayed at top
- Category ratings shown with star display + flagged issues
- Review title and body preview
- Tenancy details in a compact grid
- Amenities shown as pills
- Photo thumbnails
- Submit button at bottom

## Layout

### Desktop (>= 768px)

- **Left sidebar** (240px, fixed): navy (#0F1D2E) background
  - Building name displayed at top once selected (step 1 complete)
  - Numbered step list: active step highlighted with blue (#3B82F6) circle, completed steps show green (#10b981) checkmark, future steps are gray
  - Clicking a completed step jumps back to it
  - "Auto-saved" indicator with subtle timestamp at bottom of sidebar
- **Right content area**: white card with border (#e2e8f0), max-width 640px, centered
  - Step title (h2) + optional subtitle
  - Step content
  - Back (outline) / Next (blue filled) buttons anchored at bottom-right

### Mobile (< 768px)

- Sidebar collapses into a horizontal compact step bar at top
- Shows current step number + name, small dots for other steps
- Tapping dots opens dropdown showing all steps (completed ones clickable)
- Content goes full-width below with standard padding

## Database Changes

### New columns on `reviews` table

```sql
ALTER TABLE reviews ADD COLUMN landlord_name text;
ALTER TABLE reviews ADD COLUMN would_recommend boolean;
ALTER TABLE reviews ADD COLUMN is_pet_friendly boolean;

ALTER TABLE reviews ADD COLUMN reviewer_display_preference text NOT NULL DEFAULT 'name' CHECK (reviewer_display_preference IN ('name', 'anonymous'));
```

- `rent_amount` — change to required in form validation only (column already exists, NOT NULL not added to preserve scraped reviews without rent data)
- `lease_type` — change to required in form validation only (column already exists)
- `move_in_date` — change to required in form validation only (column already exists)
- `overall_rating` — auto-calculated server-side from category rating average on submit (column already exists, keeps being written to)
- `unit_number` — required in form validation only (NOT NULL not added to DB to preserve existing scraped reviews without units)

### Fix: Add `"rlto"` to `LeaseType` union in `src/types/index.ts`

The existing `LeaseType` union is missing `"rlto"` which is used by `LEASE_TYPES_BY_CITY` for Chicago. Add it during implementation.

### New columns on `reviews` table (continued)

```sql
ALTER TABLE reviews ADD COLUMN pro_tags text[] DEFAULT '{}';
ALTER TABLE reviews ADD COLUMN con_tags text[] DEFAULT '{}';
```

Pro/con tags stored as Postgres text arrays directly on the review row. The 50 pro and 50 con tag options are defined in `src/lib/constants.ts` as `REVIEW_PRO_TAGS` and `REVIEW_CON_TAGS`.

### New table: `review_photos`

```sql
CREATE TABLE review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_review_photos_review_id ON review_photos (review_id);
```

Photos stored in Supabase Storage bucket `review-photos`. Photos uploaded client-side directly to Storage; API route receives storage paths and creates rows.

### New table: `review_amenities`

```sql
CREATE TABLE review_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id),
  amenity text NOT NULL,
  category text NOT NULL,
  confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_review_amenities_building ON review_amenities (building_id, amenity);
```

Stores which amenities the reviewer confirmed or added. Can be aggregated to crowdsource amenity data for buildings without scraped amenities.

## Component Architecture

### New/Modified Files

- `src/components/review/ReviewWizard.tsx` — new top-level component replacing ReviewForm. Manages step state, sidebar, navigation, auto-save.
- `src/components/review/steps/BuildingStep.tsx` — step 1
- `src/components/review/steps/RatingsStep.tsx` — step 2
- `src/components/review/steps/ReviewStep.tsx` — step 3
- `src/components/review/steps/TenancyStep.tsx` — step 4
- `src/components/review/steps/UnitDetailsStep.tsx` — step 5 (amenities + photos)
- `src/components/review/steps/SummaryStep.tsx` — step 6
- `src/components/review/ReviewSidebar.tsx` — sidebar navigation component
- `src/components/ui/PillToggle.tsx` — reusable Yes/No/N-A pill toggle component
- `src/components/ui/PhotoUpload.tsx` — drag-and-drop photo upload with previews
- `src/components/ui/AmenityChecklist.tsx` — categorized amenity checkbox list
- `src/components/ui/TagSelector.tsx` — reusable tag grid component (used for both pro and con tags)

### Modified Files

- `src/components/review/ReviewCard.tsx` — handle reviewer identity display. Resolution order: if `reviewer_display_preference` is `'name'`, show `profile.display_name` or `reviewer_name` with first-letter avatar; if `'anonymous'` or null (old reviews), show generic user icon. Update `ReviewWithDetails` type to include `reviewer_display_preference`.
- `src/app/[city]/review/new/page.tsx` — swap ReviewForm for ReviewWizard
- `src/app/api/reviews/route.ts` — accept new fields, auto-calculate overall_rating (mean of rated categories rounded to nearest 0.5, server-side), save photo storage paths to review_photos, save amenity confirmations to review_amenities
- `src/types/index.ts` — add new fields to Review interface, add `"rlto"` to LeaseType union, add ReviewPhoto and ReviewAmenity interfaces, update ReviewWithDetails to include `reviewer_display_preference`
- `src/lib/validators.ts` — update Zod schema for new required/optional fields

### Deprecated

- `src/components/review/ReviewForm.tsx` — replaced by ReviewWizard. Delete after migration.

## Auto-Save Behavior

Form state saved to localStorage with a composite key: `review-draft-{buildingId}`. Before building is selected in step 1, partial state (unit number, residency status, display preference) is saved under the key `review-draft-pending`. Once a building is selected, pending state merges into the building-specific key and `review-draft-pending` is cleared.

On return to the form for the same building, restore saved state. Clear on successful submit. Show "Draft saved" indicator in sidebar with relative timestamp.

If the user navigates to a review form with a different building while a draft exists, the new building's form starts fresh (drafts are per-building, no cross-contamination).

## Validation

- Step 1: building selected + unit number filled
- Step 2: at least one category rated
- Step 3: title filled + body >= 10 characters + at least one pro tag + at least one con tag
- Step 4: move-in date + lease type + rent amount + would_recommend filled
- Step 5: no validation required (optional step)
- Step 6: no validation (summary only)

Next button disabled until current step validates. Steps can be revisited by clicking completed steps in sidebar.

## Display Changes

ReviewCard handles reviewer identity via `reviewer_display_preference`:
- `'name'`: show first letter avatar + name from `profile.display_name` or `reviewer_name`
- `'anonymous'` or null (old reviews): show generic user icon + "Anonymous" label

Existing reviews with no `reviewer_display_preference` continue showing as anonymous (backward compatible).
