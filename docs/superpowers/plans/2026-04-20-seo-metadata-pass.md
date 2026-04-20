# SEO Metadata Pass (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite building page and landlord page metadata across ~2M pages to inject neighborhood keywords, lump violations+311 as "issues filed," fix JSON-LD star-rich-result blockers, and position the site as rental intelligence (not listings).

**Architecture:** Pure-function helpers for title/description/H1 construction live in `src/lib/seo-metadata.ts`, unit-tested in isolation. The metadata functions in the two page files become thin wrappers that call those helpers. A shared `buildingNeighborhood()` helper in `src/lib/neighborhoods.ts` is the single source of truth for ZIP→neighborhood resolution. Landlord aggregate counts are computed via a `React.cache()`-wrapped fetcher so `generateMetadata` and the page render share one query per request.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase Postgres, Vitest, React `cache()`.

**Spec:** [docs/superpowers/specs/2026-04-20-seo-metadata-pass-design.md](../specs/2026-04-20-seo-metadata-pass-design.md)

---

## File Structure

New files:
- `src/lib/seo-metadata.ts` — pure helpers: `buildBuildingTitle`, `buildBuildingDescription`, `buildBuildingH1`, `buildBuildingLeadParagraph`, `buildLandlordTitle`, `buildLandlordDescription`. No I/O, no DB calls — just string assembly with truncation rules.
- `tests/lib/seo-metadata.test.ts` — vitest tests covering the five metros, all description-truncation steps, fallback paths, and char-count caps.
- `src/lib/landlord-stats.ts` — `getLandlordStats(slug, city)` wrapped in React `cache()`; returns `{ name, buildingCount, totalViolations, totalComplaints } | null`.
- `tests/lib/neighborhoods.test.ts` — tests for the new `buildingNeighborhood()` helper.

Modified files:
- `src/lib/cities.ts` — add `CITY_SHORT_NAME` map export.
- `src/lib/neighborhoods.ts` — add `buildingNeighborhood()` helper on top of the existing `getNeighborhoodNameByCity()`.
- `src/lib/seo.ts` — `buildingJsonLd()` (multi-type, `worstRating: 1`, neighborhood `addressLocality`, `priceRange`); `landlordJsonLd()` (description includes counts).
- `src/app/[city]/building/[borough]/[slug]/page.tsx` — `generateMetadata` uses new helpers.
- `src/components/building/v2/HeroV2.tsx` — H1 gets a visually-hidden SEO continuation span; hero-address prepends neighborhood.
- `src/app/[city]/landlord/[name]/page.tsx` — `generateMetadata` and page body both consume `getLandlordStats()`; existing inline aggregates removed where the cached fetcher replaces them.

New migration:
- `supabase/migrations/<timestamp>_landlord_agg_rpc.sql` — `get_landlord_agg_stats(p_slug, p_metro)` RPC returning accurate metro-scoped building count + violation/complaint totals. Replaces the earlier plan to rely solely on React `cache()` — the RPC avoids a row-count ceiling and pushes aggregation to Postgres.

---

## Task 1: `CITY_SHORT_NAME` map

**Files:**
- Modify: `src/lib/cities.ts`
- Test: covered in Task 3's seo-metadata tests (trivial constant)

**Rationale:** The spec requires `cityShort` values `NYC/LA/Chicago/Miami/Houston`. Currently `CITY_META["los-angeles"].name === "Los Angeles"`. A short-name map is clearer than re-purposing `name` across the codebase.

- [ ] **Step 1: Add the export to `src/lib/cities.ts` at the end of the file (after `getCityName`)**

```ts
/** Short display name used in SEO metadata (titles, descriptions). */
export const CITY_SHORT_NAME: Record<City, string> = {
  nyc: "NYC",
  "los-angeles": "LA",
  chicago: "Chicago",
  miami: "Miami",
  houston: "Houston",
};
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS, no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cities.ts
git commit -m "feat(seo): add CITY_SHORT_NAME map for metadata templates"
```

---

## Task 2: `buildingNeighborhood()` helper

**Files:**
- Modify: `src/lib/neighborhoods.ts`
- Create: `tests/lib/neighborhoods.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/neighborhoods.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildingNeighborhood } from "@/lib/neighborhoods";

describe("buildingNeighborhood", () => {
  it("returns resolved neighborhood for a known NYC zip", () => {
    // 10009 → East Village (verify real ZIP exists in NYC_ZIP_NEIGHBORHOODS)
    const result = buildingNeighborhood({ zip_code: "10009", borough: "Manhattan" }, "nyc");
    expect(result.isFallback).toBe(false);
    expect(typeof result.name).toBe("string");
    expect(result.name.length).toBeGreaterThan(0);
  });

  it("falls back to borough when zip_code is null", () => {
    const result = buildingNeighborhood({ zip_code: null, borough: "Queens" }, "nyc");
    expect(result).toEqual({ name: "Queens", isFallback: true });
  });

  it("falls back to borough when zip has no mapping", () => {
    const result = buildingNeighborhood({ zip_code: "00000", borough: "Brooklyn" }, "nyc");
    expect(result).toEqual({ name: "Brooklyn", isFallback: true });
  });

  it("works for non-NYC cities", () => {
    const result = buildingNeighborhood({ zip_code: "90028", borough: "Hollywood" }, "los-angeles");
    // Either returns a real neighborhood or falls back to borough — both acceptable
    expect(typeof result.name).toBe("string");
    expect(result.name.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/neighborhoods.test.ts`
Expected: FAIL with "`buildingNeighborhood` is not exported."

- [ ] **Step 3: Add the helper to `src/lib/neighborhoods.ts`**

After the `getNeighborhoodNameByCity` function (around line 106), add:

```ts
export interface BuildingNeighborhood {
  name: string;
  isFallback: boolean;
}

/**
 * Resolve a building's neighborhood from its ZIP code, with borough fallback.
 * Single source of truth — all SEO metadata, H1, breadcrumbs, and JSON-LD
 * should call this instead of touching the ZIP tables directly.
 */
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/lib/neighborhoods.test.ts`
Expected: PASS on all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/neighborhoods.ts tests/lib/neighborhoods.test.ts
git commit -m "feat(seo): add buildingNeighborhood() helper with zip→borough fallback"
```

---

## Task 3: Pure `seo-metadata.ts` helpers for building page

**Files:**
- Create: `src/lib/seo-metadata.ts`
- Create: `tests/lib/seo-metadata.test.ts`

**Rationale:** All string construction lives here as pure functions. Page `generateMetadata` becomes a thin wrapper. This makes the truncation logic and multi-metro behavior cheap to test in isolation.

- [ ] **Step 1: Write the failing test — title**

Create `tests/lib/seo-metadata.test.ts` with the title test block first:

```ts
import { describe, it, expect } from "vitest";
import {
  buildBuildingTitle,
  buildBuildingDescription,
  buildBuildingH1,
  buildBuildingLeadParagraph,
  buildLandlordTitle,
  buildLandlordDescription,
} from "@/lib/seo-metadata";

describe("buildBuildingTitle", () => {
  const base = {
    shortAddress: "240 1st Ave",
    neighborhood: "Stuyvesant Town",
    city: "nyc" as const,
  };

  it("formats the standard template", () => {
    expect(buildBuildingTitle(base)).toBe(
      "240 1st Ave: Reviews, Violations & Score | Stuyvesant Town, NYC"
    );
  });

  it("uses 'LA' short name for los-angeles", () => {
    expect(
      buildBuildingTitle({ shortAddress: "1600 Vine St", neighborhood: "Hollywood", city: "los-angeles" })
    ).toBe("1600 Vine St: Reviews, Violations & Score | Hollywood, LA");
  });

  it("drops ' Violations &' clause when title exceeds 70 chars", () => {
    const long = buildBuildingTitle({
      shortAddress: "1234 Very Long Example Street Name",
      neighborhood: "A Somewhat Long Neighborhood Name",
      city: "nyc",
    });
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long).not.toMatch(/Violations &/);
    expect(long).toContain("Reviews");
    expect(long).toContain("Score");
  });

  it("drops city suffix as a last resort", () => {
    const veryLong = buildBuildingTitle({
      shortAddress: "12345 Extremely Long Address Name Goes Here",
      neighborhood: "An Even Longer Neighborhood Descriptor Name",
      city: "chicago",
    });
    expect(veryLong.length).toBeLessThanOrEqual(70);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildBuildingTitle`**

Create `src/lib/seo-metadata.ts`:

```ts
import type { City } from "./cities";
import { CITY_SHORT_NAME } from "./cities";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 155;

export interface BuildingTitleInput {
  shortAddress: string;
  neighborhood: string;
  city: City;
}

export function buildBuildingTitle(input: BuildingTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  const full = `${input.shortAddress}: Reviews, Violations & Score | ${input.neighborhood}, ${cityShort}`;
  if (full.length <= TITLE_MAX) return full;

  const noViolations = `${input.shortAddress}: Reviews & Score | ${input.neighborhood}, ${cityShort}`;
  if (noViolations.length <= TITLE_MAX) return noViolations;

  const noCity = `${input.shortAddress}: Reviews & Score | ${input.neighborhood}`;
  return noCity;
}
```

- [ ] **Step 4: Run tests to verify title passes**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts -t buildBuildingTitle`
Expected: all 4 tests PASS.

- [ ] **Step 5: Add description tests**

Append to the test file:

```ts
describe("buildBuildingDescription", () => {
  const base = {
    shortAddress: "240 1st Ave",
    neighborhood: "Stuyvesant Town",
    issues: 70,
    reviewCount: 12,
    overallScore: 4.2,
  };

  it("renders all clauses when they fit", () => {
    expect(buildBuildingDescription(base)).toBe(
      "240 1st Ave in Stuyvesant Town: 70 issues filed, 12 tenant reviews, LucidIQ 4.2/5. Free rent intelligence."
    );
  });

  it("shows '0 reviews yet' when reviewCount is 0", () => {
    expect(buildBuildingDescription({ ...base, reviewCount: 0 })).toMatch(/0 reviews yet/);
  });

  it("omits LucidIQ clause when overallScore is null", () => {
    const d = buildBuildingDescription({ ...base, overallScore: null });
    expect(d).not.toMatch(/LucidIQ/);
    expect(d).toContain("70 issues filed");
    expect(d).toContain("12 tenant reviews");
  });

  it("stays under 160 chars even with long inputs", () => {
    const d = buildBuildingDescription({
      shortAddress: "12345 Some Moderately Long Street Name",
      neighborhood: "A Long Neighborhood Name With Extra Words",
      issues: 999_999,
      reviewCount: 9999,
      overallScore: 4.7,
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it("drops closer first, then LucidIQ, then reviews to fit under 155", () => {
    // Craft an input where only truncation progression can fit
    const d = buildBuildingDescription({
      shortAddress: "12345 Extremely Long Street Name That Goes On",
      neighborhood: "Unusually Long Neighborhood Name Example",
      issues: 1234,
      reviewCount: 567,
      overallScore: 4.9,
    });
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d).toContain("issues filed"); // first clause always survives
  });
});
```

- [ ] **Step 6: Run failing description tests**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts -t buildBuildingDescription`
Expected: FAIL — function not defined.

- [ ] **Step 7: Implement `buildBuildingDescription`**

Add to `src/lib/seo-metadata.ts`:

```ts
export interface BuildingDescriptionInput {
  shortAddress: string;
  neighborhood: string;
  issues: number;
  reviewCount: number;
  overallScore: number | null;
}

export function buildBuildingDescription(input: BuildingDescriptionInput): string {
  const issuesFormatted = input.issues.toLocaleString("en-US");
  const firstClause = `${input.shortAddress} in ${input.neighborhood}: ${issuesFormatted} issues filed`;

  const reviewsClause =
    input.reviewCount > 0
      ? `${input.reviewCount.toLocaleString("en-US")} tenant reviews`
      : "0 reviews yet";

  const scoreClause =
    input.overallScore != null ? `LucidIQ ${input.overallScore.toFixed(1)}/5` : null;

  const closer = "Free rent intelligence.";

  // Full: first, reviews, score, closer
  const parts = [firstClause, reviewsClause];
  if (scoreClause) parts.push(scoreClause);
  const full = `${parts.join(", ")}. ${closer}`;
  if (full.length <= DESCRIPTION_MAX) return full;

  // Step 1: drop closer
  const noCloser = `${parts.join(", ")}.`;
  if (noCloser.length <= DESCRIPTION_MAX) return noCloser;

  // Step 2: drop LucidIQ
  const noScore = [firstClause, reviewsClause].join(", ") + ".";
  if (noScore.length <= DESCRIPTION_MAX) return noScore;

  // Step 3: drop reviews
  const firstOnly = `${firstClause}.`;
  if (firstOnly.length <= DESCRIPTION_MAX) return firstOnly;

  // Step 4: truncate first clause
  return firstClause.slice(0, DESCRIPTION_MAX - 1) + "…";
}
```

- [ ] **Step 8: Run all description tests**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts -t buildBuildingDescription`
Expected: all 5 tests PASS.

- [ ] **Step 9: Add H1 and lead paragraph tests**

Append:

```ts
describe("buildBuildingH1", () => {
  it("includes neighborhood and cityShort", () => {
    expect(
      buildBuildingH1({ shortAddress: "240 1st Ave", neighborhood: "Stuyvesant Town", city: "nyc" })
    ).toBe("240 1st Ave — Rent Intelligence for Stuyvesant Town, NYC");
  });
});

describe("buildBuildingLeadParagraph", () => {
  it("includes unit count when present", () => {
    const p = buildBuildingLeadParagraph({
      fullAddress: "240 1st Ave, New York, NY 10009",
      neighborhood: "Stuyvesant Town",
      city: "nyc",
      totalUnits: 412,
    });
    expect(p).toContain("412-unit rental building");
    expect(p).toContain("Stuyvesant Town, NYC");
  });

  it("omits unit count when total_units is null", () => {
    const p = buildBuildingLeadParagraph({
      fullAddress: "240 1st Ave, New York, NY 10009",
      neighborhood: "Stuyvesant Town",
      city: "nyc",
      totalUnits: null,
    });
    expect(p).not.toMatch(/\d+-unit/);
    expect(p).toContain("rental building");
  });
});
```

- [ ] **Step 10: Implement H1 and lead paragraph**

Append to `src/lib/seo-metadata.ts`:

```ts
export function buildBuildingH1(input: BuildingTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  return `${input.shortAddress} — Rent Intelligence for ${input.neighborhood}, ${cityShort}`;
}

export interface BuildingLeadParagraphInput {
  fullAddress: string;
  neighborhood: string;
  city: City;
  totalUnits: number | null;
}

export function buildBuildingLeadParagraph(input: BuildingLeadParagraphInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  const unitPrefix = input.totalUnits ? `${input.totalUnits.toLocaleString("en-US")}-unit ` : "";
  return `${input.fullAddress} is a ${unitPrefix}rental building in ${input.neighborhood}, ${cityShort}. See every violation, 311 complaint, tenant review, and the LucidIQ score — before you sign a lease.`;
}
```

- [ ] **Step 11: Run all tests**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts`
Expected: all tests PASS.

- [ ] **Step 12: Add landlord helper tests**

Append:

```ts
describe("buildLandlordTitle", () => {
  it("formats with counts", () => {
    expect(
      buildLandlordTitle({
        name: "Stellar Management",
        buildingCount: 412,
        totalIssues: 8947,
        city: "nyc",
      })
    ).toBe("Stellar Management: 412 Buildings, 8,947 Issues Filed & Tenant Reviews | NYC");
  });
});

describe("buildLandlordDescription", () => {
  it("includes name, counts, and city long name", () => {
    const d = buildLandlordDescription({
      name: "Stellar Management",
      buildingCount: 412,
      totalIssues: 8947,
      city: "nyc",
    });
    expect(d).toContain("Stellar Management's 412");
    expect(d).toContain("8,947 violations + 311 complaints");
    expect(d).toContain("New York City");
  });
});
```

- [ ] **Step 13: Implement landlord helpers**

Merge `CITY_META` into the existing `./cities` import at the top of `src/lib/seo-metadata.ts`. The top of the file should now read:

```ts
import type { City } from "./cities";
import { CITY_SHORT_NAME, CITY_META } from "./cities";
```

Then append to `src/lib/seo-metadata.ts`:

```ts
export interface LandlordTitleInput {
  name: string;
  buildingCount: number;
  totalIssues: number;
  city: City;
}

export function buildLandlordTitle(input: LandlordTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  return `${input.name}: ${input.buildingCount.toLocaleString("en-US")} Buildings, ${input.totalIssues.toLocaleString("en-US")} Issues Filed & Tenant Reviews | ${cityShort}`;
}

export function buildLandlordDescription(input: LandlordTitleInput): string {
  const cityLong = CITY_META[input.city].fullName;
  return `See every one of ${input.name}'s ${input.buildingCount.toLocaleString("en-US")} ${cityLong} buildings, all ${input.totalIssues.toLocaleString("en-US")} violations + 311 complaints filed against them, and real tenant reviews. Free rent intelligence.`;
}
```

- [ ] **Step 14: Run full file tests**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts`
Expected: all tests PASS.

- [ ] **Step 15: Commit**

```bash
git add src/lib/seo-metadata.ts tests/lib/seo-metadata.test.ts
git commit -m "feat(seo): add pure title/description/H1 builders with truncation rules"
```

---

## Task 4: Wire building page `generateMetadata` to new helpers

**Files:**
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx` (lines 103–162)

- [ ] **Step 1: Update imports**

At the top of the file, add:

```ts
import { buildBuildingTitle, buildBuildingDescription } from "@/lib/seo-metadata";
import { buildingNeighborhood } from "@/lib/neighborhoods";
```

- [ ] **Step 2: Replace the title + description construction**

Locate the block at lines 117–141 (from `const title =` through `const description = ...`). Replace it with:

```ts
  const addressFirstLine = building.full_address.split(",")[0]?.trim() ?? building.full_address;
  const shortAddress = addressFirstLine || building.full_address;

  const { name: neighborhoodName } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    cityParam as City
  );

  const isAltMetro = cityParam === "chicago" || cityParam === "miami" || cityParam === "houston";
  const metaViolationCount = isAltMetro
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);
  const issuesFiled = metaViolationCount + (building.complaint_count || 0);

  const title = buildBuildingTitle({
    shortAddress,
    neighborhood: neighborhoodName,
    city: cityParam as City,
  });

  const description = buildBuildingDescription({
    shortAddress,
    neighborhood: neighborhoodName,
    issues: issuesFiled,
    reviewCount: building.review_count,
    overallScore:
      building.overall_score != null
        ? // use normalizeScore to guarantee 0–5 scale
          Number(normalizeScore(building.overall_score).toFixed(1))
        : null,
  });
```

Keep the LA-specific `laExtras` logic deleted — the new description template does not use it. LA-specific signals (RSO, fire zone, Ellis Act) are Phase 2 content, not Phase 1 description clauses.

- [ ] **Step 3: Ensure `normalizeScore` is imported**

The file currently imports `normalizeScore` — confirm with a grep. If missing, add: `import { normalizeScore } from "@/lib/constants";`.

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manually spot-check a rendered page**

Start dev server if not running, visit a building page (e.g. `/nyc/building/manhattan/240-1-ave`), and view-source. Confirm:
- `<title>` matches the new template
- `<meta name="description">` matches the new template
- `<meta property="og:title">` carries the same title

- [ ] **Step 6: Commit**

```bash
git add src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "feat(seo): wire building page metadata to new template helpers"
```

---

## Task 5: JSON-LD updates (`src/lib/seo.ts`)

**Files:**
- Modify: `src/lib/seo.ts` (lines 93–152 for `buildingJsonLd`; lines 154–172 for `landlordJsonLd`)
- Test: `tests/lib/seo-jsonld.test.ts` (new)

- [ ] **Step 1: Write failing JSON-LD tests**

Create `tests/lib/seo-jsonld.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildingJsonLd, landlordJsonLd } from "@/lib/seo";

const buildingFixture = {
  full_address: "240 1st Ave, New York, NY 10009",
  borough: "Manhattan",
  zip_code: "10009",
  year_built: 1947,
  total_units: 412,
  overall_score: 4.2,
  review_count: 12,
  slug: "240-1-ave",
  name: null,
};

describe("buildingJsonLd", () => {
  it("uses multi-type ['ApartmentComplex','LocalBusiness']", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    expect(ld["@type"]).toEqual(["ApartmentComplex", "LocalBusiness"]);
  });

  it("sets AggregateRating.worstRating to 1 (Google spec)", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    const rating = ld.aggregateRating as Record<string, unknown>;
    expect(rating.worstRating).toBe(1);
    expect(rating.bestRating).toBe(5);
  });

  it("includes priceRange", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    expect(ld.priceRange).toBe("$$");
  });

  it("sets addressLocality to resolved neighborhood when zip matches", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    const addr = ld.address as Record<string, unknown>;
    // 10009 resolves to a real NYC neighborhood; just assert it's not borough
    expect(addr.addressLocality).not.toBe("Manhattan");
    expect(typeof addr.addressLocality).toBe("string");
  });

  it("falls back to borough when zip has no neighborhood match", () => {
    const ld = buildingJsonLd({ ...buildingFixture, zip_code: "00000" }, "nyc") as Record<string, unknown>;
    const addr = ld.address as Record<string, unknown>;
    expect(addr.addressLocality).toBe("Manhattan");
  });

  it("omits AggregateRating when review_count is 0", () => {
    const ld = buildingJsonLd({ ...buildingFixture, review_count: 0 }, "nyc") as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
  });
});

describe("landlordJsonLd", () => {
  it("includes counts in description", () => {
    const ld = landlordJsonLd("Stellar Management", 412, "nyc", undefined, 8947) as Record<string, unknown>;
    expect(ld.description).toContain("412 buildings");
    expect(ld.description).toContain("8,947 issues filed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/seo-jsonld.test.ts`
Expected: FAIL on `@type` multi-array check, `worstRating`, `priceRange`, `addressLocality` neighborhood match, and `landlordJsonLd` new parameter.

- [ ] **Step 3: Update `buildingJsonLd` in `src/lib/seo.ts`**

Replace the body starting at the `schema` object declaration (around line 114):

```ts
  const { name: addressLocality } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    city
  );

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["ApartmentComplex", "LocalBusiness"],
    name: hasProperName ? building.name : building.full_address,
    url,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: building.full_address.split(",")[0]?.trim(),
      addressLocality,
      addressRegion: meta.stateCode,
      postalCode: building.zip_code,
      addressCountry: "US",
    },
  };
```

Inside the existing `if (building.review_count > 0 && building.overall_score != null) { ... }` block, change `worstRating: 0` to `worstRating: 1`.

Add the import at the top of `src/lib/seo.ts`:

```ts
import { buildingNeighborhood } from "./neighborhoods";
```

- [ ] **Step 4: Update `landlordJsonLd` to accept total issues**

Replace the function with:

```ts
export function landlordJsonLd(
  name: string,
  buildingCount: number,
  city: City = DEFAULT_CITY,
  updatedAt?: string,
  totalIssues?: number
) {
  const meta = CITY_META[city];
  const issueClause =
    totalIssues != null && totalIssues > 0
      ? ` with ${totalIssues.toLocaleString("en-US")} issues filed`
      : "";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonicalUrl(landlordUrl(name, city)),
    description: `Property owner managing ${buildingCount.toLocaleString("en-US")} building${buildingCount !== 1 ? "s" : ""}${issueClause} in ${meta.fullName}`,
  };
  if (updatedAt) {
    ld.dateModified = updatedAt;
  }
  return ld;
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run tests/lib/seo-jsonld.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Type-check and ensure all callers of `landlordJsonLd` still compile**

Run: `pnpm tsc --noEmit`
Expected: PASS — the new `totalIssues` parameter is optional so existing callers work unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo.ts tests/lib/seo-jsonld.test.ts
git commit -m "fix(seo): multi-type JSON-LD, worstRating 1, neighborhood locality, landlord counts"
```

---

## Task 6: Building page H1 and hero-address neighborhood injection

**Files:**
- Modify: `src/components/building/v2/HeroV2.tsx`

**Rationale:** Keep the visually-compact H1 (`<h1>{street}</h1>`) but append a visually-hidden SEO continuation span so crawlers read the full `Rent Intelligence for {neighborhood}, {cityShort}` phrase. Also prepend neighborhood to the visible `hero-address` line so users benefit too.

- [ ] **Step 1: Inspect current H1 and hero-address markup**

Read lines 75–91 of `src/components/building/v2/HeroV2.tsx` to confirm structure before editing.

- [ ] **Step 2: Check whether HeroV2 already has access to `neighborhood` and `city`**

Read the component's props interface (top of file). If `city` is not already a prop, accept one. The streamed wrapper `HeroV2Streamed` already receives `city`, so threading it through is one extra prop.

- [ ] **Step 3: Add neighborhood resolution in HeroV2**

At the top of the render, after the existing destructuring:

```ts
import { buildingNeighborhood } from "@/lib/neighborhoods";
import { CITY_SHORT_NAME } from "@/lib/cities";

// ... inside the component
const { name: neighborhoodName, isFallback: neighborhoodIsFallback } = buildingNeighborhood(
  { zip_code: building.zip_code, borough: building.borough },
  city
);
const cityShort = CITY_SHORT_NAME[city];
```

- [ ] **Step 4: Update the H1 to carry the SEO phrase**

Replace `<h1>{street}</h1>` with:

```tsx
<h1>
  {street}
  <span className="sr-only"> — Rent Intelligence for {neighborhoodName}, {cityShort}</span>
</h1>
```

If the project does not already have a `sr-only` utility class, use inline style: `style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}`. Prefer a CSS class; check `src/app/globals.css` or Tailwind config — most Tailwind setups include `sr-only` by default.

- [ ] **Step 5: Prepend neighborhood to visible hero-address**

Replace the `<div className="hero-address">` block with:

```tsx
<div className="hero-address">
  {!neighborhoodIsFallback ? <span>{neighborhoodName} · </span> : null}
  {rest ? <span>{rest}</span> : null}
</div>
```

When neighborhood is a fallback (borough only), skip prepending — borough already appears in the breadcrumbs, no need to duplicate.

- [ ] **Step 6: Thread `city` prop through HeroV2Streamed**

Open `src/components/building/v2/streaming/HeroV2Streamed.tsx` and confirm `city` is already passed to HeroV2. If not, pass it through.

- [ ] **Step 7: Dev-server visual check**

Start dev server, open a building page, confirm:
- Hero looks visually similar
- Hero address line includes the neighborhood (e.g. "Stuyvesant Town · New York, NY 10009")
- View-source shows the full H1 text including the hidden continuation
- Run the page through https://pagespeed.web.dev or inspect with axe to confirm no accessibility regressions from the hidden span

- [ ] **Step 8: Commit**

```bash
git add src/components/building/v2/HeroV2.tsx src/components/building/v2/streaming/HeroV2Streamed.tsx
git commit -m "feat(seo): inject neighborhood into hero H1 (visually-hidden) and address line"
```

---

## Task 7: Building page lead paragraph

**Files:**
- Create: `src/components/building/BuildingLeadParagraph.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Create the component**

`src/components/building/BuildingLeadParagraph.tsx`:

```tsx
import type { City } from "@/lib/cities";
import { buildBuildingLeadParagraph } from "@/lib/seo-metadata";

interface Props {
  fullAddress: string;
  neighborhood: string;
  city: City;
  totalUnits: number | null;
}

export function BuildingLeadParagraph({ fullAddress, neighborhood, city, totalUnits }: Props) {
  return (
    <p className="building-lead-paragraph">
      {buildBuildingLeadParagraph({ fullAddress, neighborhood, city, totalUnits })}
    </p>
  );
}
```

- [ ] **Step 2: Add minimal CSS or rely on existing prose styles**

If no relevant style exists, add to `src/app/globals.css` (or the v2-specific stylesheet used by the building page):

```css
.building-lead-paragraph {
  max-width: 72ch;
  margin: 12px 0 24px;
  color: #475569;
  font-size: 15px;
  line-height: 1.55;
}
```

Skip if the existing hero/meta typography already produces a sensible default.

- [ ] **Step 3: Insert the component into the page**

In `src/app/[city]/building/[borough]/[slug]/page.tsx`, after `<HeroV2Streamed building={building} city={typedCity} />` (around line 237), add:

```tsx
<BuildingLeadParagraph
  fullAddress={building.full_address}
  neighborhood={buildingNeighborhood({ zip_code: building.zip_code, borough: building.borough }, typedCity).name}
  city={typedCity}
  totalUnits={building.total_units}
/>
```

Or thread a precomputed `neighborhoodName` from the top of the component to avoid calling `buildingNeighborhood` twice.

- [ ] **Step 4: Dev-server visual check**

Reload the page, confirm the lead paragraph renders below the hero with readable line length and correct copy.

- [ ] **Step 5: Commit**

```bash
git add src/components/building/BuildingLeadParagraph.tsx src/app/[city]/building/[borough]/[slug]/page.tsx src/app/globals.css
git commit -m "feat(seo): add lead paragraph below building hero for keyword context"
```

---

## Task 8a: Postgres RPC for landlord aggregates

**Files:**
- Create: `supabase/migrations/<timestamp>_landlord_agg_rpc.sql`

**Rationale:** Reviewer flagged that a 1,000-row fetch would silently under-count large portfolios (some landlords own >1K buildings) and that `getLandlordStats` must scope by metro to match the city-routed landlord page. A tiny Postgres RPC solves both problems: it aggregates server-side (no row-count ceiling) and takes the metro as a filter.

**Policy decision:** landlord pages are city-routed (`/[city]/landlord/[name]`), so stats and the building list should both be metro-scoped. This fixes a pre-existing inconsistency where `findBuildings()` did not filter by metro.

- [ ] **Step 1: Create the migration**

Filename: `supabase/migrations/<YYYYMMDDHHMMSS>_landlord_agg_rpc.sql` (use `date +%Y%m%d%H%M%S` to generate timestamp consistent with existing migrations).

```sql
-- Landlord aggregate stats for a given (slug, metro). Used by generateMetadata
-- on /[city]/landlord/[name] so the SERP title/description can show accurate
-- building_count and total_issues without fetching every building row.
CREATE OR REPLACE FUNCTION get_landlord_agg_stats(
  p_slug text,
  p_metro text DEFAULT 'nyc'
)
RETURNS TABLE (
  name text,
  building_count bigint,
  total_violations bigint,
  total_complaints bigint
)
LANGUAGE sql STABLE
AS $$
  WITH resolved AS (
    SELECT ls.name
    FROM landlord_stats ls
    WHERE ls.slug = p_slug
    LIMIT 1
  )
  SELECT
    r.name,
    COUNT(b.id)::bigint AS building_count,
    COALESCE(SUM(
      CASE
        WHEN p_metro IN ('chicago', 'miami', 'houston') THEN b.dob_violation_count
        ELSE b.violation_count
      END
    ), 0)::bigint AS total_violations,
    COALESCE(SUM(b.complaint_count), 0)::bigint AS total_complaints
  FROM resolved r
  LEFT JOIN buildings b
    ON b.owner_name = r.name
   AND b.metro = p_metro
  GROUP BY r.name;
$$;

-- Grant to the roles the app uses
GRANT EXECUTE ON FUNCTION get_landlord_agg_stats(text, text) TO anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase db reset` or the project's standard migration apply command. Confirm the function exists: `psql -c "\df get_landlord_agg_stats"`.

- [ ] **Step 3: Spot-test with a known landlord slug**

```bash
psql -c "SELECT * FROM get_landlord_agg_stats('stellar-management', 'nyc');"
```

Expected: one row with non-zero counts (assuming a Stellar-owned NYC building exists). If the slug does not exist the function returns zero rows — that is intentional.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(seo): add get_landlord_agg_stats RPC for accurate metadata counts"
```

---

## Task 8b: Cached `getLandlordStats()` fetcher

**Files:**
- Create: `src/lib/landlord-stats.ts`

**Rationale:** Wrap the RPC in React `cache()` so metadata and page render share one query per request.

- [ ] **Step 1: Create the module**

`src/lib/landlord-stats.ts`:

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { City } from "./cities";

export interface LandlordStats {
  name: string;
  buildingCount: number;
  totalViolations: number;
  totalComplaints: number;
  totalIssues: number;
}

/**
 * React-cached landlord aggregate fetcher. Safe to call from both
 * generateMetadata and the page component within the same request —
 * React dedupes identical calls via cache().
 *
 * Uses the get_landlord_agg_stats RPC so counts are server-side accurate
 * (no row-limit ceiling) and scoped to the landlord page's metro.
 */
export const getLandlordStats = cache(
  async (slug: string, city: City): Promise<LandlordStats | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_landlord_agg_stats", {
      p_slug: slug,
      p_metro: city,
    });

    if (error || !data || data.length === 0) return null;

    const row = data[0] as {
      name: string;
      building_count: number;
      total_violations: number;
      total_complaints: number;
    };

    return {
      name: row.name,
      buildingCount: Number(row.building_count) || 0,
      totalViolations: Number(row.total_violations) || 0,
      totalComplaints: Number(row.total_complaints) || 0,
      totalIssues: (Number(row.total_violations) || 0) + (Number(row.total_complaints) || 0),
    };
  }
);
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/landlord-stats.ts
git commit -m "feat(seo): add cached getLandlordStats fetcher via RPC"
```

---

## Task 9: Landlord page `generateMetadata` and body use cached stats

**Files:**
- Modify: `src/app/[city]/landlord/[name]/page.tsx`

**Rationale:** The existing `findBuildings()` helper queries `buildings` by `owner_name` with no `metro` filter — for landlords with multi-metro portfolios this means the displayed building list includes all metros while the city-routed URL implies a single-metro context. Task 9 Step 2 below adds the metro filter to keep the page body consistent with the new metro-scoped metadata.

- [ ] **Step 1: Update imports**

```ts
import { buildLandlordTitle, buildLandlordDescription } from "@/lib/seo-metadata";
import { getLandlordStats } from "@/lib/landlord-stats";
```

- [ ] **Step 2: Metro-scope `findBuildings()` so page body and metadata agree**

In `findBuildings()` (around lines 38–69), add `.eq("metro", city)` to the buildings query on the owner_name path. The function currently takes only `(supabase, param)` — add a third `city: City` parameter and thread it from the caller. Example:

```ts
async function findBuildings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  param: string,
  city: City
) {
  // ... existing statsRows lookup ...

  if (!ownerName) {
    const decodedName = decodeURIComponent(param);
    const { data: byName } = await supabase
      .from("buildings")
      .select(BUILDING_SELECT)
      .ilike("owner_name", decodedName)
      .eq("metro", city)
      .order("violation_count", { ascending: false })
      .limit(500);
    return byName && byName.length > 0 ? byName : null;
  }

  const { data: buildings } = await supabase
    .from("buildings")
    .select(BUILDING_SELECT)
    .eq("owner_name", ownerName)
    .eq("metro", city)
    .order("violation_count", { ascending: false })
    .limit(500);
  return buildings && buildings.length > 0 ? buildings : null;
}
```

Update the call-site (around line 114) to pass `city`: `findBuildings(supabase, name, city)`.

- [ ] **Step 3: Rewrite `generateMetadata`**

Replace lines 82–104 with:

```ts
export async function generateMetadata({
  params,
}: LandlordPageProps): Promise<Metadata> {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const stats = await getLandlordStats(name, city);

  if (!stats) {
    return { title: "Landlord Not Found" };
  }

  const title = buildLandlordTitle({
    name: stats.name,
    buildingCount: stats.buildingCount,
    totalIssues: stats.totalIssues,
    city,
  });

  const description = buildLandlordDescription({
    name: stats.name,
    buildingCount: stats.buildingCount,
    totalIssues: stats.totalIssues,
    city,
  });

  const url = canonicalUrl(landlordUrl(stats.name, city));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}
```

- [ ] **Step 4: Update JSON-LD call in the page body to use the cached stats**

Early in the page component (after resolving `city` and before the render tree), call:

```ts
const stats = await getLandlordStats(name, city);
```

Because `getLandlordStats` is wrapped in `React.cache()`, this is free — it returns the same result `generateMetadata` already fetched.

Then replace the existing `landlordJsonLd(...)` call to use the cached aggregates directly (do not recompute `totalViolations + totalComplaints` locally):

```tsx
<JsonLd data={landlordJsonLd(
  stats?.name ?? displayName,
  stats?.buildingCount ?? totalBuildings,
  city,
  updatedAt,
  stats?.totalIssues
)} />
```

- [ ] **Step 5: Type-check and dev-server check**

Run: `pnpm tsc --noEmit` (PASS expected).
Visit a landlord page, view source, confirm title/description/JSON-LD are updated.

- [ ] **Step 6: Commit**

```bash
git add src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(seo): landlord page metadata + body use metro-scoped cached stats"
```

---

## Task 10: Add char-count assertions test for representative real-world inputs

**Files:**
- Modify: `tests/lib/seo-metadata.test.ts` — append a metro-matrix test block.

- [ ] **Step 1: Add the matrix test**

```ts
describe("metro matrix — char caps hold across 5 metros", () => {
  const cases = [
    { shortAddress: "240 1st Ave", neighborhood: "Stuyvesant Town", city: "nyc" as const },
    { shortAddress: "1600 Vine St", neighborhood: "Hollywood", city: "los-angeles" as const },
    { shortAddress: "875 N Michigan Ave", neighborhood: "Gold Coast", city: "chicago" as const },
    { shortAddress: "1100 Brickell Bay Dr", neighborhood: "Brickell", city: "miami" as const },
    { shortAddress: "1600 Smith St", neighborhood: "Downtown", city: "houston" as const },
  ] as const;

  it.each(cases)("title ≤70 for %o", (input) => {
    expect(buildBuildingTitle(input).length).toBeLessThanOrEqual(70);
  });

  it.each(cases)("description ≤160 for %o", (input) => {
    const d = buildBuildingDescription({
      shortAddress: input.shortAddress,
      neighborhood: input.neighborhood,
      issues: 1234,
      reviewCount: 56,
      overallScore: 4.1,
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run tests/lib/seo-metadata.test.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/seo-metadata.test.ts
git commit -m "test(seo): add metro-matrix char-cap assertions"
```

---

## Task 11: Full test and type-check sweep

**Files:** N/A — verification step.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all tests PASS. Zero new failures introduced.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint (if project lints)**

Run: `pnpm lint` (if present)
Expected: PASS.

---

## Task 12: Schema validator check

**Files:** N/A — manual verification.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Fetch rendered HTML for a building and a landlord page**

```bash
curl -s "http://localhost:3000/nyc/building/manhattan/240-1-ave" | grep -A 100 "application/ld+json"
curl -s "http://localhost:3000/nyc/landlord/stellar-management" | grep -A 50 "application/ld+json"
```

- [ ] **Step 3: Paste the JSON-LD into https://validator.schema.org**

Expected: no errors. Warnings OK if they don't affect AggregateRating or the LocalBusiness multi-type.

- [ ] **Step 4: Run Google Rich Results Test**

https://search.google.com/test/rich-results — paste the raw HTML. Expected: "Review snippets" detected as eligible when `review_count > 0`.

- [ ] **Step 5: Note results in a comment on the PR** (no commit needed; this is verification)

---

## Task 13: PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(seo): Phase 1 metadata pass — neighborhood injection, issues-filed, star rich result fixes" --body "$(cat <<'EOF'
## Summary

- Inject neighborhood names into building page titles, descriptions, H1, hero address line, and JSON-LD `addressLocality`
- Lump `violation_count + complaint_count` as "issues filed" in descriptions
- Landlord titles/descriptions now include building count and total issues filed
- JSON-LD: multi-type `["ApartmentComplex", "LocalBusiness"]`, fix `worstRating: 0 → 1`, add `priceRange`
- New pure helpers in `src/lib/seo-metadata.ts` with vitest coverage
- New cached `getLandlordStats()` shared between metadata and page render

Spec: docs/superpowers/specs/2026-04-20-seo-metadata-pass-design.md
Plan: docs/superpowers/plans/2026-04-20-seo-metadata-pass.md

## Test plan

- [ ] `pnpm test` green
- [ ] `pnpm tsc --noEmit` clean
- [ ] Manual visit: NYC building page renders hero with neighborhood, lead paragraph, updated title
- [ ] Manual visit: LA, Chicago, Miami, Houston building pages render correctly
- [ ] Manual visit: Landlord page shows counts in title
- [ ] schema.org validator clean on a representative building JSON-LD
- [ ] Google Rich Results Test shows review-snippet eligibility

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- **The landlord-stats RPC (Task 8a) is the authoritative aggregate source.** Do not also add aggregate columns to the `landlord_stats` view — the RPC + React `cache()` combination is enough.
- **`normalizeScore`** is already used at the existing metadata boundary — keep that behavior (it handles DB values that might be on a 0–10 scale in some rows).
- **The `sr-only` class** should already exist (Tailwind default). If not, reuse the inline style shown in Task 6 Step 4.
- **LA-specific description extras** (RSO, fire zone, Ellis Act) are intentionally dropped in Phase 1 because the new `issues filed` framing is stronger. Those signals remain on the page body; they just don't appear in descriptions anymore.
- **If a test in Task 2 assumes `10009 → East Village` and that ZIP is not in `NYC_ZIP_NEIGHBORHOODS`**, swap to any NYC ZIP you confirm is in the map. The test's intent is "a real mapping returns `isFallback: false`," not a specific string match.
