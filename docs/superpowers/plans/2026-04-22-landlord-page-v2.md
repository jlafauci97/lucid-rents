# Landlord Page v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a redesigned `/[city]/landlord/[slug]` page that mirrors the building v2 aesthetic (paper bg, serif headings, navy record strip, LucidIQ hex verdict, scroll-spy wayfinder, numbered sections) with per-city adapters so NYC/LA/CHI/MIA/HOU each get the right data sources.

**Architecture:** Mirror `src/app/[city]/building/[borough]/[slug]/` — one server-component page, colocated `_data.ts` with React `cache()`-wrapped per-section loaders, per-section Suspense streaming wrappers under `src/components/landlord/v2/streaming/`, city-specific conditionals isolated in a single `src/lib/landlord-city-adapters.ts` module. Reuse the already-extracted `.v2`-scoped primitives in `src/styles/v2-tokens.css`.

**Tech Stack:** Next.js 15 App Router · React 19 Server Components + Suspense · Supabase Postgres (landlord_stats, buildings, reviews, OATH RPCs, city-specific program tables) · TypeScript · existing `.v2` CSS tokens (no new CSS files).

**Reference spec:** [docs/superpowers/specs/2026-04-22-landlord-page-v2-design.md](../specs/2026-04-22-landlord-page-v2-design.md)

---

## File Structure

### Files to create

- `src/components/landlord/v2/HeroV2.tsx` — identity + verdict card
- `src/components/landlord/v2/RecordStrip.tsx` — city-adaptive 6-cell ribbon
- `src/components/landlord/v2/WayfinderRail.tsx` — scroll-spy nav (Save/Share/Compare)
- `src/components/landlord/v2/Crumbs.tsx` — breadcrumb variant (or reuse building v2's)
- `src/components/landlord/v2/sections/S01_Glance.tsx` — grade distribution + region preview
- `src/components/landlord/v2/sections/S02_Trend.tsx` — multi-line trend chart
- `src/components/landlord/v2/sections/S03_CaseFile.tsx` — adjudicated-cases (city-adaptive)
- `src/components/landlord/v2/sections/S04_Buildings.tsx` — worst-3 + table + filters
- `src/components/landlord/v2/sections/S05_Ownership.tsx` — principal + entity highlights
- `src/components/landlord/v2/sections/S06_TenantVoice.tsx` — rating hero + distribution + excerpts
- `src/components/landlord/v2/sections/S07_Where.tsx` — map + region table
- `src/components/landlord/v2/sections/S08_Compare.tsx` — peer landlords + tenant resources
- `src/components/landlord/v2/sections/S09_FAQ.tsx` — deterministic Q&A block
- `src/components/landlord/v2/sections/S10_NYCInsights.tsx` — DHCR/ERAP/tax abatement aggregates (NYC)
- `src/components/landlord/v2/streaming/*Streamed.tsx` — one wrapper per section (11 files)
- `src/components/landlord/v2/streaming/SectionSkeleton.tsx` — local skeleton (or reuse building v2's)
- `src/app/[city]/landlord/[name]/_data.ts` — `LandlordV2Data` type + per-section loaders
- `src/lib/landlord-city-adapters.ts` — case-file source map, record-strip slots, tenant resources, FAQ bank
- `tests/landlord-city-adapters.test.ts` — unit tests for all city branches of the adapter module
- `tests/landlord-v2-data.test.ts` — unit tests for pure data-shape helpers (grade distribution, peer-selection, region aggregation)

### Files to modify

- `src/app/[city]/landlord/[name]/page.tsx` — replace body with v2 skeleton (keep route, metadata, redirects)

### Files to delete

- `src/components/landlord/LandlordOathCard.tsx` — folded into S03_CaseFile
- `src/components/landlord/LandlordActionLinks.tsx` — folded into S08_Compare
- `src/components/landlord/LandlordPortfolioSummary.tsx` — folded into S01_Glance
- `src/components/landlord/LandlordViolationTrend.tsx` — folded into S02_Trend

---

## Phase 0 · Foundation (types, adapters, tests)

### Task 0.1 · Define LandlordV2Data type + data-loader stubs

**Files:**
- Create: `src/app/[city]/landlord/[name]/_data.ts`

- [ ] **Step 1** — Create the file with the full `LandlordV2Data` type from the spec. Include each sub-shape: `landlord`, `portfolio`, `trend`, `caseFile`, `buildings`, `ownership`, `tenantVoice`, `where`, `peers`, `cityInsights`.

- [ ] **Step 2** — Below the type, stub out a loader per section that matches the `loadXData(slug, city)` pattern from building v2's `_data.ts`. Each loader is wrapped in `cache()` from React. Return the correct shape with empty/null placeholder values for now.

```ts
import { cache } from "react";
export const loadLandlordHero = cache(async (slug: string, city: City): Promise<LandlordV2Data["landlord"]> => {
  // TODO Task 1.2
  return { name: "", slug, metro: city, avgScore: null, buildingCount: 0, unitCount: 0,
           headOfficer: null, registrationStatus: null, businessAddress: null, yearsActive: null };
});
// loadLandlordPortfolio, loadLandlordTrend, loadLandlordCaseFile, …
```

- [ ] **Step 3** — Run `npx tsc --noEmit` to confirm no type errors. Expected: pass.

- [ ] **Step 4** — Commit.

```bash
git add src/app/[city]/landlord/[name]/_data.ts
git commit -m "feat(landlord-v2): scaffold LandlordV2Data type + loader stubs"
```

### Task 0.2 · Build the city adapter module with tests

**Files:**
- Create: `src/lib/landlord-city-adapters.ts`
- Create: `tests/landlord-city-adapters.test.ts`

- [ ] **Step 1** — Write the failing tests first (TDD). Cover:
  - `caseFileSourceForCity("nyc") === "oath"`; `"la" === "ladbs"`; `"chicago" === "chi-admin"`; `"miami" === "miami-ceb"`; `"houston" === "houston-deo"`.
  - `recordStripSlots("nyc", sampleData)` returns 6 cells in the NYC order (HPD / 311 / Litigations / OATH balance / Rent-stab / Evictions).
  - `recordStripSlots("chicago", sampleData)` returns cells with Chicago-appropriate labels, hides rent-stab cell.
  - `tenantResourcesForCity("la")` returns 4 links pointing at LA311 / LAHD hrefs (not NYC).
  - `faqBankForCity("miami")` omits the rent-stabilization question.

- [ ] **Step 2** — Run `npx vitest run tests/landlord-city-adapters.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3** — Implement `src/lib/landlord-city-adapters.ts` with the four exported functions. Use discriminated unions or simple `switch (city)` blocks keyed by `City`. Keep every city-specific string / href in this one file.

- [ ] **Step 4** — Re-run vitest. Expected: all tests pass.

- [ ] **Step 5** — Commit.

```bash
git add src/lib/landlord-city-adapters.ts tests/landlord-city-adapters.test.ts
git commit -m "feat(landlord-v2): city adapter module (case file source, record strip slots, tenant resources, FAQ bank)"
```

### Task 0.3 · Write pure-data helpers for glance + peers + region

**Files:**
- Create: `src/lib/landlord-v2-helpers.ts`
- Create: `tests/landlord-v2-helpers.test.ts`

- [ ] **Step 1** — Write failing tests for three pure functions:
  - `computeGradeDistribution(buildings)` → `{ A, B, C, D, F }` counts using `normalizeScore` + grade thresholds from `_data.ts` `scoreToGrade`.
  - `pickPeerLandlords(current, candidates)` → top 4 from same metro with `building_count` within ±40%, ranked by `|avg_score - current.avg_score|` ascending, self excluded.
  - `aggregateRegions(buildings, city)` → array of `{ name, count, share, topConcern }` sorted by count desc, using `buildingNeighborhood` for name resolution.

- [ ] **Step 2** — Run tests. Expected: FAIL (module not found).

- [ ] **Step 3** — Implement the three helpers. Reuse `normalizeScore` from `@/lib/constants` and `buildingNeighborhood` from `@/lib/neighborhoods`.

- [ ] **Step 4** — Re-run tests. Expected: pass.

- [ ] **Step 5** — Commit.

```bash
git add src/lib/landlord-v2-helpers.ts tests/landlord-v2-helpers.test.ts
git commit -m "feat(landlord-v2): grade-distribution / peer-picker / region-aggregation helpers"
```

---

## Phase 1 · Above-fold (page skeleton, Hero, RecordStrip, Wayfinder)

### Task 1.1 · Page-level v2 skeleton (route swap, wrap in .v2, V2Zoom)

**Files:**
- Modify: `src/app/[city]/landlord/[name]/page.tsx`

- [ ] **Step 1** — Keep the top of the file identical up through `displayName` derivation (slug lookup, redirect-to-slug logic, not-found → /landlords redirect, stats aggregation for record strip). Keep `generateMetadata` untouched.

- [ ] **Step 2** — Bump `export const revalidate = 86400` (from 3600, per spec).

- [ ] **Step 3** — Replace the entire returned JSX body with a v2 skeleton:

```tsx
return (
  <div className="v2">
    <V2Zoom />
    <JsonLd data={landlordJsonLd(...)} />
    <JsonLd data={breadcrumbJsonLd(...)} />
    <div className="container">
      <Crumbs city={city} displayName={displayName} />
      {/* HERO streamed */}
      {/* RECORD STRIP streamed */}
      <div className="body">
        <WayfinderRail city={city} slug={name} displayName={displayName} grade={...} />
        <main>
          {/* sections 01-10 streamed */}
        </main>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4** — Import `V2Zoom` from `@/components/building/v2/V2Zoom` (reusable, no need to fork).

- [ ] **Step 5** — At this point the page should fail to compile because Crumbs, WayfinderRail, and the streamed wrappers don't exist yet. Comment them out with TODOs for now and verify the page renders an empty `.v2` container.

- [ ] **Step 6** — Start dev server (`npm run dev` or via Launch preview). Visit `/nyc/landlord/stellar-management` (pick a known landlord with many buildings). Confirm empty v2 page renders with paper background and no console errors.

- [ ] **Step 7** — Commit.

```bash
git add src/app/[city]/landlord/[name]/page.tsx
git commit -m "refactor(landlord-v2): scaffold page wrapper (.v2 scope + V2Zoom)"
```

### Task 1.2 · Implement the hero loader + HeroV2 component

**Files:**
- Modify: `src/app/[city]/landlord/[name]/_data.ts`
- Create: `src/components/landlord/v2/HeroV2.tsx`
- Create: `src/components/landlord/v2/streaming/HeroV2Streamed.tsx`

- [ ] **Step 1** — Flesh out `loadLandlordHero` in `_data.ts` to query `landlord_stats` for name/slug/avgScore/buildingCount + join against `buildings` to compute unit count + pull head officer + registration status from first building's `management_company` / HPD fields. Return typed payload.

- [ ] **Step 2** — Write `HeroV2.tsx`. Props: `{ landlord, trust, city }`. Render the two-column `.hero` grid from the mockup — left column has `h1`, `.hero-address`, `.hero-meta`, summary callout (sky-tinted block styled like `.leasing-card`), trust row with stars + rating link + ACRIS-verified chip. Right column has `.verdict` with `.liq-badge` hex + grade meta + 4 `.verdict-axes` (Compliance / Tenant voice / Scale / Transparency). Use existing `.v2 .hero`, `.v2 .verdict`, `.v2 .liq-badge`, `.v2 .axis` classes — do NOT write new CSS.

- [ ] **Step 3** — Compute the 4 verdict-axis dot counts from `landlord` payload using the coarse thresholds from the spec (violations/unit, avg rating, decile rank, has-head-officer-and-address).

- [ ] **Step 4** — Write `HeroV2Streamed.tsx` mirroring building v2's streaming pattern: `Suspense fallback={<SectionSkeleton …/>}`, `<Inner/>` awaits `loadLandlordHero`, then renders `<HeroV2 … />`.

- [ ] **Step 5** — Uncomment the hero slot in `page.tsx`, wire it to `HeroV2Streamed`.

- [ ] **Step 6** — Verify in preview. Confirm: serif h1 renders with Young Serif font, verdict hex shows letter grade, 4 axes show dots, no CSS leaks to non-v2 pages. Screenshot via `preview_screenshot`.

- [ ] **Step 7** — Commit.

```bash
git add src/app/[city]/landlord/[name]/_data.ts src/components/landlord/v2/HeroV2.tsx src/components/landlord/v2/streaming/HeroV2Streamed.tsx src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(landlord-v2): hero with identity + LucidIQ portfolio verdict"
```

### Task 1.3 · Implement RecordStrip with city-adaptive slots

**Files:**
- Modify: `src/app/[city]/landlord/[name]/_data.ts` (add a `loadLandlordRecord` loader that returns the raw aggregate totals)
- Create: `src/components/landlord/v2/RecordStrip.tsx`
- Create: `src/components/landlord/v2/streaming/RecordStripStreamed.tsx`

- [ ] **Step 1** — Add `loadLandlordRecord(slug, city)` loader. Returns `{ hpdViolations, comp311, litigations, oathBalance, rentStabUnits, evictions, ladbsViolations?, scepCycles?, scofflaw?, recerts?, deoOrders?, codeBalance? }` etc. — superset of every city's needs. For cities without a given source, field is null.

- [ ] **Step 2** — Write `RecordStrip.tsx`. Props: `{ data, city }`. Call `recordStripSlots(city, data)` from the adapter. Render the resulting cells inside `<section className="record">` with the correct tone class (`.r-cell`, `.r-cell.ok`, `.r-cell.warn`). Use `grid-template-columns: repeat(var(--n), 1fr)` inline style so cell count is data-driven.

- [ ] **Step 3** — Write `RecordStripStreamed.tsx`. Same Suspense pattern.

- [ ] **Step 4** — Wire into `page.tsx` between hero and body grid.

- [ ] **Step 5** — Verify in preview for an NYC landlord (6 cells, OATH balance filled). Then swap URL to a Chicago landlord (no OATH cell, no rent-stab cell → 4 cells render correctly). Screenshot both.

- [ ] **Step 6** — Commit.

```bash
git add src/app/[city]/landlord/[name]/_data.ts src/components/landlord/v2/RecordStrip.tsx src/components/landlord/v2/streaming/RecordStripStreamed.tsx src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(landlord-v2): record strip with per-city slot adapter"
```

### Task 1.4 · Implement WayfinderRail with 9-section scroll-spy

**Files:**
- Create: `src/components/landlord/v2/WayfinderRail.tsx`

- [ ] **Step 1** — Copy `src/components/building/v2/WayfinderRail.tsx` as a starting point. Modify the `SECTIONS` array to match the landlord 9 sections: glance / record / casefile / buildings / ownership / voice / where / compare / faq. Pick a Lucide-style inline SVG for each.

- [ ] **Step 2** — Change Save/Share/Write-review tools → Save / Share / Compare-buildings. Keep the same client-side interaction stubs (`/api/save` POST/DELETE, clipboard copy share). Remove the review CTA — landlords don't get reviewed directly.

- [ ] **Step 3** — Swap props from `{ grade, buildingName, … }` to `{ grade, displayName, city, slug }`. Update the way-head display name split-into-two-lines logic to operate on landlord name.

- [ ] **Step 4** — Wire into `page.tsx` as the left column of the `.body` grid.

- [ ] **Step 5** — Verify in preview: scroll-spy isn't actionable yet (no sections below), but the rail renders correctly with Portfolio Score grade badge at top. Screenshot.

- [ ] **Step 6** — Commit.

```bash
git add src/components/landlord/v2/WayfinderRail.tsx src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(landlord-v2): wayfinder rail with landlord section map"
```

---

## Phase 2 · Core sections (highest value first)

### Task 2.1 · Section 01 · Portfolio at a glance

**Files:**
- Modify: `_data.ts` — add `loadLandlordGlance(slug, city)` that returns `{ gradeDist, cityAvg, regionPreview, worstCount100 }` using `computeGradeDistribution` + `aggregateRegions` helpers + `city_avg_score` RPC.
- Create: `src/components/landlord/v2/sections/S01_Glance.tsx`
- Create: `src/components/landlord/v2/streaming/S01GlanceStreamed.tsx`

- [ ] **Step 1** — Implement the loader using the helpers from Task 0.3. Wrap in `cache()`.

- [ ] **Step 2** — Write `S01_Glance.tsx` per the mockup: `.section` + `.section-head` (num 01/09) + prose line + 2-column grid with grade-distribution bar (5 flex-sized segments) + vs-city-avg callout + mini map preview + 2×2 region stat grid.

- [ ] **Step 3** — Map rendering: reuse the building v2 mini-map approach if one exists (grep `MiniMap`); otherwise start with a gradient-background placeholder with CSS-positioned pins from `regionPreview` lat/lng — keep simple.

- [ ] **Step 4** — Streaming wrapper mirrors Task 1.2 pattern.

- [ ] **Step 5** — Wire into `page.tsx` main column. Verify in preview.

- [ ] **Step 6** — Commit.

```bash
git commit -m "feat(landlord-v2): S01 portfolio at a glance"
```

### Task 2.2 · Section 02 · The record over time

**Files:**
- Modify: `_data.ts` — `loadLandlordTrend(slug, city)` returning `{ monthly: Array<{month, violations, complaints, litigations}>, summary24mo: {…} }`. Query per-city violation source (HPD for NYC/LA, DOB for others) grouped by month across all owner buildings.
- Create: `src/components/landlord/v2/sections/S02_Trend.tsx`
- Create: `src/components/landlord/v2/streaming/S02TrendStreamed.tsx`

- [ ] **Step 1** — Implement the loader. Use a single SQL call that joins buildings filtered by owner_name + date-bucket aggregation. If the query plan is slow, add a `get_landlord_monthly_trend(slug, metro, months)` RPC — but try first with an inline query.

- [ ] **Step 2** — Write `S02_Trend.tsx` with an inline SVG `viewBox="0 0 800 220"` and three stroke paths (one per series). Don't pull in a chart library — the mockup uses hand-drawn SVG, keep it. Compute path coordinates from monthly data with a simple min-max normalization.

- [ ] **Step 3** — Render the 3-prose summary row below the chart: trend direction, concentration, escalation count.

- [ ] **Step 4** — Streaming wrapper + wire into page.tsx.

- [ ] **Step 5** — Verify in preview. Screenshot for NYC + LA to confirm data source swap works.

- [ ] **Step 6** — Commit.

### Task 2.3 · Section 03 · Case file (NYC OATH first, stub for others)

**Files:**
- Modify: `_data.ts` — `loadLandlordCaseFile(slug, city)` returning `CaseFilePayload | null`. Reuse `get_landlord_oath_summary` + `get_landlord_oath_recent` RPCs for NYC. Other cities: return `null` for now.
- Create: `src/components/landlord/v2/sections/S03_CaseFile.tsx`
- Create: `src/components/landlord/v2/streaming/S03CaseFileStreamed.tsx`

- [ ] **Step 1** — Port the OathCard query from the current page.tsx into the loader. Reshape the RPC response into the adapter's `CaseFilePayload` type. Return `null` when summary is null or `total_hearings === 0`.

- [ ] **Step 2** — Write `S03_CaseFile.tsx`. Section title pulled from `caseFileSourceForCity(city)` via a title-for-source helper. Render 4 big stats grid + recent 12 cases list (reuse LandlordOathCard markup but rewritten with v2 classes — no Tailwind utility-class spaghetti, use existing `.v2` primitives + light custom rules only where unavoidable).

- [ ] **Step 3** — In the streaming wrapper, when `payload === null` return `null` (section is skipped entirely, not shown as empty).

- [ ] **Step 4** — Wire into page.tsx. Verify in preview for an NYC landlord with OATH data (renders) and a Chicago landlord (silently omitted). Screenshot both.

- [ ] **Step 5** — Commit.

```bash
git commit -m "feat(landlord-v2): S03 case file (NYC OATH live, stubbed for other cities)"
```

### Task 2.4 · Section 04 · The buildings (worst-3 + filter chips + table)

**Files:**
- Modify: `_data.ts` — `loadLandlordBuildings(slug, city)` returning `{ worstThree: Building[], rows: Building[] /* 30 */, total: number, filterCounts: { region, violations100Plus, rentStab } }`.
- Create: `src/components/landlord/v2/sections/S04_Buildings.tsx`
- Create: `src/components/landlord/v2/streaming/S04BuildingsStreamed.tsx`

- [ ] **Step 1** — Loader queries `buildings` filtered by `owner_name + metro`, sorted by `overall_score ASC NULLS LAST` (worst first), limit 30. Separate query for worst-3 (same sort, limit 3). Third query (or CTE) for filter counts.

- [ ] **Step 2** — Write section component. Worst-3 callouts row (3 cards with red-gradient accent stripe). Filter chips row (client component w/ `"use client"` for chip clicks — Phase 1 can be view-only chips that deep-link to a sort param; defer filtering interactivity to Phase 2 if needed to keep this task bite-sized). Portfolio table — header row + 30 data rows + "View all N" footer link.

- [ ] **Step 3** — Grade badge styling reuses building v2's `.ll-g` pattern; each row clicks through to `buildingUrl(row, city)`.

- [ ] **Step 4** — Streaming wrapper + wire into page.

- [ ] **Step 5** — Verify in preview. Confirm table sorts correctly, "View all" link renders, filter chips render. Screenshot.

- [ ] **Step 6** — Commit.

---

## Phase 3 · Supporting sections

### Task 3.1 · Section 05 · Ownership & operations

**Files:**
- Modify: `_data.ts` — `loadLandlordOwnership(slug, city)` returning `{ headOfficer, title, businessAddress, registration, taxIdMasked, managementCompany, yearsActive }`.
- Create: `src/components/landlord/v2/sections/S05_Ownership.tsx` + streamed wrapper.

- [ ] **Step 1** — Loader queries buildings for `management_company` (mode value), pulls HPD registration info from first building. Mask tax ID (only NYC, only when HPD data is present).

- [ ] **Step 2** — Render two cards: "Principal & registration" (key-value list) + "Entity highlights" (management company + years active + brief note about LLC structure not being fully mapped yet). Skip the full entity tree (deferred to Phase 2 per spec).

- [ ] **Step 3** — Streaming wrapper + wire into page.

- [ ] **Step 4** — Verify + commit.

### Task 3.2 · Section 06 · Tenant voice

**Files:**
- Modify: `_data.ts` — `loadLandlordTenantVoice(slug, city)` returning `{ avgRating, totalReviews, distribution: number[5], excerpts: Array<{rating, text, building_address, region, created_at}> }`.
- Create: `src/components/landlord/v2/sections/S06_TenantVoice.tsx` + streamed wrapper.

- [ ] **Step 1** — Loader joins `reviews → buildings` by `building_id` filtered by `owner_name + metro`. Aggregate avg, count, star distribution. Pull 3 excerpts: one top-rated, one bottom-rated, one neutral-and-recent.

- [ ] **Step 2** — If `totalReviews === 0`, streaming wrapper returns `null` (section omitted).

- [ ] **Step 3** — Render per mockup: left rating hero tile with big serif number + stars + distribution bars, right column with 3 review excerpts.

- [ ] **Step 4** — Wire + verify + commit.

### Task 3.3 · Section 07 · Where they operate

**Files:**
- Modify: `_data.ts` — `loadLandlordWhere(slug, city)` returning `{ regions: Array<{name, count, share, topConcern, lat?, lng?}> }`.
- Create: `src/components/landlord/v2/sections/S07_Where.tsx` + streamed wrapper.

- [ ] **Step 1** — Loader reuses `aggregateRegions` helper (from Task 0.3). Top concern computed from the most-common HPD violation category per region.

- [ ] **Step 2** — Render: left column with a map (start with the same SVG-pin mockup approach from Task 2.1, don't pull in Mapbox yet), right column region table with share bars.

- [ ] **Step 3** — Wire + verify + commit.

### Task 3.4 · Section 08 · Compare & act

**Files:**
- Modify: `_data.ts` — `loadLandlordPeers(slug, city)` returning top-4 peers via `pickPeerLandlords` helper.
- Create: `src/components/landlord/v2/sections/S08_Compare.tsx` + streamed wrapper.

- [ ] **Step 1** — Peer loader: `landlord_stats` filtered by metro, `building_count` within ±40%, exclude self, order by `ABS(avg_score - current.avg_score)` asc, limit 4.

- [ ] **Step 2** — Render two-column section: left peer-landlords card (grade badge, name/buildings/units, score delta), right tenant-resources card driven by `tenantResourcesForCity(city)` adapter.

- [ ] **Step 3** — Wire + verify + commit.

### Task 3.5 · Section 09 · FAQ

**Files:**
- Modify: `_data.ts` — `loadLandlordFAQ(slug, city)` returning `{ items: Array<{q, a}> }`, computed by picking from `faqBankForCity(city)` + substituting numeric stats.
- Create: `src/components/landlord/v2/sections/S09_FAQ.tsx` + streamed wrapper.

- [ ] **Step 1** — FAQ bank per city is already defined in the adapter (Task 0.2). Loader just reads it and substitutes numbers.

- [ ] **Step 2** — Render: 2-column grid of Q/A cards (`.faq-item` class).

- [ ] **Step 3** — Wire + verify + commit.

---

## Phase 4 · City-specific insights

### Task 4.1 · Section 10 · NYC insights

**Files:**
- Modify: `_data.ts` — `loadLandlordNYCInsights(slug)` returning `{ rentStabSummary, erapRecipient, taxAbatements } | null`.
- Create: `src/components/landlord/v2/sections/S10_NYCInsights.tsx` + streamed wrapper.

- [ ] **Step 1** — Loader aggregates rent-stab unit counts across portfolio from DHCR table (already used on building v2), ERAP recipient flag, J-51/421-a abatement summary.

- [ ] **Step 2** — Render only when city === "nyc" AND data is non-empty. Style as the final numbered `.section` with `10 / 09` num (or `NYC only` label — follow building v2 convention).

- [ ] **Step 3** — Wire into page.tsx conditionally on `city === "nyc"`.

- [ ] **Step 4** — Verify for NYC landlord. Commit.

### Task 4.2 · Section 10 · LA/CHI/MIA/HOU insight stubs

**Files:**
- Create: `src/components/landlord/v2/sections/S10_LAInsights.tsx` + streamed wrapper.
- Create: `src/components/landlord/v2/sections/S10_ChicagoInsights.tsx` + streamed wrapper.
- Create: `src/components/landlord/v2/sections/S10_MiamiInsights.tsx` + streamed wrapper.
- Create: `src/components/landlord/v2/sections/S10_HoustonInsights.tsx` + streamed wrapper.

- [ ] **Step 1** — Each city component is a minimal stub that queries its loader (can be `async () => null` for now) and renders `null`. This lets future work drop in city-specific implementations without page-level changes.

- [ ] **Step 2** — Wire all 4 into `page.tsx` under the same `switch (city)` block building v2 uses.

- [ ] **Step 3** — Verify that each city page renders cleanly with the NYC S10 visible only for NYC, and the other cities' S10 section simply not appearing (no empty section, no placeholder copy).

- [ ] **Step 4** — Commit.

```bash
git commit -m "feat(landlord-v2): S10 NYC insights live + LA/CHI/MIA/HOU stubs"
```

---

## Phase 5 · Retire legacy + multi-city QA + ship

### Task 5.1 · Delete the 4 legacy landlord components

**Files:**
- Delete: `src/components/landlord/LandlordOathCard.tsx`
- Delete: `src/components/landlord/LandlordActionLinks.tsx`
- Delete: `src/components/landlord/LandlordPortfolioSummary.tsx`
- Delete: `src/components/landlord/LandlordViolationTrend.tsx`

- [ ] **Step 1** — Run `grep -rn "LandlordOathCard\|LandlordActionLinks\|LandlordPortfolioSummary\|LandlordViolationTrend" src` to confirm only the landlord page and these four files reference them.

- [ ] **Step 2** — If any reference remains (e.g., `src/app/[city]/landlord/[name]/page.tsx` still imports them), remove those imports.

- [ ] **Step 3** — Delete the four files.

- [ ] **Step 4** — Run `npx tsc --noEmit` + `npm run lint`. Fix any errors.

- [ ] **Step 5** — Commit.

```bash
git rm src/components/landlord/LandlordOathCard.tsx src/components/landlord/LandlordActionLinks.tsx src/components/landlord/LandlordPortfolioSummary.tsx src/components/landlord/LandlordViolationTrend.tsx
git commit -m "refactor(landlord-v2): retire v1 landlord components"
```

### Task 5.2 · Multi-city preview QA

- [ ] **Step 1** — In the Launch preview or a deploy preview, walk through one landlord in each city (use known large landlords — Stellar in NYC, e.g.):
  - `/nyc/landlord/<slug>` — confirm hero, record strip shows 6 cells incl. OATH, S03 case file visible, S10 NYCInsights visible.
  - `/los-angeles/landlord/<slug>` — record strip shows 6 cells with LADBS/RSO, S03 case file omitted (data not loaded yet), S10 omitted.
  - `/chicago/landlord/<slug>` — record strip shows 4 cells (no rent-stab, no OATH balance), S03 omitted, S10 omitted.
  - `/miami/landlord/<slug>` — same 4-cell pattern, FAQ bank swaps out rent-stab question.
  - `/houston/landlord/<slug>` — same 4-cell pattern, tenant resources link to Houston 311.

- [ ] **Step 2** — Capture screenshots for each city into `docs/superpowers/evidence/landlord-v2-<city>.png` (or attach to PR description).

- [ ] **Step 3** — Check `preview_console_logs` for errors on each page. Check `preview_network` for failed RPC / 500s.

- [ ] **Step 4** — Run `preview_inspect` on the verdict hex on NYC to confirm letter grade + stars + score are readable; spot-check accessibility labels.

- [ ] **Step 5** — If all pass, commit any screenshot/doc updates.

### Task 5.3 · Final polish pass with simplify + review-pr skills

- [ ] **Step 1** — Invoke `/simplify` skill on the entire diff — look for reuse opportunities (e.g., can `SectionSkeleton` be imported from building v2 instead of duplicated?).

- [ ] **Step 2** — Invoke `/review-pr` skill for a final diff review. Address high-confidence findings.

- [ ] **Step 3** — Commit any fixups.

### Task 5.4 · Open the pull request

- [ ] **Step 1** — `git push -u origin claude/keen-noether-33a821`.

- [ ] **Step 2** — `gh pr create` with title "feat(landlord): v2 redesign with city-adaptive sections" and a body that includes the spec link + 5 city screenshots + before/after comparison for NYC.

- [ ] **Step 3** — Print PR URL.

---

## Testing strategy

**Unit tests (vitest):** `tests/landlord-city-adapters.test.ts` + `tests/landlord-v2-helpers.test.ts`. These are the only tests this plan writes. They cover city branching logic + pure data-shape helpers. React component tests are out of scope — visual correctness is verified via preview screenshots, and behavior is simple enough that snapshot tests would be noise.

**Preview verification (Task 5.2):** one run per city, 5 screenshots, console + network checks. This is the substantive end-to-end verification.

**No DB migrations** — this plan reuses existing tables and RPCs. If any per-city source (SCEP, RLTO, etc.) later needs a new RPC, that's a separate plan.

## Success criteria

- [ ] Every city renders without an empty section, placeholder copy, or console error.
- [ ] NYC page shows all 10 sections (S03 OATH, S10 NYCInsights).
- [ ] LA/CHI/MIA/HOU pages gracefully omit city-specific sections they don't have data for.
- [ ] Record strip cell count adapts per city (6 in NYC/LA, 4 in CHI/MIA/HOU).
- [ ] FAQ bank swaps the rent-stabilization question out for CHI/MIA/HOU.
- [ ] Page visual matches the mockup at `.superpowers/brainstorm/23238-1776913026/landlord-v2-mockup.html` within typographic tolerance.
- [ ] Lighthouse performance on a preview deploy is ≥ the current landlord page's (ISR same, streaming added — net neutral to positive).
- [ ] All 4 legacy landlord components deleted; no dead imports.
- [ ] `npx tsc --noEmit` + `npm run lint` + `npx vitest run` all pass.
