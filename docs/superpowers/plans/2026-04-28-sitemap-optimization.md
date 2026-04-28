# Sitemap Optimization & Internal Linking — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index ~454 currently-orphaned hub-page URLs via a new `public/sitemap/hubs.xml` (listed last in `index.xml`), wire prominent internal links from hub pages, add 5 cross-link patterns for topical clusters, and standardize the `Breadcrumbs + ArrowLeft` pattern on landlord subpages.

**Architecture:** Extend the existing JS sitemap generator (`scripts/generate-sitemaps.mjs`) with a new `generateHubsSitemap()` function and reorder the index. Add a Tools & Resources card grid to `[city]/page.tsx`, a Resources column to `Footer.tsx`, and small cross-link components to landlord, neighborhood, tenant-rights topic, calculator, and chip pages. Adopt the existing `Breadcrumbs` component pattern (already used on building subpages) on the two landlord subpages that lack it.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (`@supabase/ssr`), Tailwind, lucide-react icons. Sitemap generator is plain `.mjs` (no TS imports). Tests: vitest (sparse — codebase prefers smoke verification over unit tests).

**Spec:** [docs/superpowers/specs/2026-04-28-sitemap-optimization-design.md](docs/superpowers/specs/2026-04-28-sitemap-optimization-design.md)

---

## Pre-resolved advisory notes (from spec review)

| Note | Resolution |
|---|---|
| `cityPath()` exists with expected signature? | ✅ Confirmed at [src/lib/seo.ts:38](src/lib/seo.ts:38) — `cityPath(path: string, city: City = DEFAULT_CITY): string` |
| Landlord ↔ buildings join column? | `buildings.owner_name` (string). Resolved from `landlord_stats.slug` via `resolveOwnerName(slug, city)` at [src/app/[city]/landlord/[name]/_data.ts:253](src/app/%5Bcity%5D/landlord/%5Bname%5D/_data.ts:253). Pattern: `supabase.from("buildings").select(...).eq("owner_name", ownerName).eq("metro", city)` |
| Duplicate compare routes — both functional? | ✅ Both `/[city]/neighborhood/compare/page.tsx` and `/[city]/neighborhoods/compare/page.tsx` exist with full implementations. Sitemap both for now; consolidation is a separate cleanup task |
| Breadcrumb audit — which subpages already have it? | All "unverified" rows actually **do** have `Breadcrumbs` already. Only **2 files need adding**: `landlord/[name]/reviews` and `landlord/[name]/buildings`. Saves ~5 audit tasks |
| `TOPIC_RELATED_TOOLS` coverage scope | Ship a **starter mapping for 6 NYC topics** (security-deposits, eviction-protections, repairs-and-maintenance, rent-stabilization-rights, harassment) + 3 LA topics (rso-rent-stabilization, just-cause-eviction, repairs-and-habitability). Other cities/topics fall through with no "Related tools" section. Full coverage is a follow-up task |
| Ellis Act LA-only gating | Route is `src/app/[city]/ellis-act/page.tsx` (lowercase). Use `cityPath("/ellis-act", "los-angeles")` → `/CA/Los-Angeles/ellis-act`. Not multiplied across `VALID_CITIES` |
| Tenant-rights cities with topic data | Only `nyc`, `los-angeles`, `chicago`. Miami and Houston **omitted** from `TENANT_RIGHTS_TOPICS` — the route calls `notFound()` for those cities, so emitting URLs would produce 404s |

---

## File map

| Path | Action | Purpose |
|---|---|---|
| `scripts/generate-sitemaps.mjs` | Modify | Add inline slug arrays; add `generateHubsSitemap()`; wire it into `fullGenerate()` and `incrementalGenerate()`; update `rebuildIndex()` sort order |
| `src/lib/tenant-rights-data.ts` | Modify | Add `TOPIC_RELATED_TOOLS` map |
| `src/lib/calculator-related-topics.ts` | Create | New module exporting `CALCULATOR_RELATED_TOPICS` map (inverse of TOPIC_RELATED_TOOLS) |
| `src/components/seo/CityToolsGrid.tsx` | Create | Reusable Tools & Resources card grid for the city hub |
| `src/app/[city]/page.tsx` | Modify | Mount `<CityToolsGrid />` |
| `src/components/layout/Footer.tsx` | Modify | Add "Resources" column |
| `src/app/[city]/neighborhoods/page.tsx` | Modify | Add "Rent data →" link per neighborhood |
| `src/components/landlord/LandlordNeighborhoods.tsx` | Create | "Neighborhoods we operate in" section (cross-link 4.1) |
| `src/app/[city]/landlord/[name]/page.tsx` | Modify | Mount `<LandlordNeighborhoods />` |
| `src/components/neighborhood/NeighborhoodTopLandlords.tsx` | Create | "Top landlords here" section (cross-link 4.2) |
| `src/app/[city]/neighborhood/[slug]/page.tsx` | Modify | Mount `<NeighborhoodTopLandlords />` |
| `src/components/tenant-rights/RelatedTools.tsx` | Create | "Related tools" section (cross-link 4.3) |
| `src/app/[city]/tenant-rights/[topic]/page.tsx` | Modify | Mount `<RelatedTools />` |
| `src/components/calculators/RelatedGuides.tsx` | Create | "Related guides" footer (cross-link 4.4) |
| `src/app/rent-affordability-calculator/page.tsx` | Modify | Mount `<RelatedGuides />` |
| `src/app/rent-timing-calculator/page.tsx` | Modify | Mount `<RelatedGuides />` |
| `src/app/fair-rent-engine/page.tsx` | Modify | Mount `<RelatedGuides />` |
| `src/components/building-list/PeerChips.tsx` | Create | "Browse by other criteria" strip (cross-link 4.5) |
| `src/app/[city]/building-list/[chip]/page.tsx` | Modify | Mount `<PeerChips />` |
| `src/app/[city]/landlord/[name]/reviews/page.tsx` | Modify | Replace text "← Back" with `Breadcrumbs + ArrowLeft` standard |
| `src/app/[city]/landlord/[name]/buildings/page.tsx` | Modify | Same |

---

## Task 1: Inline slug arrays in `generate-sitemaps.mjs`

**Files:**
- Modify: `scripts/generate-sitemaps.mjs` (top of file, after the existing `ZIP_MAPS` block around line 95)

- [ ] **Step 1.1: Read current file to find insertion point**

Run: `grep -n "const ZIP_MAPS\|const SUBWAY_LINE_SLUGS\|^// ─── URL helpers" scripts/generate-sitemaps.mjs`
Expected: shows the location of the existing inline data block. Insert new arrays AFTER `ZIP_MAPS` and BEFORE the `// ─── URL helpers` divider.

- [ ] **Step 1.2: Add inline slug arrays**

Insert this block after the `const ZIP_MAPS = ...` declaration (around line 96):

```js
// ─── Hub sitemap slug arrays ────────────────────────────────────
// Mirror src/lib/tenant-templates-data.ts → TEMPLATES[].slug
// Manual sync — these change rarely.
const TEMPLATE_SLUGS = [
  "repair-maintenance-request",
  "rent-reduction-request",
  "security-deposit-demand",
  "lease-negotiation",
  "harassment-complaint",
  "heat-hot-water-complaint",
  "pest-complaint",
  "illegal-eviction-response",
];

// Mirror src/lib/tenant-rights-data.ts per-city `topics[].slug`
// Only nyc, los-angeles, and chicago have topic configs. Miami and Houston
// are intentionally omitted — the [city]/tenant-rights/[topic] route calls
// notFound() for cities without a config, so any URL we'd emit would 404.
// Manual sync — these change rarely.
const TENANT_RIGHTS_TOPICS = {
  nyc: ["rent-stabilization-rights", "repairs-and-maintenance", "eviction-protections", "security-deposits", "lease-renewals", "harassment", "heat-and-hot-water", "bed-bugs-and-pests", "illegal-apartments", "retaliation"],
  "los-angeles": ["rso-rent-stabilization", "just-cause-eviction", "repairs-and-habitability", "relocation-assistance", "ellis-act", "security-deposits", "earthquake-retrofit", "harassment-and-retaliation"],
  chicago: ["rlto-protections", "repairs-and-maintenance", "just-cause-eviction", "security-deposits", "lease-renewals", "harassment", "heat-requirements", "lead-paint", "bed-bugs-and-pests", "retaliation"],
  // miami and houston intentionally omitted — no topic config exists
};

// Mirror src/lib/building-list/chips.ts → CHIPS keys
// Manual sync — these change rarely.
const CHIP_SLUGS = ["top-rated", "rent-stabilized", "most-reviewed", "no-violations", "large-buildings"];

// Global calculator paths
const CALCULATOR_PATHS = ["/rent-affordability-calculator", "/rent-timing-calculator", "/fair-rent-engine"];
```

- [ ] **Step 1.3: Spot-check inlined slugs against the source-of-truth**

Run:
```bash
grep -E "^\s*slug:" src/lib/tenant-rights-data.ts | sort -u
```
Expected: every slug in the `nyc`, `los-angeles`, and `chicago` arrays of `TENANT_RIGHTS_TOPICS` (Step 1.2) appears in the output. If any slug is missing or extra, update the inlined arrays to match.

**Do NOT add miami or houston** — they have no topic config; the route calls `notFound()` for those cities.

- [ ] **Step 1.4: Commit (checkpoint)**

```bash
git add scripts/generate-sitemaps.mjs
git commit -m "feat(sitemap): inline slug arrays for hubs sitemap generation"
```

---

## Task 2: Add `generateHubsSitemap()` function

**Files:**
- Modify: `scripts/generate-sitemaps.mjs` (add new function after `generateStaticSitemap()` at line 259)

- [ ] **Step 2.1: Add `generateHubsSitemap()` function**

Insert this function immediately after `generateStaticSitemap()` (after line 259):

```js
async function generateHubsSitemap() {
  const entries = [];
  const now = new Date().toISOString();

  // Tenant tools hubs (5)
  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/tenant-tools", city)}`, lastmod: now, changefreq: "monthly", priority: 0.5 });
  }

  // Tenant tool templates (8 × 5 = 40)
  for (const city of VALID_CITIES) {
    for (const slug of TEMPLATE_SLUGS) {
      entries.push({ url: `${BASE_URL}${cityPath(`/tenant-tools/templates/${slug}`, city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
    }
  }

  // Tenant rights topics (per-city ~5-10)
  for (const city of VALID_CITIES) {
    const topics = TENANT_RIGHTS_TOPICS[city] || [];
    for (const slug of topics) {
      entries.push({ url: `${BASE_URL}${cityPath(`/tenant-rights/${slug}`, city)}`, lastmod: now, changefreq: "monthly", priority: 0.5 });
    }
  }

  // Neighborhoods hub (5) + both compare variants (10)
  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhoods", city)}`, lastmod: now, changefreq: "weekly", priority: 0.6 });
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhoods/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhood/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
  }

  // Rents by neighborhood — reuse ZIP enumeration (~310 unique combos)
  // Pulls from buildings table just like generateStaticSitemap does for /neighborhood/[slug]
  try {
    const zipData = await supabaseFetch("buildings?select=zip_code,metro,updated_at&zip_code=not.is.null&limit=10000");
    const zipCityLastMod = new Map();
    for (const b of zipData) {
      if (!b.zip_code) continue;
      const city = metroToCity(b.metro);
      const key = `${city}:${b.zip_code}`;
      const d = b.updated_at || now;
      const existing = zipCityLastMod.get(key);
      if (!existing || d > existing) zipCityLastMod.set(key, d);
    }
    for (const [key, lastmod] of zipCityLastMod) {
      const [city, zip] = key.split(":");
      const slug = neighborhoodPageSlug(zip, city);
      entries.push({ url: `${BASE_URL}${cityPath(`/rents/${slug}`, city)}`, lastmod, changefreq: "weekly", priority: 0.5 });
    }
  } catch (e) {
    console.warn(`  ⚠ Skipping rents-by-neighborhood in hubs sitemap: ${e.message}`);
  }

  // Ellis Act tracker — LA only. Route is /[city]/ellis-act (lowercase).
  // cityPath("/ellis-act", "los-angeles") yields /CA/Los-Angeles/ellis-act
  entries.push({ url: `${BASE_URL}${cityPath("/ellis-act", "los-angeles")}`, lastmod: now, changefreq: "weekly", priority: 0.5 });

  // Building list hubs (5) + chip pages (25)
  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/building-list", city)}`, lastmod: now, changefreq: "weekly", priority: 0.5 });
    for (const slug of CHIP_SLUGS) {
      entries.push({ url: `${BASE_URL}${cityPath(`/building-list/${slug}`, city)}`, lastmod: now, changefreq: "weekly", priority: 0.4 });
    }
  }

  // Global calculators (3)
  for (const path of CALCULATOR_PATHS) {
    entries.push({ url: `${BASE_URL}${path}`, lastmod: now, changefreq: "monthly", priority: 0.6 });
  }

  return entries;
}
```

- [ ] **Step 2.2: Verify the function would compile (smoke read)**

Run: `node --check scripts/generate-sitemaps.mjs`
Expected: no syntax errors (the file is valid; the new function is syntactically sound).

- [ ] **Step 2.3: Commit (checkpoint)**

```bash
git add scripts/generate-sitemaps.mjs
git commit -m "feat(sitemap): add generateHubsSitemap() function"
```

---

## Task 3: Wire `generateHubsSitemap()` into `fullGenerate()` and `incrementalGenerate()`

**Files:**
- Modify: `scripts/generate-sitemaps.mjs:308-313` (in `fullGenerate()`) and around line 437 (in `incrementalGenerate()`)

- [ ] **Step 3.1: Add hubs.xml write in `fullGenerate()`**

Find the block in `fullGenerate()` that writes `0.xml`:

```js
// Static sitemap
console.log("  [0.xml] static pages...");
const staticEntries = await generateStaticSitemap();
writeFileSync(`${OUT_DIR}/0.xml`, buildSitemapXml(staticEntries));
console.log(`  [0.xml] ${staticEntries.length} URLs`);
```

Add **immediately after** that block:

```js
// Hubs sitemap
console.log("  [hubs.xml] hub pages...");
const hubsEntries = await generateHubsSitemap();
writeFileSync(`${OUT_DIR}/hubs.xml`, buildSitemapXml(hubsEntries));
console.log(`  [hubs.xml] ${hubsEntries.length} URLs`);
```

- [ ] **Step 3.2: Add hubs.xml write in `incrementalGenerate()`**

Find the same `0.xml` write block in `incrementalGenerate()` (around line 437–439). Add the same hubs.xml block after it.

- [ ] **Step 3.3: Commit (checkpoint)**

```bash
git add scripts/generate-sitemaps.mjs
git commit -m "feat(sitemap): wire hubs.xml into full + incremental generation"
```

---

## Task 4: Update `rebuildIndex()` sort order

**Files:**
- Modify: `scripts/generate-sitemaps.mjs:282-289` (the `order()` function inside `rebuildIndex()`)

- [ ] **Step 4.1: Replace the sort logic**

Replace the current `order` function:

```js
const order = (n) => {
  if (n === "0.xml") return "0-0";
  if (n.startsWith("l-")) return `1-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (n.startsWith("b-")) return `2-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  return n;
};
```

With:

```js
const order = (n) => {
  // Crawl priority: buildings first, then landlords, then static, hubs last.
  // Google weakly honors index.xml order; this is the only "priority signal" available.
  if (n.startsWith("b-")) return `0-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (n.startsWith("l-")) return `1-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (n === "0.xml")     return "2-0";
  if (n === "hubs.xml")  return "3-0";
  return n;
};
```

- [ ] **Step 4.2: Commit (checkpoint)**

```bash
git add scripts/generate-sitemaps.mjs
git commit -m "feat(sitemap): reorder index.xml so buildings/landlords precede hubs"
```

---

## Task 5: Run the generator and verify output

**Files:**
- Read: `public/sitemap/hubs.xml`, `public/sitemap/index.xml`

- [ ] **Step 5.1: Run the generator (full mode)**

Run: `node scripts/generate-sitemaps.mjs`
Expected: console output includes `[hubs.xml] N URLs` where N is between 400 and 700. No errors.

If the script fails on Supabase auth, ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are in env. From repo root:
```bash
export $(grep -v '^#' .env.local | xargs) && node scripts/generate-sitemaps.mjs
```

- [ ] **Step 5.2: Verify hubs.xml exists and has expected URL count**

Run: `grep -c "<url>" public/sitemap/hubs.xml`
Expected: count is ≥ 400 (actual ~454–650).

- [ ] **Step 5.3: Verify XML well-formedness for all changed files**

Run: `xmllint --noout public/sitemap/hubs.xml public/sitemap/index.xml public/sitemap/0.xml`
Expected: no output (silent = valid). If `xmllint` is not available: `brew install libxml2`.

- [ ] **Step 5.4: Verify index.xml ordering (buildings first, hubs last)**

Run: `grep "<loc>" public/sitemap/index.xml | head -5; echo "---"; grep "<loc>" public/sitemap/index.xml | tail -3`
Expected: first 5 entries reference `/sitemap/b-*.xml`. Last entry references `/sitemap/hubs.xml`.

- [ ] **Step 5.5: Spot-check 5 URLs from hubs.xml return 200**

Run (from repo root, dev server NOT required — these are production paths):
```bash
for url in \
  "https://lucidrents.com/nyc/tenant-tools" \
  "https://lucidrents.com/nyc/tenant-tools/templates/security-deposit-demand" \
  "https://lucidrents.com/nyc/tenant-rights/eviction-protections" \
  "https://lucidrents.com/CA/Los-Angeles/ellis-act" \
  "https://lucidrents.com/rent-affordability-calculator"; do
  echo "$url $(curl -s -o /dev/null -w '%{http_code}' "$url")"
done
```
Expected: all 200. If any 404, the URL pattern in `generateHubsSitemap()` is wrong — fix and re-run Task 5.1.

- [ ] **Step 5.6: Commit (checkpoint — only if local files changed beyond the script)**

If `public/sitemap/*.xml` is gitignored (likely), no commit needed. Otherwise:
```bash
git add public/sitemap/hubs.xml public/sitemap/index.xml
git commit -m "chore(sitemap): regenerate sitemaps with hubs.xml"
```

Run: `cat .gitignore | grep -E "^public/sitemap|^/public/sitemap"`
If found: skip the commit (sitemap files are generated at build time on Vercel).

---

## Task 6: Add Tools & Resources card grid to city hub

**Files:**
- Create: `src/components/seo/CityToolsGrid.tsx`
- Modify: `src/app/[city]/page.tsx`

- [ ] **Step 6.1: Create `CityToolsGrid.tsx`**

```tsx
import Link from "next/link";
import { Wrench, ScrollText, MapPinned, Building2, FileWarning, GitCompareArrows } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props { city: City }

interface Tool {
  href: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export function CityToolsGrid({ city }: Props) {
  const tools: Tool[] = [
    { href: cityPath("/tenant-tools", city), title: "Tenant tools", description: "Templates and tools for repairs, rent disputes, security deposits, and more.", Icon: Wrench },
    { href: cityPath("/tenant-rights", city), title: "Know your rights", description: "Plain-English guides to tenant law in your city.", Icon: ScrollText },
    { href: cityPath("/neighborhoods", city), title: "Browse neighborhoods", description: "Compare rent, safety, and amenities across neighborhoods.", Icon: MapPinned },
    { href: cityPath("/building-list", city), title: "Browse buildings", description: "Top-rated, rent-stabilized, and other curated building lists.", Icon: Building2 },
    { href: cityPath("/compare", city), title: "Compare buildings", description: "Side-by-side comparison of any two buildings.", Icon: GitCompareArrows },
  ];

  if (city === "los-angeles") {
    tools.push({ href: cityPath("/ellis-act", "los-angeles"), title: "Ellis Act tracker", description: "Track Ellis Act evictions and protected units in Los Angeles.", Icon: FileWarning });
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="text-2xl font-semibold text-[#0f172a] mb-6">Tools & Resources</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-[#e2e8f0] bg-white p-5 transition hover:border-[#0d9488] hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 text-[#0d9488] mt-0.5" />
              <div>
                <h3 className="font-medium text-[#0f172a] group-hover:text-[#0d9488]">{title}</h3>
                <p className="text-sm text-[#64748b] mt-1">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6.2: Mount `<CityToolsGrid />` in city hub**

Open `src/app/[city]/page.tsx`. Find the place in the JSX where main content sections are listed (after the hero, before the footer-area sections). Add:

```tsx
import { CityToolsGrid } from "@/components/seo/CityToolsGrid";
// ...

<CityToolsGrid city={city} />
```

The exact placement: after the existing primary feature grid/CTA section, before any FAQ or news sections. Use grep to find a good spot:

Run: `grep -n "<RegionGrid\|<PopularListicles\|<ExploreDataGrid\|<FAQ" src/app/[city]/page.tsx | head -5`
Expected: shows existing sections; insert `<CityToolsGrid />` between two of them (e.g., after `<ExploreDataGrid />`).

- [ ] **Step 6.3: Build the project to catch type errors**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds. If TypeScript errors mention `cityPath` or `City`, ensure imports match the existing `src/lib/seo.ts` and `src/lib/cities.ts` patterns.

- [ ] **Step 6.4: Visual verification (dev server)**

Run dev server with `npm run dev`. Open `http://localhost:3000/nyc` and confirm:
- "Tools & Resources" heading is visible
- 5 cards render (NYC) or 6 cards (`/CA/Los-Angeles`)
- Each card link navigates correctly when clicked

If verifying via the preview tools rather than a manual browser, follow the verification workflow (preview_start → preview_snapshot → preview_screenshot).

- [ ] **Step 6.5: Commit**

```bash
git add src/components/seo/CityToolsGrid.tsx src/app/[city]/page.tsx
git commit -m "feat(seo): add Tools & Resources card grid to city hub"
```

---

## Task 7: Add Resources column to Footer

**Files:**
- Modify: `src/components/layout/Footer.tsx`

- [ ] **Step 7.1: Read the existing footer to understand the column structure**

Run: `grep -n "<div\|<Link\|className=\"col\|grid-cols\|<h3\|<h4" src/components/layout/Footer.tsx | head -30`
Find the existing column blocks (likely 3 columns now: Lucid/Site, Company, Legal). The new column slots in alongside.

- [ ] **Step 7.2: Add the Resources column**

Insert a new `<div>` column with the same structure as existing columns. Pattern:

```tsx
<div>
  <h4 className="text-white font-medium mb-3">Resources</h4>
  <ul className="space-y-2 text-sm">
    <li>
      <Link href="/rent-affordability-calculator" className="hover:text-white transition-colors">
        Rent affordability calculator
      </Link>
    </li>
    <li>
      <Link href="/rent-timing-calculator" className="hover:text-white transition-colors">
        Rent timing calculator
      </Link>
    </li>
    <li>
      <Link href="/fair-rent-engine" className="hover:text-white transition-colors">
        Fair rent engine
      </Link>
    </li>
    <li>
      <Link href={cityPath("/tenant-tools", city)} className="hover:text-white transition-colors">
        Tenant tools
      </Link>
    </li>
    <li>
      <Link href={cityPath("/tenant-rights", city)} className="hover:text-white transition-colors">
        Know your rights
      </Link>
    </li>
  </ul>
</div>
```

The Footer already accepts a `city: City` prop (verify via the function signature near the top of the file). If it doesn't, derive a default of `"nyc"` per the existing pattern.

- [ ] **Step 7.3: Update the parent grid `grid-cols-N` if needed**

If the existing grid is `grid-cols-3 md:grid-cols-3` and adding a 4th column makes the layout cramped, change to `grid-cols-2 md:grid-cols-4` or similar. Match Tailwind classes already used in the file.

- [ ] **Step 7.4: Build + visual verify**

Run: `npm run build`
Then dev server. Confirm the Resources column renders on every page (footer is global) and links work.

- [ ] **Step 7.5: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(seo): add Resources column to footer"
```

---

## Task 8: Add "Rent data →" link to Neighborhoods hub

**Files:**
- Modify: `src/app/[city]/neighborhoods/page.tsx`

- [ ] **Step 8.1: Inspect the existing neighborhoods hub structure**

Run: `grep -n "neighborhoodUrl\|neighborhood/\|cityPath\|Link" src/app/[city]/neighborhoods/page.tsx | head -20`
Find where each neighborhood is rendered as a card or list item.

- [ ] **Step 8.2: Add the rents link beside each neighborhood entry**

For each rendered neighborhood, add a secondary link:

```tsx
<Link
  href={cityPath(`/rents/${slug}`, city)}
  className="text-sm text-[#0d9488] hover:underline"
>
  Rent data →
</Link>
```

Where `slug` is the same neighborhood slug used to build the existing primary link. The `cityPath` helper is already imported in this file (or import from `@/lib/seo` if not).

- [ ] **Step 8.3: Build + visual verify**

Run: `npm run build`
Open `http://localhost:3000/nyc/neighborhoods`. Confirm each neighborhood entry has a "Rent data →" link that navigates to `/nyc/rents/<slug>`.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/[city]/neighborhoods/page.tsx
git commit -m "feat(seo): cross-link neighborhoods hub to rents-by-neighborhood pages"
```

---

## Task 9: Cross-link 4.1 — Landlord page → "Neighborhoods we operate in"

**Files:**
- Create: `src/components/landlord/LandlordNeighborhoods.tsx`
- Modify: `src/app/[city]/landlord/[name]/page.tsx`
- Modify: `src/app/[city]/landlord/[name]/_data.ts` (add a loader)

- [ ] **Step 9.1: Add a data loader in `_data.ts`**

In `src/app/[city]/landlord/[name]/_data.ts`, add a new exported `cache()`-wrapped loader. Use the existing `resolveOwnerName` pattern (line 253):

```ts
export const loadLandlordNeighborhoods = cache(
  async (slug: string, city: City): Promise<Array<{ slug: string; name: string; buildingCount: number }>> => {
    const ownerName = await resolveOwnerName(slug, city);
    if (!ownerName) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("buildings")
      .select("zip_code")
      .eq("owner_name", ownerName)
      .eq("metro", city)
      .not("zip_code", "is", null);

    if (!data?.length) return [];

    // Aggregate buildings per neighborhood (mapped from ZIP)
    const counts = new Map<string, { name: string; count: number; sampleZip: string }>();
    for (const row of data) {
      const zip = row.zip_code as string;
      const name = getNeighborhoodNameByCity(zip, city); // import from "@/lib/neighborhoods"
      if (!name) continue;
      const existing = counts.get(name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(name, { name, count: 1, sampleZip: zip });
      }
    }

    // neighborhoodPageSlug = slugify(name) + "-" + zip
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((n) => ({
        slug: `${slugify(n.name)}-${n.sampleZip}`,
        name: n.name,
        buildingCount: n.count,
      }));
  }
);
```

Add the imports `getNeighborhoodNameByCity` and `slugify` near the top of the file (use the existing patterns; `slugify` may live in `@/lib/seo` or be a local helper — grep for it first).

Run: `grep -rn "export function slugify\|export const slugify" src/lib | head -3`
Expected: location of slugify export. Import from there.

- [ ] **Step 9.2: Create the component**

```tsx
// src/components/landlord/LandlordNeighborhoods.tsx
import Link from "next/link";
import { MapPin } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  neighborhoods: Array<{ slug: string; name: string; buildingCount: number }>;
}

export function LandlordNeighborhoods({ city, neighborhoods }: Props) {
  if (neighborhoods.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-[#0d9488]" />
        <h3 className="font-medium text-[#0f172a]">Neighborhoods we operate in</h3>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {neighborhoods.map((n) => (
          <li key={n.slug}>
            <Link
              href={cityPath(`/neighborhood/${n.slug}`, city)}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[#f1f5f9]"
            >
              <span className="text-sm text-[#0f172a]">{n.name}</span>
              <span className="text-xs text-[#64748b]">{n.buildingCount} {n.buildingCount === 1 ? "building" : "buildings"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 9.3: Mount on the landlord page**

In `src/app/[city]/landlord/[name]/page.tsx`:

1. Import the new loader and component:
   ```tsx
   import { loadLandlordNeighborhoods } from "./_data";
   import { LandlordNeighborhoods } from "@/components/landlord/LandlordNeighborhoods";
   ```
2. Call the loader alongside other parallel data fetches (find the `Promise.all([...])` block).
3. Render `<LandlordNeighborhoods city={city} neighborhoods={neighborhoods} />` in a sensible spot — typically after the hero block and before the buildings grid.

- [ ] **Step 9.4: Build**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 9.5: Visual verify**

Open a known multi-neighborhood landlord page (any large NYC landlord). Confirm the section renders with neighborhoods sorted by building count.

- [ ] **Step 9.6: Commit**

```bash
git add src/components/landlord/LandlordNeighborhoods.tsx src/app/[city]/landlord/[name]/_data.ts src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(seo): cross-link landlord page to neighborhoods they operate in"
```

---

## Task 10: Cross-link 4.2 — Neighborhood detail → "Top landlords here"

**Files:**
- Create: `src/components/neighborhood/NeighborhoodTopLandlords.tsx`
- Modify: `src/app/[city]/neighborhood/[slug]/page.tsx`

- [ ] **Step 10.1: Inspect existing data fetch in the neighborhood page**

Run: `grep -n "supabase\|createClient\|loadNeighborhood\|zipsForSlug" src/app/[city]/neighborhood/[slug]/page.tsx | head -10`
Find where the neighborhood's ZIPs are determined (the page maps slug→name→zips). Reuse that.

- [ ] **Step 10.2: Add an inline loader (no separate _data.ts here)**

Inside the page component, add a query after the existing data fetches:

```ts
import { createClient } from "@/lib/supabase/server";
// ...

const supabase = await createClient();

// `zips` is the array of ZIP codes for this neighborhood (already computed
// upstream — find the variable name in the existing code).
const { data: landlordRows } = await supabase
  .from("buildings")
  .select("owner_name")
  .in("zip_code", zips)
  .eq("metro", city)
  .not("owner_name", "is", null);

const counts = new Map<string, number>();
for (const r of landlordRows ?? []) {
  const name = r.owner_name as string;
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

// Resolve owner_name → landlord_stats.slug for linking
const topOwnerNames = Array.from(counts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([name]) => name);

const { data: landlordSlugs } = topOwnerNames.length
  ? await supabase.from("landlord_stats").select("name, slug").in("name", topOwnerNames).eq("metro", city)
  : { data: [] };

const topLandlords = (landlordSlugs ?? [])
  .map((l) => ({ name: l.name, slug: l.slug, buildingCount: counts.get(l.name) ?? 0 }))
  .filter((l) => l.slug)
  .sort((a, b) => b.buildingCount - a.buildingCount)
  .slice(0, 10);
```

- [ ] **Step 10.3: Create the component**

```tsx
// src/components/neighborhood/NeighborhoodTopLandlords.tsx
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  landlords: Array<{ slug: string; name: string; buildingCount: number }>;
  neighborhoodName: string;
}

export function NeighborhoodTopLandlords({ city, landlords, neighborhoodName }: Props) {
  if (landlords.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="w-4 h-4 text-[#0d9488]" />
        <h3 className="font-medium text-[#0f172a]">Top landlords in {neighborhoodName}</h3>
      </div>
      <ul className="space-y-1.5">
        {landlords.map((l) => (
          <li key={l.slug}>
            <Link
              href={cityPath(`/landlord/${l.slug}`, city)}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[#f1f5f9]"
            >
              <span className="text-sm text-[#0f172a] truncate">{l.name}</span>
              <span className="text-xs text-[#64748b] ml-3 shrink-0">{l.buildingCount} {l.buildingCount === 1 ? "building" : "buildings"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 10.4: Mount in the neighborhood page**

```tsx
import { NeighborhoodTopLandlords } from "@/components/neighborhood/NeighborhoodTopLandlords";
// ...
<NeighborhoodTopLandlords city={city} landlords={topLandlords} neighborhoodName={displayName} />
```

Place after the rent chart and before any "buildings in this neighborhood" section.

- [ ] **Step 10.5: Build + visual verify**

Run: `npm run build`. Open `/nyc/neighborhood/east-village-10009` (or any high-density NYC neighborhood). Confirm the section renders with a list of landlords by building count.

- [ ] **Step 10.6: Commit**

```bash
git add src/components/neighborhood/NeighborhoodTopLandlords.tsx src/app/[city]/neighborhood/[slug]/page.tsx
git commit -m "feat(seo): cross-link neighborhood page to top landlords"
```

---

## Task 11: Cross-link 4.3 — Tenant-rights topic → "Related tools"

**Files:**
- Modify: `src/lib/tenant-rights-data.ts` (add `TOPIC_RELATED_TOOLS` map)
- Create: `src/components/tenant-rights/RelatedTools.tsx`
- Modify: `src/app/[city]/tenant-rights/[topic]/page.tsx`

- [ ] **Step 11.1: Add `TOPIC_RELATED_TOOLS` to `tenant-rights-data.ts`**

Append this near the bottom of the file (before any default export):

```ts
export const TOPIC_RELATED_TOOLS: Record<string, { templates: string[]; calculators: string[] }> = {
  // NYC topics
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
  "repairs-and-habitability": {
    // LA-equivalent of NYC's repairs-and-maintenance
    templates: ["repair-maintenance-request"],
    calculators: [],
  },
  "rent-stabilization-rights": {
    templates: [],
    calculators: ["fair-rent-engine"],
  },
  "harassment": {
    templates: ["harassment-complaint"],
    calculators: [],
  },
  // LA topics
  "rso-rent-stabilization": {
    templates: [],
    calculators: ["fair-rent-engine"],
  },
  "just-cause-eviction": {
    templates: ["illegal-eviction-response"],
    calculators: [],
  },
};
```

Note: empty arrays mean "no items in that category"; the component will still render the section if the OTHER category has items. If both arrays are empty (like `ellis-act` here), the component returns null.

- [ ] **Step 11.2: Create the component**

```tsx
// src/components/tenant-rights/RelatedTools.tsx
import Link from "next/link";
import { Wrench, Calculator } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { TEMPLATES } from "@/lib/tenant-templates-data";
import { TOPIC_RELATED_TOOLS } from "@/lib/tenant-rights-data";
import type { City } from "@/lib/cities";

const CALCULATOR_LABELS: Record<string, string> = {
  "rent-affordability-calculator": "Rent affordability calculator",
  "rent-timing-calculator": "Rent timing calculator",
  "fair-rent-engine": "Fair rent engine",
};

interface Props {
  city: City;
  topicSlug: string;
}

export function RelatedTools({ city, topicSlug }: Props) {
  const map = TOPIC_RELATED_TOOLS[topicSlug];
  if (!map) return null;
  if (map.templates.length === 0 && map.calculators.length === 0) return null;

  const templateLabels = new Map(TEMPLATES.map((t) => [t.slug, t.title ?? t.slug]));

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <h3 className="font-medium text-[#0f172a] mb-3">Related tools</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {map.templates.map((slug) => (
          <Link
            key={slug}
            href={cityPath(`/tenant-tools/templates/${slug}`, city)}
            className="flex items-start gap-2 rounded border border-[#e2e8f0] px-3 py-2 hover:border-[#0d9488]"
          >
            <Wrench className="w-4 h-4 text-[#0d9488] mt-0.5 shrink-0" />
            <span className="text-sm text-[#0f172a]">{templateLabels.get(slug) ?? slug}</span>
          </Link>
        ))}
        {map.calculators.map((slug) => (
          <Link
            key={slug}
            href={`/${slug}`}
            className="flex items-start gap-2 rounded border border-[#e2e8f0] px-3 py-2 hover:border-[#0d9488]"
          >
            <Calculator className="w-4 h-4 text-[#0d9488] mt-0.5 shrink-0" />
            <span className="text-sm text-[#0f172a]">{CALCULATOR_LABELS[slug] ?? slug}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

Verify the `TEMPLATES[].title` field exists. If the field is named differently (e.g., `name`), adjust.

Run: `grep -E "^\s*(title|name|slug):" src/lib/tenant-templates-data.ts | head -10`
Expected: shows the property name. Use whichever exists.

- [ ] **Step 11.3: Mount on the topic page**

In `src/app/[city]/tenant-rights/[topic]/page.tsx`, after the main topic content, before the breadcrumbs/footer area:

```tsx
import { RelatedTools } from "@/components/tenant-rights/RelatedTools";
// ...
<RelatedTools city={city} topicSlug={topic.slug} />
```

- [ ] **Step 11.4: Build + visual verify**

Run: `npm run build`. Open `/nyc/tenant-rights/security-deposits`. Confirm "Related tools" section shows the security-deposit-demand template card and the rent-affordability-calculator card.

Open `/nyc/tenant-rights/lease-renewals` (which has no mapping). Confirm the section is **not** rendered.

- [ ] **Step 11.5: Commit**

```bash
git add src/lib/tenant-rights-data.ts src/components/tenant-rights/RelatedTools.tsx src/app/[city]/tenant-rights/[topic]/page.tsx
git commit -m "feat(seo): cross-link tenant-rights topics to related templates and calculators"
```

---

## Task 12: Cross-link 4.4 — Calculator pages → "Related guides"

**Files:**
- Create: `src/lib/calculator-related-topics.ts`
- Create: `src/components/calculators/RelatedGuides.tsx`
- Modify: `src/app/rent-affordability-calculator/page.tsx`
- Modify: `src/app/rent-timing-calculator/page.tsx`
- Modify: `src/app/fair-rent-engine/page.tsx`

- [ ] **Step 12.1: Create the inverse mapping**

```ts
// src/lib/calculator-related-topics.ts
// Inverse of TOPIC_RELATED_TOOLS — maps calculator slug to relevant tenant-rights topics.

export const CALCULATOR_RELATED_TOPICS: Record<string, Array<{ city: string; slug: string; label: string }>> = {
  "rent-affordability-calculator": [
    { city: "nyc", slug: "security-deposits", label: "Security deposits" },
    { city: "nyc", slug: "rent-stabilization-rights", label: "Rent stabilization in NYC" },
    { city: "los-angeles", slug: "rso-rent-stabilization", label: "Rent stabilization in LA" },
  ],
  "rent-timing-calculator": [
    { city: "nyc", slug: "lease-renewals", label: "Lease renewals" },
    { city: "nyc", slug: "eviction-protections", label: "Eviction protections" },
  ],
  "fair-rent-engine": [
    { city: "nyc", slug: "rent-stabilization-rights", label: "Rent stabilization in NYC" },
    { city: "los-angeles", slug: "rso-rent-stabilization", label: "Rent stabilization in LA" },
    { city: "nyc", slug: "harassment", label: "Tenant harassment" },
  ],
};
```

- [ ] **Step 12.2: Create the component**

```tsx
// src/components/calculators/RelatedGuides.tsx
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { CALCULATOR_RELATED_TOPICS } from "@/lib/calculator-related-topics";
import type { City } from "@/lib/cities";

interface Props {
  calculatorSlug: keyof typeof CALCULATOR_RELATED_TOPICS;
}

export function RelatedGuides({ calculatorSlug }: Props) {
  const topics = CALCULATOR_RELATED_TOPICS[calculatorSlug];
  if (!topics || topics.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 border-t border-[#e2e8f0] mt-12">
      <h3 className="font-medium text-[#0f172a] mb-3">Related guides</h3>
      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={`${t.city}/${t.slug}`}>
            <Link
              href={cityPath(`/tenant-rights/${t.slug}`, t.city as City)}
              className="flex items-center gap-2 text-sm text-[#0f172a] hover:text-[#0d9488]"
            >
              <ScrollText className="w-4 h-4 text-[#0d9488]" />
              <span>{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 12.3: Mount on each calculator page**

In each of the three calculator pages, add (near the bottom, before any global footer):

```tsx
import { RelatedGuides } from "@/components/calculators/RelatedGuides";
// ...
<RelatedGuides calculatorSlug="rent-affordability-calculator" /> {/* or the matching slug per file */}
```

- [ ] **Step 12.4: Build + visual verify**

Run: `npm run build`. Open `/rent-affordability-calculator`. Confirm "Related guides" section renders 3 links.

- [ ] **Step 12.5: Commit**

```bash
git add src/lib/calculator-related-topics.ts src/components/calculators/RelatedGuides.tsx src/app/rent-affordability-calculator/page.tsx src/app/rent-timing-calculator/page.tsx src/app/fair-rent-engine/page.tsx
git commit -m "feat(seo): add Related guides cross-links from calculators to tenant-rights topics"
```

---

## Task 13: Cross-link 4.5 — Building-list chip page → other chips

**Files:**
- Create: `src/components/building-list/PeerChips.tsx`
- Modify: `src/app/[city]/building-list/[chip]/page.tsx`

- [ ] **Step 13.1: Create the component**

```tsx
// src/components/building-list/PeerChips.tsx
import Link from "next/link";
import { cityPath } from "@/lib/seo";
import { chipsForCity, type ChipId } from "@/lib/building-list/chips";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  currentChip: ChipId;
}

export function PeerChips({ city, currentChip }: Props) {
  const peers = chipsForCity(city).filter((c) => c.id !== currentChip);
  if (peers.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 border-t border-[#e2e8f0] mt-8">
      <h3 className="text-sm font-medium text-[#64748b] mb-3 uppercase tracking-wide">Browse by other criteria</h3>
      <div className="flex flex-wrap gap-2">
        {peers.map((c) => (
          <Link
            key={c.id}
            href={cityPath(`/building-list/${c.slug}`, city)}
            className="inline-flex items-center rounded-full border border-[#e2e8f0] px-3 py-1.5 text-sm text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            {c.label ?? c.id}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

Verify `chipsForCity` returns objects with `id`, `slug`, and `label` (or `title`). If the property is named differently, adjust.

Run: `grep -A 5 "export interface Chip\b" src/lib/building-list/chips.ts`
Expected: shows the Chip interface — use the actual property names.

- [ ] **Step 13.2: Mount on the chip page**

In `src/app/[city]/building-list/[chip]/page.tsx`, near the bottom of the page JSX:

```tsx
import { PeerChips } from "@/components/building-list/PeerChips";
// ...
<PeerChips city={city} currentChip={chip} />
```

- [ ] **Step 13.3: Build + visual verify**

Run: `npm run build`. Open `/nyc/building-list/top-rated`. Confirm a "Browse by other criteria" strip renders the 4 other chips, none of which point back to top-rated.

- [ ] **Step 13.4: Commit**

```bash
git add src/components/building-list/PeerChips.tsx src/app/[city]/building-list/[chip]/page.tsx
git commit -m "feat(seo): cross-link building-list chips to peer chips"
```

---

## Task 14: Standardize Breadcrumbs on `/landlord/[name]/reviews`

**Files:**
- Modify: `src/app/[city]/landlord/[name]/reviews/page.tsx`

- [ ] **Step 14.1: Inspect current state**

Run: `grep -nE "Breadcrumbs|ArrowLeft|← " src/app/[city]/landlord/[name]/reviews/page.tsx`
Expected: only a `← Back to {displayName}` text link, no Breadcrumbs.

- [ ] **Step 14.2: Reference the gold-standard pattern**

Look at `src/app/[city]/building/[borough]/[slug]/reviews/page.tsx` lines 142–158 for the canonical pattern:
- Build a `breadcrumbs` array using `cityBreadcrumbs(city, ...)` from `@/lib/seo`
- Render `<Breadcrumbs items={breadcrumbs} />` (already includes JSON-LD)
- Render an `ArrowLeft` link below pointing to the parent page

- [ ] **Step 14.3: Apply the pattern**

Add imports at the top:
```tsx
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cityBreadcrumbs } from "@/lib/seo";
```

Build the breadcrumbs array (adapt city/landlord context):
```tsx
const breadcrumbs = [
  ...cityBreadcrumbs(city, { includeLandlords: true }), // adjust per cityBreadcrumbs signature
  { label: displayName, href: cityPath(`/landlord/${slug}`, city) },
  { label: "Reviews", href: cityPath(`/landlord/${slug}/reviews`, city) },
];
```

Confirm the `cityBreadcrumbs` signature first:
Run: `grep -A 20 "export function cityBreadcrumbs" src/lib/seo.ts`

In the JSX, replace the existing `← Back to {displayName}` link with:
```tsx
<Breadcrumbs items={breadcrumbs} />
<Link
  href={cityPath(`/landlord/${slug}`, city)}
  className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#0f172a] mt-2"
>
  <ArrowLeft className="w-4 h-4" />
  Back to {displayName}
</Link>
```

- [ ] **Step 14.4: Build + visual verify**

Run: `npm run build`. Open a landlord reviews page (e.g., `/nyc/landlord/<slug>/reviews`). Confirm:
- Breadcrumbs render at the top (with chevrons between items)
- ArrowLeft link is present
- No double "back" navigation

- [ ] **Step 14.5: Validate JSON-LD**

In dev tools "Elements" tab, search for `<script type="application/ld+json">` and confirm a `BreadcrumbList` schema is present with the page's breadcrumb hierarchy.

- [ ] **Step 14.6: Commit**

```bash
git add src/app/[city]/landlord/[name]/reviews/page.tsx
git commit -m "feat(seo): standardize Breadcrumbs on landlord reviews subpage"
```

---

## Task 15: Standardize Breadcrumbs on `/landlord/[name]/buildings`

**Files:**
- Modify: `src/app/[city]/landlord/[name]/buildings/page.tsx`

- [ ] **Step 15.1: Apply the same pattern as Task 14**

Repeat steps 14.1–14.3 for this page, with `breadcrumbs` ending in `{ label: "Buildings", href: cityPath(`/landlord/${slug}/buildings`, city) }`.

- [ ] **Step 15.2: Build + visual verify + JSON-LD check**

Same as steps 14.4–14.5.

- [ ] **Step 15.3: Commit**

```bash
git add src/app/[city]/landlord/[name]/buildings/page.tsx
git commit -m "feat(seo): standardize Breadcrumbs on landlord buildings subpage"
```

---

## Task 16: Final verification suite

- [ ] **Step 16.1: Run a full sitemap regen and validate counts**

```bash
node scripts/generate-sitemaps.mjs 2>&1 | tail -20
grep -c "<url>" public/sitemap/hubs.xml
xmllint --noout public/sitemap/*.xml && echo "All sitemap files are well-formed"
```
Expected: hubs.xml URL count ≥ 400; xmllint exits silently.

- [ ] **Step 16.2: Verify index.xml ordering**

```bash
grep "<loc>" public/sitemap/index.xml | head -5
grep "<loc>" public/sitemap/index.xml | tail -3
```
Expected: top entries reference `b-*.xml`; last entry references `hubs.xml`.

- [ ] **Step 16.3: Smoke-test 5 hub URLs from production**

```bash
for url in \
  "https://lucidrents.com/nyc/tenant-tools" \
  "https://lucidrents.com/nyc/tenant-rights/security-deposits" \
  "https://lucidrents.com/nyc/rents/east-village-10009" \
  "https://lucidrents.com/CA/Los-Angeles/ellis-act" \
  "https://lucidrents.com/rent-affordability-calculator"; do
  echo "$url $(curl -s -o /dev/null -w '%{http_code}' "$url")"
done
```
Expected: all 200. (Note: this verifies production URLs; locally-changed components only render after deploy.)

- [ ] **Step 16.4: Build the project end-to-end**

```bash
npm run build 2>&1 | tail -40
```
Expected: build succeeds; no type errors.

- [ ] **Step 16.5: Manual UI smoke (dev server)**

Start `npm run dev`. Visit:
- `/nyc` — Tools & Resources card grid renders (5 cards)
- `/CA/Los-Angeles` — Tools & Resources renders (6 cards including Ellis Act)
- Footer — Resources column visible on every page
- `/nyc/neighborhoods` — each neighborhood entry has a "Rent data →" link
- `/nyc/landlord/<slug>` — "Neighborhoods we operate in" section appears for a multi-neighborhood landlord
- `/nyc/neighborhood/east-village-10009` — "Top landlords here" section appears
- `/nyc/tenant-rights/security-deposits` — "Related tools" section appears
- `/rent-affordability-calculator` — "Related guides" section at the bottom
- `/nyc/building-list/top-rated` — "Browse by other criteria" strip with the other 4 chips
- `/nyc/landlord/<slug>/reviews` — Breadcrumbs at top + ArrowLeft below
- `/nyc/landlord/<slug>/buildings` — Breadcrumbs at top + ArrowLeft below

- [ ] **Step 16.6: JSON-LD breadcrumb validation**

In DevTools Elements panel, on each of the two landlord subpages, confirm a `<script type="application/ld+json">` containing `"@type": "BreadcrumbList"` is present.

(Optional) Paste each URL into [Google Rich Results Test](https://search.google.com/test/rich-results) after deploy.

- [ ] **Step 16.7: Commit verification artifacts (if any)**

If verification surfaced fixes, commit them now. If everything passed, no commit needed.

---

## Task 17: Open the PR

- [ ] **Step 17.1: Push the branch**

```bash
git push -u origin claude/affectionate-nightingale-fc51fb
```

- [ ] **Step 17.2: Create the PR**

```bash
gh pr create --title "feat(seo): sitemap optimization & internal linking — Phase 1" --body "$(cat <<'EOF'
## Summary

- Adds `public/sitemap/hubs.xml` with ~454 net-new hub URLs (tenant tools, tenant-rights topics, neighborhoods, rents-by-neighborhood, building-list, calculators, etc.)
- Reorders `index.xml` so `b-*.xml` and `l-*.xml` precede `0.xml` and the new `hubs.xml` (only "priority signal" Google weakly honors — protects crawl budget for the 1.4M+ buildings still being discovered)
- Adds Tools & Resources card grid to city hub, Resources column to footer, Rent-data links on the Neighborhoods hub
- 5 new cross-link patterns for topical clusters: landlord↔neighborhoods, neighborhood↔landlords, topic↔tools, calculator↔guides, chip↔chips
- Standardizes Breadcrumbs + ArrowLeft pattern on the two landlord subpages that lacked it (gains JSON-LD `BreadcrumbList` schema)

Phase 2 (deferred ~2–3 months) will add per-entity subpage sitemap entries (~1.0–1.4M URLs) once existing buildings/landlords are fully indexed.

## Test plan

- [ ] `node scripts/generate-sitemaps.mjs` produces `hubs.xml` with ≥400 URLs
- [ ] `xmllint` validates all sitemap files
- [ ] `index.xml` lists `b-*` first and `hubs.xml` last
- [ ] `npm run build` passes
- [ ] Manual UI smoke: every cross-link section renders on the expected page
- [ ] Both landlord subpages have Breadcrumbs and JSON-LD schema
- [ ] After deploy: POST `/api/seo/submit-sitemaps` to re-submit to Search Console; manually submit `https://lucidrents.com/sitemap/hubs.xml`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 17.3: Post-deploy actions**

After the PR merges and Vercel deploys:

```bash
# Re-submit existing sitemaps to Google
curl -X POST https://lucidrents.com/api/seo/submit-sitemaps

# Manually submit the new hubs.xml in Google Search Console:
# https://search.google.com/search-console/sitemaps → Add sitemap →
#   https://lucidrents.com/sitemap/hubs.xml
```

Monitor Search Console "Pages → Indexed" over 2–4 weeks for net-new indexed URLs from `hubs.xml`.

---

## Out of scope (Phase 2)

Per the spec, deferred to a follow-up PR ~2–3 months after this lands:

- Building `/reviews` URLs in `b-N.xml` (conditional: `review_count >= 1`, ~38,709)
- Building `/violations` URLs (conditional: `violation_count >= 1`, ~500K–1M)
- Landlord `/buildings` URLs (gated to landlords with ≥3 buildings, ~50–100K)
- Landlord `/reviews` URLs (conditional, ~10K–30K)
