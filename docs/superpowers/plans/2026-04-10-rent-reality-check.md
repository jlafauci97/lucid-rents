# Rent Reality Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a user-facing "Rent Reality Check" feature that, for any listing with an asking price, tells the renter: (1) how that price compares to historical rents in the same building, (2) how it compares to the neighborhood, (3) what a reasonable counter-offer range looks like — all computed from the 12-year Dewey rent history we already ingest.

**Context — what already exists:** ~85% of the foundation is built and shipped:

- **`RentComparison`** (`src/components/building/RentComparison.tsx:1-256`) — compares building median to neighborhood median by bedroom count with ±20% verdict thresholds. Props already support `historicalContext` and `rentTrajectory` (unused).
- **`RentIntelligence`** (`src/components/building/RentIntelligence.tsx:1-444`) — trend since 2019, seasonal "best month to move" panel.
- **`RentHistoryChart`** (`src/components/building/RentHistoryChart.tsx:1-451`) — 6+ year building + neighborhood line chart with YoY badge.
- **`DeferredRentIntelligenceSection`** (`src/components/building/sections/DeferredRentIntelligenceSection.tsx`) — already queries `dewey_building_rents`, `dewey_neighborhood_rents`, `dewey_amenity_premiums`, `dewey_seasonal_index` and computes a `valueGrade` (A–F) at lines ~56–87.
- **`AmenityPremiums`** (`src/components/building/AmenityPremiums.tsx`) — dollar premium per amenity, violation discount.

**What's missing:** None of these components *consume the current listing's asking price*. They all operate on building-level aggregates. The Rent Reality Check is the thin glue layer that compares **this specific listing's asking rent** to the signals we already compute, and turns that comparison into negotiation guidance.

**Architecture:** One new `computeRentRealityCheck()` pure function + one new `RentRealityCheckCard` component. Both live alongside existing rent-intel components and reuse the same Dewey queries via a small refactor that extracts the data fetch into a shared hook/helper.

**Tech Stack:** TypeScript (Next.js), React, Supabase JS client, existing Dewey tables.

---

## File Structure

### Code (new)
- `src/lib/rent/realityCheck.ts` — Pure function `computeRentRealityCheck(input): RealityCheckResult`. Unit-testable, no IO.
- `src/lib/rent/realityCheck.test.ts` — Vitest cases across realistic scenarios (overpriced, fair, underpriced, data-sparse).
- `src/components/building/RentRealityCheck.tsx` — Presentation component. Takes a `RealityCheckResult` + the current listing, renders verdict badge + suggested counter range + explanation + disclaimer.

### Code (modify / refactor)
- `src/components/building/sections/DeferredRentIntelligenceSection.tsx` — Extract its Dewey query into a reusable `fetchRentIntelligence(buildingId)` helper (new file: `src/lib/rent/fetchRentIntelligence.ts`) so both the existing dashboard and the new Reality Check use the same data shape. No behavior change.
- `src/components/building/AmenityPremiums.tsx` — Export the "amenity premium sum" calculation as a utility so Reality Check can reuse it.
- Building listing card / listings grid — Add a compact `<RentRealityCheckPill>` variant (see Task 5).

### Code (verify, no change expected)
- Dewey table migrations (`supabase/migrations/...building_rents.sql` and related). The existing schema has everything we need.

---

## Task 1: Define the Math

**Files:**
- New: `src/lib/rent/realityCheck.ts`

- [ ] **Step 1: Specify the inputs**

```ts
type RealityCheckInput = {
  askingPrice: number;
  bedrooms: number;
  // Historical data from Dewey (already fetched by DeferredRentIntelligenceSection)
  buildingRents: Array<{
    year_month: string;    // e.g., "2024-06"
    bedrooms: number;
    median_rent: number;
    sample_size: number;
  }>;
  neighborhoodRents: Array<{
    year_month: string;
    bedrooms: number;
    median_rent: number;
  }>;
  amenityPremiumSum: number;   // dollars — sum of amenity premiums this unit has
  violationDiscount: number;   // dollars — negative adjustment from building violation signal
  seasonalIndex?: number;      // 1.0 = neutral, >1 = peak season
};
```

- [ ] **Step 2: Specify the output**

```ts
type RealityCheckResult = {
  verdict: 'overpriced' | 'fair' | 'underpriced' | 'insufficient-data';
  fairRent: number;               // our single-point estimate
  fairRentLow: number;            // 10th-percentile band
  fairRentHigh: number;           // 90th-percentile band
  deltaPct: number;               // (asking - fairRent) / fairRent, signed
  counterOffer: {
    suggested: number;
    low: number;
    high: number;
    rationale: string;            // e.g., "3% below fair rent accounting for elevator outage reports"
  } | null;                       // null when insufficient data or asking is already below fair
  factors: Array<{ label: string; dollars: number }>;  // transparent breakdown
  confidence: 'high' | 'medium' | 'low';   // driven by sample_size
  explanation: string;            // short human sentence for the header
};
```

- [ ] **Step 3: Implement the algorithm**

Algorithm in prose (codify in the function):

1. **Baseline = 3-year median.** Take the last 36 months of `buildingRents` filtered to `bedrooms == input.bedrooms`. Median. This is `buildingMedian36`. Require ≥6 monthly observations or fall back to neighborhood.
2. **Project to today.** Compute YoY growth from `neighborhoodRents` across the same bedroom count (last 12 months median vs prior 12). Call it `yoy`. Scale `buildingMedian36` forward: `projected = buildingMedian36 * (1 + yoy)^yearsSinceBaselineCenter`.
3. **Amenity adjustment.** `projected += amenityPremiumSum`.
4. **Violation adjustment.** `projected += violationDiscount` (already negative).
5. **Seasonal adjustment.** If `seasonalIndex` present, multiply by it. Peak-season asking prices aren't "wrong" — they're seasonal.
6. **Fair rent band.** `fairRentLow = projected * 0.93`, `fairRentHigh = projected * 1.07`. (±7% is a reasonable "these are the same market" band; revisit once we have real data.)
7. **Verdict.**
   - `asking < fairRentLow` → `underpriced`
   - `asking > fairRentHigh` → `overpriced`
   - otherwise → `fair`
   - If `sample_size` across the 36-month window is <12 total → `insufficient-data`
8. **Counter-offer.** Only for `overpriced` verdict. Suggested = `fairRentHigh` (the top of fair, not the midpoint — tenants negotiate harder when they ask for a concrete defensible number). Low = `fairRent`. High = `askingPrice - 25` (always ask for *something* off).
9. **Confidence.** `high` if sample_size ≥ 60, `medium` if ≥ 24, else `low`.

- [ ] **Step 4: Factors breakdown**

Populate `factors` with transparent line items so the UI can show "here's how we got to $3,200":
```
[
  { label: "Building median (2021–2024)", dollars: 2950 },
  { label: "Neighborhood YoY growth (+4.2%)", dollars: 124 },
  { label: "Amenities (gym, doorman)", dollars: 180 },
  { label: "Building violations (3 active)", dollars: -54 },
]
```

---

## Task 2: Unit Tests

**Files:**
- New: `src/lib/rent/realityCheck.test.ts`

- [ ] **Step 1: Pin 4 scenarios**

1. **Overpriced NYC 1BR** — building median $2,800, asking $3,400 → expect `overpriced`, counter around $3,050.
2. **Fair LA studio** — building median $2,100, asking $2,150, low violations → expect `fair`, null counter.
3. **Underpriced Miami 2BR** — asking well below historical → expect `underpriced`.
4. **Sparse Chicago data** — only 4 months of building history → expect `insufficient-data`, no counter.

- [ ] **Step 2: Edge cases**

- Zero amenities (no premium sum available)
- All months in baseline have `sample_size = 1` (noisy)
- YoY growth negative (rent declining neighborhood)
- Asking price == exactly fair rent

---

## Task 3: Refactor the Fetch Layer

**Files:**
- New: `src/lib/rent/fetchRentIntelligence.ts`
- Modify: `src/components/building/sections/DeferredRentIntelligenceSection.tsx`

- [ ] **Step 1: Extract the Dewey queries**

Move the 4 Dewey queries currently inline in `DeferredRentIntelligenceSection` (lines ~56-87) into `fetchRentIntelligence(buildingId, neighborhoodId)`. Return shape matches what `computeRentRealityCheck()` needs plus whatever the existing section already uses. Pure data, no rendering logic.

- [ ] **Step 2: Update the existing section to use it**

Replace inline queries with `const data = await fetchRentIntelligence(...)`. Confirm no visual regression on an existing building page.

- [ ] **Step 3: Export the amenity-premium-sum helper**

In `AmenityPremiums.tsx`, find the logic that filters amenity premiums to the ones this building has. Extract as `sumMatchedAmenityPremiums(amenityPremiums, buildingAmenities): number` and export.

---

## Task 4: The Card Component

**Files:**
- New: `src/components/building/RentRealityCheck.tsx`

- [ ] **Step 1: Layout**

Three zones, top to bottom:

1. **Verdict header** — one of:
   - 🟢 "Fair price — asking $3,200 is within range for this building"
   - 🟡 "Slightly above market — asking $3,400, fair range is $2,950–$3,250"
   - 🔴 "Overpriced — asking is 18% above fair. Consider countering at $3,050"
   - ⚪ "Not enough data — we need more history for this building"

2. **Fair-rent breakdown** — the `factors` array rendered as a small table. Each row: label + signed dollars. Last row in bold: "Fair rent: $X,XXX".

3. **Counter-offer CTA (only when overpriced)** — big suggested number + low/high range + rationale sentence + "Copy counter-offer message" button that copies a templated message to clipboard:
   > "Hi — I'm interested in [unit]. Based on historical rents in this building ($X,XXX median over the last 3 years) and current neighborhood trends, I'd like to offer $X,XXX. Happy to discuss."

- [ ] **Step 2: Confidence chip**

Small "data confidence: high / medium / low" chip next to the verdict, with a tooltip explaining the sample size.

- [ ] **Step 3: Disclaimer**

One-line footer: "Estimate based on [N] months of historical rent data. Not a professional valuation."

- [ ] **Step 4: Wire into the building page**

`src/app/[city]/building/[borough]/[slug]/page.tsx` — fetch asking price from the currently-displayed listing (or highest-visibility listing if there are multiple), call `fetchRentIntelligence()`, call `computeRentRealityCheck()`, pass to `<RentRealityCheck>`. Render near the top of the page (above `RentIntelligence`) because it's the single most useful number.

Gracefully render `insufficient-data` verdict as a quiet notice rather than hiding the card.

---

## Task 5: Listing Card Pill (Stretch)

**Files:**
- Modify: Whatever file renders the building search / neighborhood listing cards (find via grep for the card component)

- [ ] **Step 1: Compact variant**

Small pill on each listing card: 🟢 "Fair" / 🟡 "+8% above" / 🔴 "Overpriced". Clicking navigates to the building page with `#rent-reality-check` anchor.

- [ ] **Step 2: Batch compute**

Avoid N+1 queries — batch `fetchRentIntelligence()` across all listings in the current view, then run `computeRentRealityCheck()` in memory per listing.

- [ ] **Step 3: Degraded state**

For listings where the building has insufficient data, omit the pill entirely (don't show a gray "unknown" — cognitive noise).

---

## Task 6: Analytics

**Files:**
- Modify: building page analytics call site (existing analytics pattern in the repo)

- [ ] **Step 1: Track verdict distribution**

Emit an event per building page view: `rent_reality_check_shown` with props `{ verdict, deltaPct, confidence }`. This tells us (a) how often we can show the feature, (b) whether our "fair range" is calibrated right.

- [ ] **Step 2: Track counter-offer copy**

Emit `counter_offer_copied` when the clipboard button is used. This is the single highest-signal engagement metric for whether the feature actually helps.

---

## Done When

- `realityCheck.test.ts` passes all 4 pinned scenarios
- A building page in each of the 5 cities renders `<RentRealityCheck>` without error
- At least one building displays the `overpriced` verdict with a concrete counter-offer number
- "Copy counter-offer message" button writes a sensible templated string to clipboard
- Listing cards in the search view show the compact pill
- Mission Control / analytics dashboard shows `rent_reality_check_shown` event volume broken down by verdict
- No visual regression in the existing `RentIntelligence` / `RentHistoryChart` components after the fetch-layer refactor
