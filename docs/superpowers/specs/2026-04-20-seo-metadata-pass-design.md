# SEO Metadata Pass (Phase 1) Design

**Date:** 2026-04-20
**Status:** Draft

## Problem

Lucid Rents is a rental *intelligence* platform with ~2M building pages and thousands of landlord pages indexed across 5 metros, but metadata is not aligned with how users search. Current state:

- **Building page titles** are functional but miss high-intent keywords and the single biggest free win: neighborhood names. A page for 240 1st Ave in Stuyvesant Town currently titles as `240 1st Ave — Violations, Reviews & Building Score` with no reference to the Stuyvesant Town brand keyword — one of the most-searched residential terms in NYC.
- **Landlord page titles** omit scale signals (portfolio size, total issues filed) that would differentiate them from generic name queries.
- **Star rich results are structurally blocked**: JSON-LD `AggregateRating` uses `worstRating: 0`, which violates Google's 1–5 spec and likely suppresses star rendering. Primary schema type `ApartmentComplex` is also not on Google's documented list of review-rich-result-eligible types.
- **No shared neighborhood resolver**: ZIP→neighborhood data exists for all 5 metros in city-specific modules but is not wired into metadata, so even if we wanted to inject neighborhood names we'd be doing it inconsistently.

An external SEO consultant proposed rewriting titles as generic `{Address} Apartments NYC — {Neighborhood} Rent Prices & Units`. That template is wrong for this business — it puts us in StreetEasy/Zillow's listing-intent lane where we have no inventory and cannot compete. Our moat is accountability data (violations, 311 complaints, reviews, landlord history, LucidIQ scores), and our SEO strategy should lean into it.

## Decisions

1. **Position as rental intelligence, not listings.** Titles lead with the unique accountability data, not generic "apartments for rent."
2. **Inject neighborhood everywhere coverage exists.** ZIP-based lookup, borough fallback, single shared helper.
3. **Lump `violation_count + complaint_count` as "issues filed"** in descriptions. Reads cleaner in SERP snippets than broken-out numbers.
4. **Drop LucidIQ score phrase entirely when null.** Do not show "not yet rated" — silence is better than a negative framing.
5. **Multi-type JSON-LD as `["ApartmentComplex", "LocalBusiness"]`** to improve star rich result eligibility. Fix `worstRating: 0 → 1` regardless.
6. **Phase 1 is metadata-only.** No new routes, no new data sources, no ranking page rework, no internal linking graph — those are Phase 2 and will get their own specs.

## Scope

### In scope
- Building page `generateMetadata` (title, description, OG, Twitter)
- Building page H1 + lead paragraph
- Landlord page `generateMetadata` (title, description, OG)
- `buildingNeighborhood()` shared helper in `src/lib/neighborhoods.ts`
- `buildingJsonLd()` and `landlordJsonLd()` updates in `src/lib/seo.ts`
- `landlord_stats` view columns if aggregate fields (`building_count`, `total_violations`, `total_complaints`) are missing

### Out of scope (Phase 2, separate specs)
- Ranking page rework (`worst-rated-buildings`, `problem-landlords`)
- Internal linking graph (building ↔ landlord ↔ neighborhood)
- Neighborhood page content enrichment
- New programmatic SEO routes (e.g. `/[city]/neighborhood/[slug]/worst-rated`)
- Unit-page metadata
- ZIP coverage backfill audit

## Design

### 1. Shared neighborhood resolver

**New export in `src/lib/neighborhoods.ts`:**

```ts
export interface BuildingNeighborhood {
  name: string;
  isFallback: boolean;
}

export function buildingNeighborhood(
  building: { zip_code: string | null; borough: string },
  city: City
): BuildingNeighborhood {
  if (building.zip_code) {
    const resolved = getNeighborhoodNameByCity(building.zip_code, city);
    if (resolved) return { name: resolved, isFallback: false };
  }
  return { name: building.borough, isFallback: true };
}
```

This builds on the existing `getNeighborhoodNameByCity()` export in `src/lib/neighborhoods.ts` — do not introduce a parallel dispatcher.

This is the single source of truth. Metadata, H1, lead paragraph, breadcrumbs, and JSON-LD all call it — no direct ZIP-table reads from the building page.

### 2. Building page metadata

**Title formula:**
```
{shortAddress}: Reviews, Violations & Score | {neighborhood}, {cityShort}
```

- `shortAddress` = first line of `full_address` before the first comma
- `cityShort` = one of `NYC`, `LA`, `Chicago`, `Miami`, `Houston`. `CITY_META[city].name` returns `"Los Angeles"` (not `"LA"`), so add a small inline map `CITY_SHORT_NAME = { nyc: "NYC", "los-angeles": "LA", chicago: "Chicago", miami: "Miami", houston: "Houston" }` in `src/lib/cities.ts` and export it. Use everywhere we previously would have used `CITY_META[city].name` for metadata.
- Target ≤70 chars. If over the limit, drop " Violations &" first, then drop `, {cityShort}` second.

**Examples:**
- `240 1st Ave: Reviews, Violations & Score | Stuyvesant Town, NYC`
- `1600 Vine St: Reviews, Violations & Score | Hollywood, LA`
- `5 Prospect Park W: Reviews, Violations & Score | Park Slope, NYC`
- Fallback (no neighborhood): `{address}: Reviews, Violations & Score | {borough}, {city}`

**Description formula:**

Build from three clauses, join with ", ", cap at 155 chars:

1. `{shortAddress} in {neighborhood}: {issues} issues filed` — always shown. `issues = violation_count + complaint_count` (or `dob_violation_count + complaint_count` for alt-metros, matching existing conditional at [page.tsx:122-125](src/app/[city]/building/[borough]/[slug]/page.tsx:122)).
2. `{review_count} tenant reviews` if `review_count > 0`, else `0 reviews yet`.
3. `LucidIQ {score.toFixed(1)}/5` if `overall_score != null`, omit entirely otherwise.

Append static closer: `. Free rent intelligence.`

**Description truncation order** (when the joined string exceeds 155 chars):
1. Drop the static closer `" Free rent intelligence."`.
2. Drop the LucidIQ clause.
3. Drop the review count clause (replace with nothing, not "0 reviews yet").
4. Last resort: truncate the first clause at 152 chars and append `"…"`.

The first clause (`{shortAddress} in {neighborhood}: {issues} issues filed`) is always preserved — it carries the neighborhood keyword, which is the whole point of this pass.

**Examples:**
- `240 1st Ave in Stuyvesant Town: 70 issues filed, 12 tenant reviews, LucidIQ 4.2/5. Free rent intelligence.`
- `1234 Main St in Midtown: 5 issues filed, 0 reviews yet. Free rent intelligence.`

**H1:**
```
{shortAddress} — Rent Intelligence for {neighborhood}, {cityShort}
```

Fallback (no neighborhood): `{shortAddress} — Rent Intelligence for {borough}, {cityShort}`.

**Lead paragraph** (new, inserted immediately under H1):
```
{address} is a{ N-unit} rental building in {neighborhood}, {cityShort}. See every violation, 311 complaint, tenant review, and the LucidIQ score — before you sign a lease.
```

The `{ N-unit}` segment is conditional on `total_units != null`. Plain, scannable, ≤200 chars.

### 3. Landlord page metadata

**Title formula:**
```
{name}: {buildingCount} Buildings, {totalIssues} Issues Filed & Tenant Reviews | {cityShort}
```

Example: `Stellar Management: 412 Buildings, 8,947 Issues Filed & Tenant Reviews | NYC`

**Description formula:**
```
See every one of {name}'s {buildingCount} {cityLong} buildings, all {totalIssues} violations + 311 complaints filed against them, and real tenant reviews. Free rent intelligence.
```

**Data source:** prefer `landlord_stats` columns. If missing, add them in migration (see §5).

### 4. JSON-LD updates (`src/lib/seo.ts`)

**`buildingJsonLd` changes:**

- Primary type becomes multi-type array: `"@type": ["ApartmentComplex", "LocalBusiness"]` ([seo.ts:116](src/lib/seo.ts:116)). LocalBusiness is the type Google lists as eligible for review rich results; ApartmentComplex preserves the residential semantic.
- Fix `worstRating: 0 → 1` in `AggregateRating` ([seo.ts:146](src/lib/seo.ts:146)). Google's star rich result spec requires `1 ≤ worstRating < bestRating`; `worstRating: 0` is invalid and suppresses rendering.
- Set `address.addressLocality` to the resolved neighborhood name when not a fallback; keep borough otherwise. Neighborhood is more specific and matches what Google Places expects.
- Add `priceRange` as `"$$"` (conservative default) — required-ish field for LocalBusiness.

**`landlordJsonLd` changes:**

- Update description to include building count and total issues: `"Property owner managing {buildingCount} buildings with {totalIssues} issues filed in {cityLong}"`.
- No AggregateRating on landlords (we don't aggregate reviews across a portfolio — misleading).

### 5. `landlord_stats` aggregate columns (if missing)

If `landlord_stats` does not already have `building_count`, `total_violations`, and `total_complaints`:

- Check via `\d landlord_stats` at migration-write time.
- If missing, add a migration that redefines the view (or adds columns to the table) with those aggregates computed from `buildings` joined on `owner_name`.
- If the view already has them under different names, use what exists.

This is a conditional work item. If `landlord_stats` already has the fields, skip entirely and just read them in `generateMetadata`.

### 6. File-by-file changes

| File | Change |
|---|---|
| `src/lib/neighborhoods.ts` | Add `buildingNeighborhood()` and underlying `neighborhoodNameByCity()` if not already exported. |
| `src/lib/seo.ts` | `buildingJsonLd`: multi-type, `worstRating: 1`, neighborhood `addressLocality`, `priceRange`. `landlordJsonLd`: updated description with counts. |
| `src/app/[city]/building/[borough]/[slug]/page.tsx` | `generateMetadata`: new title, description, unchanged OG/Twitter shape. Page body: H1 update, new lead paragraph under hero. |
| `src/app/[city]/landlord/[name]/page.tsx` | `generateMetadata`: new title, description. Query `landlord_stats` aggregates alongside existing name lookup. |
| `supabase/migrations/<timestamp>_landlord_stats_aggregates.sql` | **Conditional.** Only if `landlord_stats` is missing aggregate columns. |

## Non-goals and YAGNI

- We are not A/B testing title variants — just shipping the one approved template. A/B test data only matters if we see no impact after 30 days.
- We are not rewriting OG/Twitter images — current images stay.
- We are not touching `robots.txt`, `sitemap.xml`, or crawl-budget configuration — sitemap RPC is already tuned.
- We are not adding schema.org `Review` entities for individual reviews — existing `AggregateRating` is enough for Phase 1 and avoids JSON-LD bloat.
- We are not adding FAQ schema or HowTo schema — separate spec if/when we decide to.

## Testing

1. **Snapshot tests** for `generateMetadata` outputs on representative fixtures per metro:
   - NYC building with neighborhood match, reviews, score
   - NYC building with no neighborhood match (ZIP miss) — fallback to borough
   - LA building (uses `dob_violation_count`)
   - Chicago building with `rlto_violation_count`
   - Landlord with full stats
   - Landlord with zero buildings (edge case — should still render sensibly)
2. **Schema validator check** — paste generated JSON-LD into [validator.schema.org](https://validator.schema.org) and confirm no warnings for multi-type, `worstRating: 1`, and `AggregateRating`.
3. **Google Rich Results Test** on a representative building URL after deploy — confirm star eligibility.
4. **Char count assertion** in tests: title ≤70, description ≤160. Hard cap, truncate safely.

## Rollout

1. Merge and deploy to production — this is metadata-only, no data backfill, no feature flag needed.
2. Submit updated sitemap to Google Search Console, request re-crawl of a representative sample of URLs.
3. Monitor Search Console impressions + CTR for 14 days, comparing to pre-deploy 14-day window, for:
   - Building pages (impressions, CTR, avg position)
   - Landlord pages (impressions, CTR)
   - Star rich result appearance rate (eyeball spot checks)
4. If CTR drops on building pages, investigate title truncation or keyword-stuffing flags. Rollback is trivial (revert one PR).

## Success criteria

- **Primary:** 14-day impression lift on building pages ≥ 25% vs baseline. Success is about being shown for more queries — neighborhood keyword injection is the mechanism.
- **Secondary:** CTR holds or improves (no regression from description changes).
- **Tertiary:** Star rich result appearance rate on eligible building pages (review_count ≥ 1) — we track presence/absence via spot checks, not a hard metric.

Phase 2 (ranking pages, internal linking) gets its own spec after we have 30 days of Phase 1 data.
