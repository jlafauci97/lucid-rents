# Building Page Data Restoration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all missing data, components, and features that were stripped from the building page in uncommitted working tree changes, while keeping the genuine improvements (breadcrumbJsonLd). QuickSummary and AdSidebar are evaluated separately.

**Architecture:** The committed HEAD (`98e54f2`) has a granular 6-section Suspense streaming model with individual `Deferred*Section` components. The working tree collapsed these into a single `DeferredBuildingContent` component, removing many sidebar components and city-specific data in the process. We restore HEAD, then layer the breadcrumbJsonLd improvement on top.

**Tech Stack:** Next.js App Router, React Server Components, Supabase, TypeScript

---

## What Was Lost (Full Inventory)

### A. Components removed from page.tsx imports
1. `DeferredVerdictSection` — verdict banner + report card
2. `DeferredRentIntelligenceSection` — rent intelligence + **AmenityPremiums waterfall card** + building amenities
3. `DeferredIssuesSection` — violation trends, common issues, violations by unit, issues tabs (already has totalCounts at HEAD)
4. `DeferredReviewsSection` — reviews with save/share
5. `DeferredRentListingsSection` — market listings, rent range card
6. `DeferredMapSection` — timeline link + building location map
7. `WalkabilityScore` — walkability & transit score in sidebar
8. `FloodRiskCard` — FEMA flood risk for Miami/Houston
9. `ChicagoInfoCard` — demolitions, lead inspections, affordable units, RLTO, scofflaw, ward, community area
10. `MiamiInfoCard` — 40-year recerts, unsafe structures, storm damage, flood claims, sea level risk
11. `HoustonInfoCard` — dangerous buildings, industrial proximity, tax protests, affordable housing
12. `DeferredRentComparison` — async neighborhood rent comparison

### B. Data queries removed from page.tsx
12 city-specific sidebar queries:
- `chicago_demolitions`, `chicago_lead_inspections`, `chicago_affordable_units`
- `miami_forty_year_recerts`, `miami_unsafe_structures`, `miami_storm_damage`, `miami_flood_claims`
- `houston_dangerous_buildings`, `houston_industrial_proximity`, `houston_tax_protests`, `houston_affordable_housing`
- `la_earthquake_retrofit`

### C. Data processing removed from page.tsx
- `categorizeViolation()` function — computed top violation category for header
- `topViolationType` / `topComplaintType` — passed to BuildingHeader
- `slugCandidates()` — fuzzy slug matching for redirect fallback
- Redirect loop guard (`currentPath` comparison)

### D. Degraded in working tree's DeferredBuildingContent
- Amenity premiums query missing `.eq("city", city).eq("period", "dwellsy_2024")` filters
- No deduplication of `(month, beds)` rows (payload bloat)
- No `>= 2019-01-01` date filter on dewey data
- Amenity premiums not filtered to building's actual amenities
- **AmenityPremiums waterfall card** not rendered at all
- RentIntelligence only renders when `deweyBuildingRents.length > 0` (HEAD had looser gate: any rent data)

### E. SEO/metadata changes
- Building name dropped from page title (was `name (address)`)
- Overall score scale changed from `/5` to `/10` in title

---

## Strategy

**Approach: Restore HEAD files, then add breadcrumbJsonLd.**

The simplest and safest approach: `git checkout HEAD` on the 3 modified files to get back to the committed state, then surgically add the one genuine improvement (breadcrumbJsonLd). QuickSummary and AdSidebar are evaluated separately as additive features.

**Note:** totalCounts on IssuesTabs is already present at HEAD in `DeferredIssuesSection` — no action needed.

---

### Task 1: Restore page.tsx to HEAD

**Files:**
- Restore: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Checkout the committed version of page.tsx**

```bash
git checkout HEAD -- 'src/app/[city]/building/[borough]/[slug]/page.tsx'
```

- [ ] **Step 2: Verify the file was restored**

```bash
git diff HEAD -- 'src/app/[city]/building/[borough]/[slug]/page.tsx'
```
Expected: No diff (file matches HEAD exactly).

---

### Task 2: Restore DeferredBuildingContent.tsx to HEAD

**Files:**
- Restore: `src/components/building/DeferredBuildingContent.tsx`

- [ ] **Step 1: Checkout the committed version**

```bash
git checkout HEAD -- src/components/building/DeferredBuildingContent.tsx
```

- [ ] **Step 2: Verify**

```bash
git diff HEAD -- src/components/building/DeferredBuildingContent.tsx
```
Expected: No diff.

---

### Task 3: Restore DeferredRentIntelligenceSection to HEAD

**Files:**
- Restore: `src/components/building/sections/DeferredRentIntelligenceSection.tsx`

- [ ] **Step 1: Checkout the committed version**

```bash
git checkout HEAD -- src/components/building/sections/DeferredRentIntelligenceSection.tsx
```

- [ ] **Step 2: Verify**

```bash
git diff HEAD -- src/components/building/sections/DeferredRentIntelligenceSection.tsx
```
Expected: No diff.

- [ ] **Step 3: Commit all 3 restored files**

```bash
git add 'src/app/[city]/building/[borough]/[slug]/page.tsx' src/components/building/DeferredBuildingContent.tsx src/components/building/sections/DeferredRentIntelligenceSection.tsx
git commit -m "revert: restore building page to HEAD — undo accidental data removal

Restores 6-section Suspense streaming architecture, all city-specific info cards
(Chicago/Miami/Houston), WalkabilityScore, FloodRiskCard, AmenityPremiums waterfall,
redirect loop guard, slug fallback matching, and building name in SEO title."
```

---

### Task 4: Add breadcrumbJsonLd structured data

The working tree added `breadcrumbJsonLd` structured data. This is a genuine SEO improvement not present at HEAD.

**Files:**
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Check if breadcrumbJsonLd is exported from seo lib**

```bash
grep -n "breadcrumbJsonLd" src/lib/seo.ts
```

- [ ] **Step 2: Add breadcrumbJsonLd to the import from `@/lib/seo`**

In page.tsx, find the seo import line and add `breadcrumbJsonLd`:
```tsx
import { SLUG_TO_BOROUGH, regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
```

- [ ] **Step 3: Add the JsonLd component after the existing one**

Find the `<JsonLd data={buildingJsonLd(building)} />` line and add below it:
```tsx
<JsonLd data={breadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Buildings", url: cityPath("/buildings", city) },
  { name: building.borough, url: cityPath(`/buildings/${boroughSlug}`, city) },
  { name: shortAddress, url: buildingUrl(building, city) },
])} />
```

- [ ] **Step 4: Verify build compiles**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 5: Commit**

```bash
git add 'src/app/[city]/building/[borough]/[slug]/page.tsx'
git commit -m "feat(seo): add BreadcrumbList JSON-LD to building page"
```

---

### Task 5: Verify all restored features render

- [ ] **Step 1: Run dev server and check an NYC building page**

Verify: verdict banner, report card, rent intelligence charts, AmenityPremiums waterfall card, building amenities, violation trends, issues tabs, market listings, timeline link, map, walkability score, rent comparison.

- [ ] **Step 2: Check a Chicago building page**

Verify ChicagoInfoCard renders with: RLTO protection, scofflaw status, ward, community area, demolitions, lead inspections, affordable units.

- [ ] **Step 3: Check a Miami building page**

Verify MiamiInfoCard + FloodRiskCard render.

- [ ] **Step 4: Check a Houston building page**

Verify HoustonInfoCard + FloodRiskCard render.

- [ ] **Step 5: Check an LA building page**

Verify SeismicSafetyCard receives earthquake retrofit data.

---

### Task 6: Decide on QuickSummary and AdSidebar

The working tree added two new components that don't exist at HEAD. These are additive and should be evaluated separately:

- [ ] **Step 1: Review QuickSummary component**

Read `src/components/building/QuickSummary.tsx`. If it adds value above the fold, integrate it into the restored page as an additional section (not replacing any existing section).

- [ ] **Step 2: Review AdSidebar component**

Read `src/components/ui/AdSidebar.tsx`. If it's ready, wrap the page content.

- [ ] **Step 3: If keeping, add them on top of the restored page in a separate commit**

These are additive features — they should not require removing any existing components or data.

---

## Summary of Changes

| What | Action |
|------|--------|
| page.tsx | Restore to HEAD, then add breadcrumbJsonLd |
| DeferredBuildingContent.tsx | Restore to HEAD |
| DeferredRentIntelligenceSection.tsx | Restore to HEAD |
| All 6 Deferred*Section files | Already correct at HEAD — no changes needed |
| WalkabilityScore | Restored via page.tsx revert |
| FloodRiskCard | Restored via page.tsx revert |
| ChicagoInfoCard | Restored via page.tsx revert |
| MiamiInfoCard | Restored via page.tsx revert |
| HoustonInfoCard | Restored via page.tsx revert |
| AmenityPremiums waterfall | Restored via DeferredRentIntelligenceSection revert |
| totalCounts on IssuesTabs | Already at HEAD — no action needed |
| QuickSummary | Evaluate separately (Task 6) |
| AdSidebar | Evaluate separately (Task 6) |
