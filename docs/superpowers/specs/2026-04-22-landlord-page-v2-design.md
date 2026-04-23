# Landlord Page v2 Design

**Date:** 2026-04-22
**Status:** Draft
**Branch:** `claude/keen-noether-33a821`

## Problem

The current landlord profile page (`/[city]/landlord/[name]`) is a functional summary — dark gradient hero, 6 stat tiles, violation trend chart, OATH card (NYC only), tenant resources, and a flat grid of every building. It works, but:

- It was designed before we shipped the building v2 system and does not share its aesthetic — visitors who land on a building v2 page and click through to a landlord feel a hard break in the product.
- It underuses the data we actually have. Portfolio-wide signals like grade distribution, geographic spread, ownership structure, tenant voice aggregation, peer comparisons, and multi-year compliance trends are either missing or buried in a single chart.
- Section ordering front-loads a redundant list of 400+ buildings before telling the story; scannability and narrative are weak.
- The design is NYC-first. LA/Chicago/Miami/Houston all have their own landlord-level data (SCEP, RLTO, Code Enforcement Board, dangerous-building orders) that has no home on this page today.

## Decisions

1. **Mirror the building v2 pattern.** Same paper bg, serif headings, navy record strip, sky-tinted verdict card with LucidIQ hex badge, numbered sections, scroll-spy wayfinder rail. Visitors should feel they are in the same product family.
2. **Portfolio-scale everything.** Every section treats the landlord as a portfolio, not a list of buildings. Even the buildings section leads with worst-3 callouts and portfolio filters before showing the table.
3. **Introduce a LucidIQ Portfolio Score.** Extension of the existing `landlord_stats.avg_score` with four verdict axes: Compliance, Tenant voice, Scale, Transparency. Sub-score calculation is out of scope for Phase 1 — show the existing avg_score in the hex, defer richer axes logic to Phase 2.
4. **City-adaptive by construction.** Every section that reads city-specific data goes through a per-city adapter. Cities without a given data source omit the section cleanly (same pattern as building v2 `S10_{City}Insights`). No section renders empty or with placeholder copy.
5. **Preserve existing route and URL shape.** `/[city]/landlord/[slug]`, ISR 3600s, same slug→owner_name lookup, same redirect-to-slug logic. Old pages just look new.
6. **Keep existing landlord data queries where possible.** `landlord_stats`, `get_landlord_oath_summary`, `get_landlord_oath_recent`, `city_avg_score`, and `buildings` reads with `.eq("owner_name", ...)` are all reused. New queries are additive.

## Scope

### In scope
- `src/app/[city]/landlord/[name]/page.tsx` — full rewrite using v2 components
- `src/app/[city]/landlord/[name]/_data.ts` — new, colocated data loaders mirroring building v2 `_data.ts`
- `src/components/landlord/v2/` — new directory for v2 landlord components (Hero, RecordStrip, WayfinderRail, 9 sections, streaming wrappers)
- Reuse existing CSS tokens and `.hero` / `.record` / `.section-head` / `.liq-badge` / `.wayfinder` primitives — these are defined inline in the building v2 page mockup CSS and should be extracted into a shared location (see Build Sequence).
- Per-city adapters for case-file, evictions, programs, and peer-landlords sources.
- Retirement of current `LandlordOathCard`, `LandlordActionLinks`, `LandlordPortfolioSummary`, and `LandlordViolationTrend` components — logic is folded into v2 section components.
- Metadata unchanged (Phase 1 of SEO metadata already ships correct landlord titles).

### Out of scope (Phase 2, separate specs)
- Portfolio-level LucidIQ Score algorithm with four axes — Phase 1 uses existing `avg_score` in the hex and coarse thresholding for axis dots.
- Entity-structure / LLC tree beyond "head officer + management co." — requires linking work in the `buildings` table.
- Dedicated `/landlord/:slug/buildings` sub-page for full portfolio table — Phase 1 caps portfolio table at 30 rows with a "View all N" footer.
- Landlord comparison tool at `/compare?landlords=...` — peer section links to the existing building compare.
- Save / share / compare personalization state (wayfinder tools wired as stubs mirroring building v2).

## Route & rendering

- Path: `src/app/[city]/landlord/[name]/page.tsx` (unchanged).
- ISR: `export const revalidate = 86400` (matches building v2; current landlord is 3600 — we can absorb the increase because portfolio aggregates are not minutely-sensitive).
- Server component page streams per-section via Suspense. Initial paint includes the hero + record strip. Sections below fold stream with `<LazyOnScroll>` where appropriate.

## Component tree

```
src/components/landlord/v2/
├── Crumbs.tsx              ← reuse building v2 Crumbs for nav
├── HeroV2.tsx              ← landlord identity + verdict card
├── RecordStrip.tsx         ← 6-cell portfolio totals ribbon
├── WayfinderRail.tsx       ← scroll-spy nav (Save/Share/Compare)
├── sections/
│   ├── S01_Glance.tsx      ← grade distribution + map preview
│   ├── S02_Trend.tsx       ← multi-line trend chart
│   ├── S03_CaseFile.tsx    ← OATH (NYC) | SCEP (LA) | AdminHearings (CHI) | Code Enforcement (MIA) | DEO (HOU)
│   ├── S04_Buildings.tsx   ← worst-3 + filter chips + portfolio table
│   ├── S05_Ownership.tsx   ← principal, registration, entity highlights
│   ├── S06_TenantVoice.tsx ← rating hero + distribution + excerpts
│   ├── S07_Where.tsx       ← map + borough/region table
│   ├── S08_Compare.tsx     ← peer landlords + tenant resources
│   ├── S09_FAQ.tsx         ← 6 deterministic Q&As
│   └── S10_{City}Insights.tsx
│        ← NYC: rent-stab summary · LA: buyouts/SCEP/REAP ·
│          CHI: RLTO/scofflaw · MIA: recerts/storm damage ·
│          HOU: dangerous buildings
└── streaming/
    ├── HeroV2Streamed.tsx
    ├── RecordStripStreamed.tsx
    ├── S01GlanceStreamed.tsx
    … (one streamed wrapper per section, mirrors building v2)
    └── SectionSkeleton.tsx    ← reuse building v2's if identical
```

Each section component mirrors the building v2 API shape: props are slices of a typed `LandlordV2Data` defined in `_data.ts`.

## Hero

Grid: `minmax(0, 1.25fr) minmax(0, 1fr)`, same as building hero.

**Left column**
- `h1`: landlord display name from `landlord_stats.name`.
- `.hero-address`: comma-joined top-3 regions the landlord operates in · city short name.
- `.hero-meta`: building count · unit count · head officer name · registration status.
- Summary callout (replaces leasing card): "Portfolio Record" with total HPD violations + 311 complaints, "N buildings carry 100+ violations" subline, "Report to HPD" CTA.
- Trust row: star rating line for portfolio-wide reviews count + avg, ACRIS-verified chip (omit if owner_name not linked to an ACRIS party), updated-weekly note.

**Right column (.verdict)**
- `.liq-badge` hex with letter grade from `avg_score`, 5-star filled to avg rating, score/5, "Portfolio Score" ribbon.
- Grade meta: `buildings · units · city` + serif TL;DR sentence comparing portfolio to city average.
- 4 verdict axes (Phase 1 coarse thresholding):
  - **Compliance**: dots from `total_violations / total_units` — 0.2/unit = good, 0.5 = mixed, 1.0+ = concerning.
  - **Tenant voice**: dots from portfolio avg review rating.
  - **Scale**: dots from building count decile rank within metro.
  - **Transparency**: dots from "has head officer + business address + active HPD registration" — simple presence check.

## Record strip

6-cell dark navy ribbon. **Cell content is city-adaptive** — each slot has a per-city fallback:

| Slot | NYC                   | LA                        | CHI                     | MIA                       | HOU                      |
|------|-----------------------|---------------------------|-------------------------|---------------------------|--------------------------|
| 1    | HPD violations        | LADBS + HCIDLA violations | Building Code violations | Code violations           | Dangerous bldg flags     |
| 2    | 311 complaints        | 311 complaints            | 311 complaints          | 311 complaints            | 311 complaints           |
| 3    | Litigations (HPD)     | SCEP deficiency cycles    | RLTO scofflaw flags     | Recert pass/fail          | DEO order count          |
| 4    | OATH balance due      | LADBS fine balance        | Admin hearings balance  | Code Enforcement balance  | Municipal court balance  |
| 5    | Rent-stab units       | RSO units                 | —                       | —                         | —                        |
| 6    | Evictions filed       | Evictions filed           | Evictions filed         | Evictions filed           | Evictions filed          |

Cells with no data for the current city are hidden (6 → 5 or 4 cells). Grid `grid-template-columns: repeat(var(--n), 1fr)` computed at render time.

## Sections

### 01 · Portfolio at a glance
- LucidIQ grade distribution bar: 5 segments (A/B/C/D/F) sized by count of buildings in each bucket (using `buildings.overall_score` normalized).
- Vs-city-average callout: `avg_score - cityAvg` with directional copy.
- 2-column mini stat grid: top 3 regions by building count + worst-N-by-violations count.

### 02 · The record over time
- 3-line monthly trend chart (HPD violations / 311 complaints / litigations) aggregated across all owner buildings, last 84 months.
- 3 prose summary callouts: trend direction over last 24 months, concentration ratio (% of complaints from top X% of buildings), escalation count.
- **City-adaptive**: chart uses whatever violation source is primary for the city (HPD in NYC/LA, DOB in others). Line colors are stable across cities.

### 03 · Case file *(conditional)*
- Renders only if city has an adjudicated-cases data source and the landlord has ≥1 case.
- NYC: current `get_landlord_oath_summary` + `get_landlord_oath_recent` RPCs. 4 big stats + recent 12 cases list.
- Other cities: same visual template with per-city data source (LA SCEP/LADBS, CHI admin hearings, MIA CEB, HOU DEO). Phase 1 ships NYC OATH only; other cities get stubbed adapters returning `null` so the section simply doesn't render.
- Section title adapts: "OATH case file" (NYC) | "LADBS enforcement" (LA) | "Administrative hearings" (CHI) | "Code Enforcement Board" (MIA) | "DEO orders" (HOU).

### 04 · The buildings
- "Worst 3" callouts — 3 cards with red-gradient accent stripe, rank, grade, address, region/year/units, inline violation/complaint/litigation counts.
- Filter chips: `All · N` · per-region chips (top 4 regions by count) · `100+ violations · N` · `Rent-stab · N` *(NYC/LA only)*.
- Portfolio table: grade badge, address, region/year-built, units, violations, complaints, score/10. 30 rows, sorted by score ascending (worst first). "View all N buildings" footer row links to `/[city]/landlord/[slug]?view=all` (renders a paginated view, Phase 1 can be a simple `?page=N` paginator).

### 05 · Ownership & operations
- Two cards: Principal & registration (head officer, title, registered address, HPD/registration status, tax ID masked) + Entity structure (management company + "managed N buildings since YYYY" — Phase 1 does not attempt LLC tree).
- **City-adaptive**: registration field uses the correct authority per city (HPD, HCIDLA, City of Chicago, Miami-Dade, City of Houston). Masked tax ID only shown for NYC where we have HPD registration data.

### 06 · Tenant voice
- Aggregated reviews across all owner buildings — query joins `reviews` to `buildings` by `owner_name` match.
- Left: rating hero tile (big serif number, star row, star distribution bars).
- Right: 3 review excerpts — one recent 4-5★, one recent 1-2★, one recent neutral. Each excerpt shows building address + region so the tenant voice isn't decontextualized.

### 07 · Where they operate
- Left: map (Mapbox static or interactive — use whatever building v2 uses) with cluster pins per region.
- Right: region table (borough for NYC, council district for LA, ward for CHI, neighborhood for MIA/HOU). Each row has building count + share bar + top concern (highest-complaint category).
- **City-adaptive**: region granularity and labels come from the same `buildingNeighborhood` helper the building v2 uses. Reuse, do not fork.

### 08 · Compare & act
- Peer landlords: same metro, `building_count` within ±40% of current, sorted by `|avg_score - portfolioAvg|` ascending, top 4. Each row has grade badge, name, building/unit count, score delta vs current.
- Tenant resources: 4 action links with per-city hrefs — NYC uses 311/HPD, LA uses LA311/LAHD, CHI uses 311/BACP, MIA uses Miami-Dade Code Compliance, HOU uses 311/HPD Houston. These already exist scattered in `LandlordActionLinks` — consolidate and make city-aware.

### 09 · FAQ
- 6 deterministic Q&As with numeric substitution, not LLM-generated. Questions are fixed; answers template in stats from `LandlordV2Data`.
- Example slots: portfolio rank in city · rent-stab share *(NYC/LA only)* · active litigation count · worst-3 buildings · 24-month trend direction · founder/operator year.
- **City-adaptive**: questions about rent stabilization swap out for cities without that concept (CHI/MIA/HOU). Predefined question bank keyed by city.

### 10 · City-specific insights *(conditional — NYC/LA/CHI/MIA/HOU)*
Mirrors the building v2 `S10_{City}Insights` pattern but at landlord scope.
- **NYC**: DHCR rent-stab aggregate across portfolio, ERAP recipient flag, J-51/421-a tax abatement summary.
- **LA**: buyouts filed, REAP enrollments, SCEP deficiency cycle history, recent retrofit status (soft-story, mandatory seismic).
- **CHI**: RLTO scofflaw flag, total scofflaw count, lead paint disclosure compliance.
- **MIA**: 40-year recerts pending/failed, storm damage claims, CCRIS flags.
- **HOU**: dangerous building count, hazardous property flags, Houston HCDD registration.

Each S10 component is loaded only when its city matches, and it silently returns `null` if its data source has no rows for the landlord.

## Data layer

### `src/app/[city]/landlord/[name]/_data.ts`

```ts
export type LandlordV2Data = {
  landlord: { name; slug; metro; avgScore; buildingCount; unitCount;
              headOfficer; registrationStatus; businessAddress; yearsActive };
  portfolio: { gradeDist; regionBreakdown; worstThree; cityAvgScore };
  trend: { monthly: Array<{ month; violations; complaints; litigations }>;
           summary24mo };
  caseFile: CaseFilePayload | null; // null if city/owner has no data
  buildings: { rows; total }; // 30 + total
  ownership: { headOfficer; title; businessAddress; registration; taxIdMasked };
  tenantVoice: { avgRating; totalReviews; distribution; excerpts };
  where: { regions: Array<{ name; count; topConcern }> };
  peers: Array<{ name; slug; buildingCount; unitCount; avgScore }>;
  cityInsights: CityInsightsPayload | null;
};
```

Data loaders are functions `getLandlord…(slug, city)` wrapped in React `cache()`, each scoped to the section that needs it. Streaming section wrappers await only their slice.

### Per-city adapters

`src/lib/landlord-city-adapters.ts` — one module exporting:

```ts
export type CaseFileSource = 'oath' | 'ladbs' | 'chi-admin' | 'miami-ceb' | 'houston-deo' | null;
export function caseFileSourceForCity(city: City): CaseFileSource;

export type RecordStripSlot = { k: string; v: string | number; sub: string; tone?: 'ok' | 'warn' };
export function recordStripSlots(city: City, data: LandlordV2Data): RecordStripSlot[];

export type TenantResource = { label; href; icon; description };
export function tenantResourcesForCity(city: City): TenantResource[];

export function faqBankForCity(city: City): Array<{ q: string; template: string }>;
```

All city-specific conditionals live inside these adapters. Section components stay city-agnostic — they ask the adapter for the right data and render what comes back.

## CSS extraction

The building v2 design currently lives in two places:
1. `public/mockups/building-v1.html` — the source-of-truth CSS (5,065 lines).
2. Inline / per-component classNames in the React components.

For v2 landlord to share primitives (`.hero`, `.record`, `.section-head`, `.verdict`, `.liq-badge`, `.wayfinder`, `.axis`, etc.) **without duplicating CSS**, extract those primitives into a global stylesheet before building landlord v2:

- Create `src/app/v2-tokens.css` — design tokens (OKLCH colors, type scale, spacing, radius).
- Create `src/app/v2-primitives.css` — hero, record, section-head, verdict, liq-badge, wayfinder, axis classes, section padding, prose, chip, crumbs.
- Import both from `src/app/layout.tsx` (or a dedicated layout for `(v2)` route group).

This is an infrastructure change building v2 also benefits from. **Recommendation**: do this extraction as step 1 of the landlord v2 work, rather than after. It turns a 5K-line HTML mockup into a real CSS module and removes the risk of the two pages drifting.

## Build sequence

1. **CSS extraction**: pull design tokens + primitives from mockup into `v2-tokens.css` + `v2-primitives.css`. Verify building v2 still renders identically.
2. **Scaffolding**: create `src/components/landlord/v2/` directory with empty component stubs that type-check.
3. **`_data.ts`**: define `LandlordV2Data` type + per-section data loaders. Use React `cache()`. Start with NYC data paths.
4. **Per-city adapters**: `src/lib/landlord-city-adapters.ts` — case-file source map, record-strip slot generator, tenant resources per city, FAQ bank.
5. **Hero + RecordStrip + WayfinderRail**: ship hero, record strip, and wayfinder. Page renders at this stage with only the top of the fold.
6. **Sections 01-04**: glance, trend, case file, buildings. These are the highest-value sections and cover 80% of the page value.
7. **Sections 05-09**: ownership, tenant voice, where, compare, FAQ.
8. **Section 10 city-specific**: ship NYC insights first (DHCR rent-stab, already available). Wire LA/CHI/MIA/HOU as stub components that render `null` until their data loaders land.
9. **Route swap**: replace current `page.tsx` imports with v2 components. Delete the four legacy landlord components.
10. **Verify across cities**: preview deploy, walk through a landlord in each of NYC/LA/CHI/MIA/HOU. Confirm record strip adapts, case file hides cleanly where there's no source, S10 hides cleanly, FAQ swaps rent-stab questions, tenant resources show correct city links.

## Data sources & queries

- `landlord_stats` — primary aggregate, keyed by `(slug, metro)`. Used for hero meta, verdict axes inputs, record strip totals, peer matching.
- `buildings` — filtered by `owner_name + metro`, used for worst-3, portfolio table, grade distribution, region breakdown, trend aggregation joins, entity structure hints.
- `get_landlord_oath_summary` + `get_landlord_oath_recent` RPCs — NYC case file (already exists).
- `city_avg_score` RPC — already used, reused for vs-avg callout.
- `reviews` — joined via `building_id → building owner_name` for tenant voice aggregation.
- `nypd_complaints` / metro-specific crime — **not used** on landlord page. Crime is building-scoped.
- Per-city program tables — `la_buyouts`, `la_scep`, `chi_scofflaw`, `miami_recerts`, `houston_dangerous_buildings` etc. — loaded on demand inside S10 components only.

## Risks

- **Portfolio table performance at 400+ buildings.** Capping at 30 + "view all" CTA mitigates. Ensure 30-row slice pulls only the columns needed.
- **Review aggregation at portfolio scope** could be slow for large landlords (1000+ buildings × avg 5 reviews = 5K rows). Add a materialized `landlord_review_aggregates` view if performance suffers — Phase 2 if needed, Phase 1 assumes current volumes are acceptable.
- **CSS extraction risk.** Moving CSS out of the mockup file into a real stylesheet could shift visuals by a pixel somewhere if specificity changes. Mitigation: keep class names identical, load order identical, diff building v2 screenshots before/after.
- **City-specific data gaps.** Not every city has a case-file or enforcement source yet. Sections must gracefully hide, not show "no data" — otherwise the page feels empty in non-NYC cities.
- **SEO metadata already exists and is per-city correct.** Do not touch `generateMetadata` or `landlordJsonLd` in this pass — SEO Phase 1 already landed those.

## Open decisions (defaults chosen, ask before changing)

- **Verdict axes**: Compliance / Tenant voice / Scale / Transparency. Could alternatively be Rent fairness / Habitability / Protection / Scale — those map better to the building verdict axes. Leaning toward mirror-the-building since it tells a parallel story.
- **Peer-landlords scope**: same metro + ±40% building count + top 4 by closest avg_score. Alternative: same top region (borough/neighborhood cluster) + similar size. Picked metro+size because region similarity doesn't always hold for portfolio operators.
- **Portfolio-table row cap**: 30 rows. Could be 20 or 50 — 30 is the default.
- **OATH section NYC-only vs stubbed for others**: Phase 1 ships NYC only, other cities' case-file adapters return `null`. Alternative is to stub placeholder copy, but empty-section is worse than no-section.
