# Sitemap Optimization & Internal Linking Design

**Date:** 2026-04-28
**Status:** Draft (pending spec review)
**Owner:** Jesse Lafauci

## Summary

Close the gap between routes that exist in the Next.js app and URLs surfaced to Google via the sitemap system. Add internal-link "orphan fixes" so every newly indexed page has at least one prominent hub link, plus cross-link patterns that build topical clusters (building↔neighborhood, landlord↔neighborhood, tenant-rights↔tools). Standardize the breadcrumb/back-arrow pattern that buildings already use across all subpages.

**Phased rollout (approach D)** — protect crawl budget for existing 1.4M building + 937K landlord URLs that are still being discovered:

- **Phase 1 (this PR)**: Bucket A — ~454 new hub URLs in a new `public/sitemap/hubs.xml` (listed LAST in `index.xml`), plus all internal-linking work, cross-linking patterns, and breadcrumb standardization for those entry points.
- **Phase 2 (future PR, ~2–3 months out)**: Bucket B — per-entity subpages (~1.0–1.4M URLs after gating).

## Goals (Phase 1)

- Index ~454 currently-orphaned hub-page URLs in a new `public/sitemap/hubs.xml`
- Reorder `index.xml` so building/landlord sitemaps are crawled first, hubs last
- Add at least one prominent internal link from a hub page to every newly indexed category — no orphans
- Add five cross-link patterns that signal topical authority
- Standardize the `Breadcrumbs + ArrowLeft` back-nav pattern on all hub-entry subpages

## Non-goals (Phase 1)

- Per-entity subpage sitemap entries (`/reviews`, `/violations`, landlord `/buildings`, landlord `/reviews`) — deferred to Phase 2
- Per-building `/timeline` indexing — explicitly out of scope (data sparse)
- Building any new page types — every route already exists; this work is indexing + linking only
- Sitewide click-depth audit or anchor-text refactoring (out of scope)
- New visual redesigns

## Crawl-budget rationale

Current sitemap totals ~2.34M URLs; many are still being discovered by Google after recent backfills. Adding ~1.5M more URLs in one shot risks slowing discovery of existing high-value content. **Honest signal-strength ranking for Google crawl priority:**

1. Internal link graph (strongest)
2. `<lastmod>` (real but moderate)
3. Sitemap order in `index.xml` (weak but real)
4. `<priority>` and `<changefreq>` (mostly ignored)

We use levers 1, 2, and 3 in this design. We do **not** rely on `<priority>`.

## Current state (baseline)

- `public/sitemap/index.xml` — sitemap index
- `public/sitemap/0.xml` — existing static/hub sitemap (~150 URLs)
- `public/sitemap/b-N.xml` — paginated building URLs (~140 files × 10K)
- `public/sitemap/l-N.xml` — paginated landlord URLs
- Generator: [scripts/generate-sitemaps.mjs](scripts/generate-sitemaps.mjs) — `generateStaticSitemap()` writes 0.xml; `fullGenerate()` writes b-* and l-*
- Breadcrumbs component: `src/components/ui/Breadcrumbs.tsx` already emits `BreadcrumbList` JSON-LD; used on building subpages but not landlord subpages

## Design — Phase 1

### 1. New sitemap file: `public/sitemap/hubs.xml`

A new function `generateHubsSitemap()` in `scripts/generate-sitemaps.mjs` that writes Bucket A entries to `hubs.xml`. Counts and patterns:

| Category | URL pattern | Source | Approx count |
|---|---|---|---|
| Tenant tools hub | `/[city]/tenant-tools` | static × `VALID_CITIES` | 5 |
| Tenant tool templates | `/[city]/tenant-tools/templates/[slug]` | inlined `TEMPLATE_SLUGS` (8) × cities | ~40 |
| Tenant rights topics | `/[city]/tenant-rights/[topic]` | inlined per-city topic slug map | ~50 |
| Neighborhoods hub | `/[city]/neighborhoods` | static × cities | 5 |
| Neighborhoods compare | `/[city]/neighborhoods/compare` and `/[city]/neighborhood/compare` | static × cities (both routes; flagged as audit item) | 10 |
| Rents by neighborhood | `/[city]/rents/[neighborhood]` | reuse existing ZIP→neighborhood loop | ~310 |
| Ellis Act tracker | `/los-angeles/Ellis-act` | LA-only (gated; not all cities) | 1 |
| Building list hub | `/[city]/building-list` | static × cities | 5 |
| Building list chip | `/[city]/building-list/[chip]` | inlined `CHIP_SLUGS` (5) × cities | ~25 |
| Global calculators | `/rent-affordability-calculator`, `/rent-timing-calculator`, `/fair-rent-engine` | static | 3 |
| **Total** | | | **~454** |

Inline the slug arrays at the top of `generate-sitemaps.mjs`, mirroring the existing inline pattern (ZIPs, regions, subway lines):

```js
// Mirror src/lib/tenant-templates-data.ts — keep in sync manually
const TEMPLATE_SLUGS = [
  "repair-maintenance-request", "rent-reduction-request", "security-deposit-demand",
  "lease-negotiation", "harassment-complaint", "heat-hot-water-complaint",
  "pest-complaint", "illegal-eviction-response",
];

// Mirror src/lib/tenant-rights-data.ts per-city configs
const TENANT_RIGHTS_TOPICS = {
  nyc: ["rent-stabilization-rights", "repairs-and-maintenance", "eviction-protections", "security-deposits", "lease-renewals", "harassment", "heat-and-hot-water", "bed-bugs-and-pests", "illegal-apartments", "retaliation"],
  "los-angeles": ["rso-rent-stabilization", "just-cause-eviction", "repairs-and-habitability", "relocation-assistance", "ellis-act", "security-deposits", "earthquake-retrofit", "harassment-and-retaliation"],
  chicago: ["rlto-protections", "repairs-and-maintenance", "just-cause-eviction", "security-deposits", "lease-renewals"],
  miami: [/* ... */],
  houston: [/* ... */],
};

// Mirror src/lib/building-list/chips.ts
const CHIP_SLUGS = ["top-rated", "rent-stabilized", "most-reviewed", "no-violations", "large-buildings"];
```

Add a comment cross-referencing the source-of-truth TS files. Manual sync is acceptable (these change rarely).

`generateHubsSitemap()` returns an array of entries (same shape as `generateStaticSitemap()`); `fullGenerate()` writes them to `public/sitemap/hubs.xml`.

### 2. `index.xml` reorder

Update `rebuildIndex()` in `generate-sitemaps.mjs` so child sitemaps are listed in this order (this is the only "priority signal" Google weakly honors):

1. `b-*.xml` (buildings — highest-value, still being discovered)
2. `l-*.xml` (landlords)
3. `0.xml` (existing static — kept as-is)
4. **`hubs.xml`** (NEW — listed last)

The current sort logic ranks `0.xml` first; flip it so `b-*.xml` comes first and `hubs.xml` comes last:

```js
const order = (n) => {
  if (n.startsWith("b-")) return `0-${n.slice(2).replace(".xml","").padStart(6,"0")}`;
  if (n.startsWith("l-")) return `1-${n.slice(2).replace(".xml","").padStart(6,"0")}`;
  if (n === "0.xml")     return "2-0";
  if (n === "hubs.xml")  return "3-0";
  return n;
};
```

### 3. Orphan fix (hub linking)

Every Phase 1 category in §1 must have ≥1 prominent internal link from a hub page.

**City hub (`src/app/[city]/page.tsx`)** — add a **Tools & Resources** card grid linking to:
- `/[city]/tenant-tools` — "Tenant tools"
- `/[city]/tenant-rights` — "Know your rights"
- `/[city]/neighborhoods` — "Browse neighborhoods"
- `/[city]/building-list` — "Browse buildings"
- `/[city]/Ellis-act` — "Ellis Act tracker" (LA only, conditional render)
- `/[city]/compare` — "Compare buildings"

**Footer (`src/components/layout/Footer.tsx`)** — add a fourth column **Resources**:
- `/rent-affordability-calculator`
- `/rent-timing-calculator`
- `/fair-rent-engine`
- `/[city]/tenant-tools` (city-aware via `cityPath()`, falls back to NYC)
- `/[city]/tenant-rights`

**Neighborhoods hub (`src/app/[city]/neighborhoods/page.tsx`)** — for each listed neighborhood, render a "Rent data →" link pointing to `/[city]/rents/[neighborhood]`.

**Audit-only** (verify links exist; add if missing):
- Tenant tools hub renders all 8 template cards
- Tenant rights hub renders all topic cards
- Building page tabs link to `/reviews`, `/violations` (Phase 2 sitemap, but UI link should already exist)
- Landlord page tabs link to `/reviews`, `/buildings` (Phase 2 sitemap, but UI link should already exist)

### 4. Cross-linking (topical clusters)

Five new cross-link patterns. Each adds a small section/component to its host page.

**4.1 Landlord page → "Neighborhoods we operate in"**
- Where: `src/app/[city]/landlord/[name]/page.tsx`
- Content: Section listing the unique neighborhoods where the landlord owns ≥1 building. Each links to `/[city]/neighborhood/[slug]`.
- Computation: From the landlord's existing building set — `SELECT DISTINCT zip_code FROM buildings WHERE landlord = ?`, mapped to neighborhood names via `ZIP_MAPS`. Cap at top 10 by building count.
- SEO value: Strong cluster signal.

**4.2 Neighborhood detail page → "Top landlords here"**
- Where: `src/app/[city]/neighborhood/[slug]/page.tsx`
- Content: Section listing 5–10 landlords with the most buildings in this neighborhood. Each links to `/[city]/landlord/[name]`.
- Computation: `SELECT landlord, COUNT(*) FROM buildings WHERE zip_code IN (?) GROUP BY landlord ORDER BY count DESC LIMIT 10`.
- SEO value: Closes the loop with 4.1.

**4.3 Tenant-rights topic → "Related tools"**
- Where: `src/app/[city]/tenant-rights/[topic]/page.tsx`
- Content: Section with cards linking to relevant templates and calculators per topic.
- Mapping: Static lookup added to `src/lib/tenant-rights-data.ts`:

```ts
export const TOPIC_RELATED_TOOLS: Record<string, { templates: string[]; calculators: string[] }> = {
  "security-deposits": {
    templates: ["security-deposit-demand"],
    calculators: ["rent-affordability-calculator"],
  },
  "eviction-protections": {
    templates: ["illegal-eviction-response"],
    calculators: [],
  },
  "repairs-and-maintenance": {
    templates: ["repair-maintenance-request"],
    calculators: [],
  },
  "rent-stabilization-rights": {
    templates: [],
    calculators: ["fair-rent-engine"],
  },
  // ... extend per topic
};
```

If a topic has no mapping, the section is omitted (no empty rendering).

**4.4 Calculator pages → "Related guides"**
- Where: `src/app/rent-affordability-calculator/page.tsx`, etc.
- Content: Footer section linking to 2–3 most-relevant tenant-rights topics for the user's city (default NYC).
- Mapping: Inverse of 4.3 — define `CALCULATOR_RELATED_TOPICS` in the same file.

**4.5 Building-list chip page → other chips**
- Where: `src/app/[city]/building-list/[chip]/page.tsx`
- Content: Bottom strip "Browse by other criteria" linking to peer chips for the same city.
- Implementation: Reuse `chipsForCity(city)` from `src/lib/building-list/chips.ts`, filter out the current chip, render as a horizontal pill row.

**Audit-only** (likely already exist; verify):
- Building page → its neighborhood link
- Building page → "Nearby buildings" sidebar (same neighborhood)
- Building page → "See all reviews" CTA when `review_count > 3`

### 5. Breadcrumb standardization

**Gold-standard pattern** (already in use on building subpages):

```tsx
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ArrowLeft } from "lucide-react";

const breadcrumbs = [
  ...cityBreadcrumbs(city, { ... }),
  { label: parentName, href: parentUrl },
  { label: thisPageLabel, href: thisPageUrl },
];

return (
  <>
    <Breadcrumbs items={breadcrumbs} />
    <Link href={parentUrl}>
      <ArrowLeft className="w-4 h-4" /> Back to {parentName}
    </Link>
    {/* page content */}
  </>
);
```

#### Apply to (or verify presence)

| File | Status | Action |
|---|---|---|
| `src/app/[city]/landlord/[name]/reviews/page.tsx` | Has only "← Back to" text link | **Add Breadcrumbs + ArrowLeft** |
| `src/app/[city]/landlord/[name]/buildings/page.tsx` | Has only "← Back to" text link | **Add Breadcrumbs + ArrowLeft** |
| `src/app/[city]/tenant-tools/templates/[slug]/page.tsx` | Unverified | Audit; add if missing |
| `src/app/[city]/tenant-rights/[topic]/page.tsx` | Unverified | Audit; add if missing |
| `src/app/[city]/rents/[neighborhood]/page.tsx` | Has Breadcrumbs | Verify ArrowLeft; add if missing |
| `src/app/[city]/neighborhood/[slug]/page.tsx` | Unverified | Audit; add if missing |
| `src/app/[city]/building-list/[chip]/page.tsx` | Unverified | Audit; add if missing |
| Building subpages (`/reviews`, `/timeline`, `/violations`) | ✅ Already standard | No-op |

### 6. Verification

**6.1 Sitemap output**
- Run `node scripts/generate-sitemaps.mjs` locally
- Confirm `public/sitemap/hubs.xml` is created with ~454 URLs
- Confirm `public/sitemap/index.xml` lists children in order: `b-*` → `l-*` → `0.xml` → `hubs.xml`
- Existing `b-*` and `l-*` files are unchanged
- `xmllint --noout public/sitemap/*.xml` — well-formedness
- Spot-check 5 random URLs from each new category — open in browser, confirm 200 (not 404)
- Confirm `/los-angeles/Ellis-act` returns content; the page is gated to LA only in the generator

**6.2 Internal links**
- City hub renders all Tools & Resources cards with correct hrefs (Ellis Act card only on LA)
- Footer renders Resources column on every page
- Neighborhoods hub renders "Rent data →" link for each neighborhood
- Smoke-test 5 of each cross-link pattern (landlord-neighborhoods, neighborhood-landlords, topic-tools, calculator-guides, chip-peers): all targets are 200

**6.3 Breadcrumb / JSON-LD**
- Paste a sample landlord/reviews URL into Google's Rich Results Test → `BreadcrumbList` schema detected
- Repeat for one tenant-tools/templates page and one tenant-rights/[topic] page

**6.4 Post-deploy**
- POST to `/api/seo/submit-sitemaps` to re-submit to Google Search Console
- Manually submit `https://lucidrents.com/sitemap/hubs.xml` in Search Console
- Monitor Search Console "Pages → Indexed" over 2–4 weeks; expect net-new indexed URLs from `hubs.xml`

## Phase 2 (deferred ~2–3 months)

Documented here so the deferred work isn't lost. Ships only after Search Console shows building/landlord URLs are largely indexed.

**Bucket B — per-entity subpages, conditional inclusion:**

| Category | URL pattern | Inclusion rule | Notes |
|---|---|---|---|
| Building reviews | `/[city]/building/[borough]/[slug]/reviews` | only if `review_count >= 1` | ~38,709 URLs (confirmed) |
| Building violations | `/[city]/building/[borough]/[slug]/violations` | only if `violation_count >= 1` | ~500K–1M URLs |
| Building timeline | `/[city]/building/[borough]/[slug]/timeline` | **SKIPPED** | Data sparse |
| Landlord buildings | `/[city]/landlord/[name]/buildings` | only if landlord owns **≥3 buildings** | Cuts ~937K → ~50–100K |
| Landlord reviews | `/[city]/landlord/[name]/reviews` | only if landlord has any review | ~10K–30K |

**Phase 2 implementation note:** emit subpages inline with parents in `b-N.xml` and `l-N.xml`; Google processes them in the same crawl pass as parents, but they get less PageRank because they have fewer inbound links. By that point Phase 1 hubs will have stabilized.

## Open questions / audit items

1. **Duplicate compare routes**: both `/[city]/neighborhood/compare` and `/[city]/neighborhoods/compare` exist. Verify both are functional; if one is dead, remove the route and only sitemap the live one.
2. **Tenant-rights topic mapping coverage**: `TOPIC_RELATED_TOOLS` should cover every topic slug across all cities; topics without mapping render no "Related tools" section (acceptable, but a full mapping is the goal).
3. **Slug-source drift**: inlined slug arrays in `generate-sitemaps.mjs` will drift from `src/lib/*.ts` if those files change. Document the manual-sync expectation; consider a future test that compares the two sources.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Phase 1 sitemap not picked up by Google | Manually submit `hubs.xml` URL in Search Console; monitor Indexed counts |
| `index.xml` reorder confuses Google | Reorder is purely additive at the structural level (no removals); Google re-crawls index.xml every visit |
| Generator script breakage on missing data | Wrap each new query block in try/catch matching the existing `news_articles` pattern at line 245 |
| Cross-link queries hit slow paths in production | All cross-link queries are entity-scoped (single landlord, single neighborhood); cache with `unstable_cache` if needed |
| Footer Resources column overflows on mobile | Footer already has responsive grid; new column slots into existing pattern |
| Empty "Related tools" sections rendered | Conditional render: only output the section if mapping exists and is non-empty |

## Build sequence (Phase 1, single PR)

1. Add inline slug arrays (templates, topics, chips) to `generate-sitemaps.mjs`
2. Add `generateHubsSitemap()` function
3. Wire it into `fullGenerate()` and `incrementalGenerate()` to write `public/sitemap/hubs.xml`
4. Update `rebuildIndex()` sort order so b-* → l-* → 0.xml → hubs.xml
5. Add Tools & Resources section to city hub
6. Add Resources column to Footer
7. Add `/rents/[neighborhood]` link to neighborhoods hub
8. Implement §4 cross-link patterns (5 components/sections)
9. Standardize Breadcrumbs on landlord subpages and audited subpages
10. Run verification (§6)
11. PR: bundled commit

## Out of scope

**Phase 1:**
- Per-entity subpage sitemap entries (Phase 2)
- Per-building `/timeline` indexing
- Click-depth ≤3 audit and link-graph optimization
- Anchor-text refactoring
- Sitewide "Related/See also" component standardization
- Programmatic SEO expansion (e.g., `/[city]/[neighborhood]/landlords` aggregator pages)

**Phase 2 will revisit:**
- Per-entity sitemap entries with conditional gating
- A test or script that verifies inlined slug arrays match TS source-of-truth
