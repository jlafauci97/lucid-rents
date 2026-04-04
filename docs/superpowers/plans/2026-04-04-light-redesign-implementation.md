# Light Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the building page from the current dark navy design to the "Bright Social" light redesign with new typography, color tokens, grade system (out of 5), Double Ring Knockout badge, Verdict Banner, Report Card, Amenity Premiums, structured Pros/Cons reviews, and common violation/complaint summaries.

**Architecture:** Phase approach — first update the shared design system (fonts, tokens, constants), then update individual components top-to-bottom matching the page render order. Each component update is isolated and can be verified independently. All data fetching and Supabase queries remain untouched — this is purely a visual layer migration.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Framer Motion, Lucide icons, Supabase (read-only), Instrument Serif + DM Sans + JetBrains Mono fonts

**Reference mockup:** `src/app/redesign/light/page.tsx` (self-contained with all design patterns)

---

## File Structure Overview

### Files to CREATE:
- `src/lib/design-tokens.ts` — Centralized design tokens (T object) and gradeColor function
- `src/components/ui/Sparkline.tsx` — Reusable sparkline SVG component
- `src/components/ui/GradeBar.tsx` — Animated grade bar for Report Card
- `src/components/ui/TrendBadge.tsx` — Trend indicator badge (+/-%)
- `src/components/ui/SectionTitle.tsx` — Editorial section heading
- `src/components/ui/FadeIn.tsx` — Framer Motion scroll-triggered reveal wrapper
- `src/components/building/VerdictBanner.tsx` — "X% recommend" with pro/con excerpts
- `src/components/building/ReportCard.tsx` — Multi-dimensional grade bars
- `src/components/building/AmenityPremiums.tsx` — Receipt-style value breakdown
- `src/components/building/CommonIssues.tsx` — Top violations & complaints summary

### Files to MODIFY:
- `src/app/layout.tsx` — Add Instrument Serif, DM Sans, JetBrains Mono fonts
- `src/app/globals.css` — Update CSS variables to light palette
- `src/lib/constants.ts` — Update grade thresholds for 0-5 scale, update GRADE_COLORS
- `src/components/building/BuildingHeader.tsx` — Light hero with Double Ring badge
- `src/components/building/QuickSummary.tsx` — Vital signs with sparklines
- `src/components/building/SectionNav.tsx` — White/frosted glass nav with new sections
- `src/components/building/DeferredBuildingContent.tsx` — Wire in new sections, fetch common violations/complaints
- `src/components/review/ReviewSection.tsx` — Structured Pros/Cons format
- `src/components/building/RentIntelligence.tsx` — Dashboard cards with sparklines
- `src/components/building/ViolationTrend.tsx` — Building Pulse design
- `src/components/building/IssuesTabs.tsx` — Expandable categories design
- `src/components/building/RentStabilizationCard.tsx` — Light card styling
- `src/components/building/EnergyScoreCard.tsx` — Light card styling
- `src/components/building/RentComparison.tsx` — Animated comparison bars
- `src/components/building/NearbyBuildings.tsx` — Grade badges, light cards
- `src/components/building/SameLandlordBuildings.tsx` — Grade badges, light cards
- `src/components/building/BuildingLocationMap.tsx` — Light card wrapper
- `src/components/building/BuildingAmenities.tsx` — Light card styling
- `src/components/building/ValueBreakdown.tsx` — Merge into new AmenityPremiums
- `src/app/[city]/building/[borough]/[slug]/page.tsx` — Layout restructure, wire new components

### Files NOT touched (data layer preserved):
- All Supabase queries in DeferredBuildingContent, page.tsx
- All types in `src/types/index.ts`
- All SEO logic (`src/lib/seo.ts`)
- All city config (`src/lib/cities.ts`)
- Transit, Schools, Recreation, Crime data-fetching components (only restyle wrappers)

---

## Task 1: Design System Foundation

**Files:**
- Create: `src/lib/design-tokens.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Create design tokens file**

Create `src/lib/design-tokens.ts`:

```typescript
export const T = {
  bg:       "#FAFBFD",
  surface:  "#FFFFFF",
  elevated: "#F5F7FA",
  subtle:   "#EDF0F5",
  border:   "#E2E8F0",
  text1:    "#1A1F36",
  text2:    "#5E6687",
  text3:    "#A3ACBE",
  accent:   "#6366F1",
  pink:     "#EC4899",
  sage:     "#10B981",
  coral:    "#F97316",
  danger:   "#EF4444",
  blue:     "#3B82F6",
  gold:     "#F59E0B",
  gradeA:   "#10B981",
  gradeB:   "#3B82F6",
  gradeC:   "#F59E0B",
  gradeD:   "#F97316",
  gradeF:   "#EF4444",
} as const;

export function gradeColor(grade: string): string {
  const g = grade.charAt(0).toUpperCase();
  if (g === "A") return T.gradeA;
  if (g === "B") return T.gradeB;
  if (g === "C") return T.gradeC;
  if (g === "D") return T.gradeD;
  return T.gradeF;
}
```

- [ ] **Step 2: Update fonts in layout.tsx**

Add Instrument Serif, DM Sans, JetBrains Mono from `next/font/google`. Set CSS variables `--font-display`, `--font-body`, `--font-mono`. Keep existing Sora as fallback for pages not yet migrated.

- [ ] **Step 3: Update CSS variables in globals.css**

Update `:root` variables to match T tokens. Update `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-secondary`, `--color-accent`. Keep old values commented for reference during migration.

- [ ] **Step 4: Update grading constants**

In `src/lib/constants.ts`:
- Change `getLetterGrade` thresholds from 0-10 to 0-5 scale: A >= 4, B >= 3, C >= 2, D >= 1, F < 1
- Update `GRADE_COLORS` to match T tokens: A=#10B981, B=#3B82F6, C=#F59E0B, D=#F97316, F=#EF4444
- Update `deriveScore` to return 0-5 scale instead of 0-10: `5 - Math.log10(total + 1) * 1.5`
- Update `SCORE_COLORS` thresholds: good >= 3.5, average >= 2, poor >= 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-tokens.ts src/app/layout.tsx src/app/globals.css src/lib/constants.ts
git commit -m "feat: add light design system tokens, fonts, and 0-5 grading scale"
```

---

## Task 2: Shared UI Components

**Files:**
- Create: `src/components/ui/Sparkline.tsx`
- Create: `src/components/ui/GradeBar.tsx`
- Create: `src/components/ui/TrendBadge.tsx`
- Create: `src/components/ui/SectionTitle.tsx`
- Create: `src/components/ui/FadeIn.tsx`

- [ ] **Step 1: Create Sparkline component**

Extract from mockup. Server-compatible SVG (no client hooks). Props: `data: number[], color?: string, width?: number, height?: number`.

- [ ] **Step 2: Create GradeBar component**

Client component using Framer Motion `useInView`. Props: `label: string, grade: string, score: number, maxScore?: number, delay?: number`.

- [ ] **Step 3: Create TrendBadge component**

Server component. Props: `value: number, suffix?: string`. Green for negative (rents down = good), red for positive.

- [ ] **Step 4: Create SectionTitle component**

Server component with editorial italic heading. Props: `children: ReactNode, subtitle?: string`.

- [ ] **Step 5: Create FadeIn component**

Client component wrapping Framer Motion scroll-triggered fade + slide. Props: `children: ReactNode, delay?: number, className?: string`.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Sparkline.tsx src/components/ui/GradeBar.tsx src/components/ui/TrendBadge.tsx src/components/ui/SectionTitle.tsx src/components/ui/FadeIn.tsx
git commit -m "feat: add shared UI components for redesign (Sparkline, GradeBar, TrendBadge, SectionTitle, FadeIn)"
```

---

## Task 3: BuildingHeader — Light Hero with Double Ring Badge

**Files:**
- Modify: `src/components/building/BuildingHeader.tsx`

- [ ] **Step 1: Rewrite BuildingHeader**

Replace dark navy hero with light white background. Replace shield SVG badges with Double Ring Knockout badge (outer border ring, inner solid filled circle, rotating dashed accent). Add vital signs grid with sparklines (Median Rent, Violations, Complaints, Reviews). Add action buttons (Save, Compare, Share, Monitor). Use management badge with accent border. Use `--font-display` for address, `--font-mono` for numbers.

Key changes:
- Background: `T.surface` (white) instead of `#0F1D2E` (navy)
- Score display: Double Ring Knockout instead of shield SVG
- Stats: Sparkline-enhanced vital signs instead of pill badges
- Score scale: `/5` instead of `/10`
- Add Framer Motion entrance animations

- [ ] **Step 2: Verify BuildingHeader renders on a real building page**

Navigate to any building page and confirm the new header renders with correct data.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/BuildingHeader.tsx
git commit -m "feat: light hero with Double Ring grade badge and sparkline vital signs"
```

---

## Task 4: SectionNav — Frosted Glass Navigation

**Files:**
- Modify: `src/components/building/SectionNav.tsx`

- [ ] **Step 1: Update SectionNav styling and sections**

Change from solid blue bar to white/frosted glass with backdrop-blur. Update section list to include: Verdict, Report Card, Rent Intel, Building Pulse, Reviews, Transit, Schools, Parks, Crime, FAQ. Use gold/accent color for active state instead of white-on-blue. Keep all existing scroll/intersection behavior.

- [ ] **Step 2: Commit**

```bash
git add src/components/building/SectionNav.tsx
git commit -m "feat: frosted glass section nav with updated section list"
```

---

## Task 5: QuickSummary → Replaced by Vital Signs in Header

**Files:**
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Remove QuickSummary from page layout**

The vital signs are now part of the BuildingHeader (Task 3). Remove the standalone `<QuickSummary>` component render from the main column. Keep the component file for potential reuse but remove from page render.

- [ ] **Step 2: Commit**

```bash
git add src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "refactor: remove QuickSummary, vital signs now in BuildingHeader"
```

---

## Task 6: VerdictBanner — Recommendation + Review Excerpts

**Files:**
- Create: `src/components/building/VerdictBanner.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Create VerdictBanner component**

Props: `recommendPct: number, reviewCount: number, bestPositive: { text: string, author: string, date: string }, bestCritical: { text: string, author: string, date: string }`.

Renders: Big "X%" stat, "of tenants recommend", pro/con excerpt cards with colored left borders (sage for positive, pink for critical).

- [ ] **Step 2: Wire VerdictBanner into page**

Compute `recommendPct` from reviews data in `DeferredBuildingContent`. Find the highest-rated and lowest-rated reviews for excerpts. Render `<VerdictBanner>` as the first section in the main column.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/VerdictBanner.tsx src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "feat: add VerdictBanner with recommendation % and review excerpts"
```

---

## Task 7: ReportCard — Multi-Dimensional Grade Bars

**Files:**
- Create: `src/components/building/ReportCard.tsx`
- Modify: `src/components/building/DeferredBuildingContent.tsx`

- [ ] **Step 1: Create ReportCard component**

Props: `overallGrade: string, overallScore: number, grades: { label: string, grade: string, score: number }[], summary: string`.

Renders: Overall grade in colored square, summary text, animated GradeBar for each dimension (Management, Maintenance, Value, Safety, Noise, Responsiveness).

- [ ] **Step 2: Compute grade dimensions from review category ratings**

In `DeferredBuildingContent`, aggregate `review_category_ratings` by category to compute per-dimension scores. Map category slugs to display labels. Pass to `<ReportCard>`.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/ReportCard.tsx src/components/building/DeferredBuildingContent.tsx
git commit -m "feat: add Report Card with per-dimension grade bars from review ratings"
```

---

## Task 8: Rent Intelligence Dashboard

**Files:**
- Modify: `src/components/building/RentIntelligence.tsx`

- [ ] **Step 1: Redesign RentIntelligence layout**

Replace current layout with 3 metric cards (Median Rent + trend, $/sqft + trend, Value Assessment grade) each with sparklines. Add neighborhood comparison bars per bedroom type with animated fills. Add savings callout at bottom. Use `SectionTitle` for heading. Use `T` tokens for all colors.

- [ ] **Step 2: Commit**

```bash
git add src/components/building/RentIntelligence.tsx
git commit -m "feat: redesign Rent Intelligence with sparkline cards and comparison bars"
```

---

## Task 9: AmenityPremiums — Value Breakdown

**Files:**
- Create: `src/components/building/AmenityPremiums.tsx`
- Modify: `src/components/building/DeferredBuildingContent.tsx`

- [ ] **Step 1: Create AmenityPremiums component**

Props: `neighborhoodMedian: number, buildingMedian: number, amenityPremiums: { amenity: string, premium_dollars: number }[], violationDiscount: number, valueGrade: string`.

Receipt-style breakdown: base rate → each premium → violation adjustment → fair rent vs actual → verdict badge.

- [ ] **Step 2: Wire into DeferredBuildingContent**

Pass existing `dewey_amenity_premiums` data and computed values. Render between Rent Intelligence and Building Pulse.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/AmenityPremiums.tsx src/components/building/DeferredBuildingContent.tsx
git commit -m "feat: add AmenityPremiums receipt-style value breakdown"
```

---

## Task 10: Building Pulse + Common Issues

**Files:**
- Create: `src/components/building/CommonIssues.tsx`
- Modify: `src/components/building/ViolationTrend.tsx`
- Modify: `src/components/building/IssuesTabs.tsx`
- Modify: `src/components/building/DeferredBuildingContent.tsx`

- [ ] **Step 1: Create CommonIssues component**

Props: `violations: { type: string, count: number }[], complaints: { type: string, count: number }[]`.

Two-column grid: Top Violations with bars (danger color), Top 311 Complaints with bars (gold color). Aggregate from raw violation/complaint data by category.

- [ ] **Step 2: Redesign ViolationTrend**

Add "Improving/Declining/Stable" verdict badge. Restyle bar chart with T tokens. Add monthly labels.

- [ ] **Step 3: Redesign IssuesTabs as expandable category cards**

Replace tabbed interface with expandable cards (HPD Violations, 311 Complaints, DOB Violations, Permits). Each shows count, density per unit, trend badge. Clicking expands to show the timeline.

- [ ] **Step 4: Wire CommonIssues into DeferredBuildingContent**

Aggregate violation types and complaint categories from the raw data. Pass top 5 of each to `<CommonIssues>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/building/CommonIssues.tsx src/components/building/ViolationTrend.tsx src/components/building/IssuesTabs.tsx src/components/building/DeferredBuildingContent.tsx
git commit -m "feat: Building Pulse with common issues, trend verdict, and expandable categories"
```

---

## Task 11: Reviews — Structured Pros/Cons

**Files:**
- Modify: `src/components/review/ReviewSection.tsx`

- [ ] **Step 1: Redesign ReviewSection**

Add structured Pros/Cons layout with colored left borders (sage/pink). Add star ratings with gold fill. Add "Would recommend" / "Would not recommend" badges. Add "View all N reviews" button. Use `SectionTitle`. Use `T` tokens.

Note: The existing reviews don't have separate pros/cons fields. Use the full review body text and the category ratings to determine the recommend status. If `overall_rating >= 3.5`, show as "Would recommend".

- [ ] **Step 2: Commit**

```bash
git add src/components/review/ReviewSection.tsx
git commit -m "feat: redesign reviews with star ratings and recommend badges"
```

---

## Task 12: Sidebar Cards — Light Styling

**Files:**
- Modify: `src/components/building/RentStabilizationCard.tsx`
- Modify: `src/components/building/EnergyScoreCard.tsx`
- Modify: `src/components/building/RentComparison.tsx`
- Modify: `src/components/building/SeismicSafetyCard.tsx`
- Modify: `src/components/building/HazardZonesCard.tsx`
- Modify: `src/components/building/BuildingAmenities.tsx`
- Modify: `src/components/building/NearbyBuildings.tsx`
- Modify: `src/components/building/SameLandlordBuildings.tsx`

- [ ] **Step 1: Update sidebar card styling**

For each card: replace hardcoded colors (`#0F1D2E`, `#94a3b8`, `#3B82F6`) with T tokens. Add `shadow-sm` to cards. Use `--font-body` for labels, `--font-mono` for numbers. Keep all existing props and data flow.

- [ ] **Step 2: Add grade badges to NearbyBuildings and SameLandlordBuildings**

Use `gradeColor()` for colored badge circles. Show score as `/5`.

- [ ] **Step 3: Update RentComparison with animated bars**

Add Framer Motion animated fill bars for building vs neighborhood comparison.

- [ ] **Step 4: Commit**

```bash
git add src/components/building/RentStabilizationCard.tsx src/components/building/EnergyScoreCard.tsx src/components/building/RentComparison.tsx src/components/building/SeismicSafetyCard.tsx src/components/building/HazardZonesCard.tsx src/components/building/BuildingAmenities.tsx src/components/building/NearbyBuildings.tsx src/components/building/SameLandlordBuildings.tsx
git commit -m "feat: light styling for all sidebar cards with grade badges and animated bars"
```

---

## Task 13: Page Layout Restructure

**Files:**
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Update page layout structure**

Key changes:
- Remove dark `bg-[#0F1D2E]` wrapper around breadcrumbs — use light background
- Update Breadcrumbs variant from "dark" to "light"
- Remove `<QuickSummary>` render (now in header vital signs)
- Add `<VerdictBanner>` as first section in main column
- Add `<ReportCard>` after VerdictBanner
- Move Building Details card to sidebar with updated inline styles
- Update sidebar card id attributes and scroll-mt values
- Keep all Suspense boundaries and data fetching unchanged
- Update max-w-7xl to max-w-6xl for the content area
- Update grid gap from `gap-8` to `gap-8 lg:gap-10`

- [ ] **Step 2: Update Building Details inline card**

The Building Details card in the sidebar is defined inline in page.tsx. Update its colors from hardcoded `#0F1D2E`, `#94a3b8` to T token imports.

- [ ] **Step 3: Update Chicago Info inline card**

Same treatment as Building Details — update hardcoded colors to T tokens.

- [ ] **Step 4: Verify full page renders correctly**

Navigate to multiple building pages across cities (NYC, Chicago, LA, Miami, Houston) and verify all sections render with correct data and new styling.

- [ ] **Step 5: Commit**

```bash
git add src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "feat: restructure building page layout with light theme and new sections"
```

---

## Task 14: FAQ Section

**Files:**
- Modify: `src/components/building/DeferredBuildingFAQ.tsx`

- [ ] **Step 1: Redesign FAQ as accordion**

Replace current FAQ rendering with expandable accordion using `useState` for open index. Use `ChevronDown` icon with rotation animation. Use `T` tokens. Add `SectionTitle` heading.

- [ ] **Step 2: Commit**

```bash
git add src/components/building/DeferredBuildingFAQ.tsx
git commit -m "feat: redesign FAQ as expandable accordion with light styling"
```

---

## Task 15: Map Section Update

**Files:**
- Modify: `src/components/building/BuildingLocationMap.tsx`

- [ ] **Step 1: Update map card wrapper**

Update the card wrapper to use `T` tokens. Add `shadow-sm` and `rounded-2xl`. Keep the Mapbox embed unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/components/building/BuildingLocationMap.tsx
git commit -m "feat: light card wrapper for building map"
```

---

## Task 16: Transit, Schools, Recreation, Crime Sidebar Restyling

**Files:**
- Modify: `src/components/transit/NearbyTransit.tsx`
- Modify: `src/components/schools/NearbySchools.tsx`
- Modify: `src/components/building/NearbyRecreation.tsx`
- Modify: `src/components/crime/NearbyCrimeSummary.tsx`

- [ ] **Step 1: Update NearbyTransit styling**

Replace hardcoded colors with T tokens. Add `shadow-sm` to card. Keep subway line badge colors (those are real NYC subway colors, not design tokens).

- [ ] **Step 2: Update NearbySchools styling**

Replace hardcoded colors with T tokens. Add colored rating badges using gradeColor-style mapping.

- [ ] **Step 3: Update NearbyRecreation styling**

Replace hardcoded colors with T tokens. Add `shadow-sm`.

- [ ] **Step 4: Update NearbyCrimeSummary styling**

Replace hardcoded colors with T tokens. Add crime level gauge bar. Add TrendBadge for category trends.

- [ ] **Step 5: Commit**

```bash
git add src/components/transit/NearbyTransit.tsx src/components/schools/NearbySchools.tsx src/components/building/NearbyRecreation.tsx src/components/crime/NearbyCrimeSummary.tsx
git commit -m "feat: light styling for transit, schools, recreation, and crime sidebar sections"
```

---

## Task 17: Cleanup and Final Verification

**Files:**
- Remove: `src/app/redesign/` (entire directory — mockup served its purpose)

- [ ] **Step 1: Remove redesign mockup pages**

Delete `src/app/redesign/` directory (page.tsx, content.tsx, light/, badges/, layout.tsx).

- [ ] **Step 2: Full cross-city verification**

Test building pages for:
- NYC building with full data (71 Broadway or 225 Central Park North)
- Chicago building (RLTO, ward, scofflaw fields)
- LA building (hazard zones, encampments, soft story)
- Miami building (minimal data)
- Houston building (minimal data)

Verify: Header, Verdict, Report Card, Rent Intel, Amenity Premiums, Building Pulse, Reviews, all sidebar sections, FAQ, Same Landlord, Nearby Buildings.

- [ ] **Step 3: Verify mobile responsiveness**

Check at 375px, 768px, 1280px breakpoints. Verify vital signs grid stacks, sidebar moves below main, review cards stack.

- [ ] **Step 4: Verify SEO preserved**

Check that `generateMetadata` still produces correct title/description. Verify JSON-LD structured data still renders. Verify `revalidate = 86400` still set.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove redesign mockups, final verification complete"
```
