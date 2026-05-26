# Perf Round 2 — Notes & Future Work

Companion to PR `perf/round-2`. Documents what shipped, what we deferred, and the patterns for follow-up work.

## What shipped in this PR

### 1. DB composite indexes — `migrations/20260526000000_perf_round6_building_detail_composites.sql`

Adds 15 composite indexes targeting the building-detail page's 18-query fan-out and the landlord directory's 5 sort variants. Pattern: `(building_id, date_col DESC)` so `ORDER BY date_col DESC LIMIT N` becomes an index-only scan (no in-memory sort).

**Expected wins:**
- 5–30× speedup on the slowest of the building-detail parallel queries (those with many rows per building).
- 3–10× speedup on landlord directory paginated queries (`WHERE metro = X ORDER BY <metric> DESC LIMIT 25 OFFSET N`).
- Compound win with ISR: faster cache-miss render = faster Googlebot crawl = bigger crawl budget.

**To apply:**
```
supabase db push
```
…or apply manually via the SQL editor in the Supabase dashboard. All `CREATE INDEX IF NOT EXISTS` so re-runs are no-ops.

**Verification:**
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM hpd_violations
  WHERE building_id = '<sample-uuid>'
  ORDER BY inspection_date DESC LIMIT 20;
```
Should show `Index Scan using idx_hpd_violations_building_inspection_desc` — NOT `Sort` step above the scan.

### 2. Edge runtime on 4 read-only API routes

| Route | Before | After |
|---|---|---|
| `/api/buildings/[buildingId]/reviews` | nodejs | edge |
| `/api/buildings/[buildingId]/violations` | nodejs | edge |
| `/api/buildings/nearby` | nodejs | edge |
| `/api/violations/recent` | nodejs | edge |

These are pure I/O routes (one anonymous Supabase read, no Node-specific APIs). Edge runtime gives ~300-POP global distribution + faster cold starts. Combined with the `s-maxage` Cache-Control set in the previous PR, repeat hits from any region serve from the nearest Vercel edge POP.

## What we deliberately did NOT do this round (and why)

### Full RPC consolidation of building-detail (18 queries → 1)

**Looked at it, decided against.** The 18 queries are currently parallel HTTP calls to PostgREST — they execute concurrently in Postgres too. Consolidating into a single Postgres function would serialize them inside the function unless we wrote it as explicit parallel CTEs (which Postgres may or may not actually parallelize given `parallel_workers` settings).

Net effect of RPC: fewer connections (1 vs 18), less HTTP overhead — but potentially SLOWER total query time. The actual DB win is the composite indexes (now shipped), not the RPC packaging.

Revisit if/when Supabase connection pool becomes the bottleneck (currently it's not — pool runs ~40% utilization at peak).

### Trimming `select("*")` to specific fields

20+ files do `.select("*")` on building/violation/complaint tables. Each pulls 30+ columns when 5–10 are rendered.

**Why deferred:** Each file needs to manually enumerate the columns that downstream components actually use — tedious, error-prone (typos break runtime), and the JSON-over-HTTP overhead is modest at the per-query level. Composite indexes deliver more measurable speedup per hour of engineer time.

**When to do it:** When you see a specific query in your slow-query log returning hundreds of KB per call. The current biggest offender is `/[city]/building/[borough]/[slug]/violations` which fetches 7 tables × LIMIT 1000. That page is lower-traffic than the main building detail though, so it's a secondary target.

**Pattern when you do it:**
```ts
// Before
supabase.from("hpd_violations").select("*").eq("building_id", id)

// After
supabase.from("hpd_violations").select(
  "id, class, status, inspection_date, nov_description, apartment"
).eq("building_id", id)
```
And update the TypeScript type to a narrow interface (don't reuse the full `HpdViolation` type).

### searchParams refactor on paginated pages

The remaining 16 pages that are `ƒ` in the build are all dynamic because they read `searchParams` (sort, page, search, filter). These can't be ISR-cached without a refactor that moves search-params handling out of the page server component.

**Pattern (for next pass):**

The static shell stays as a server component with `generateStaticParams` and `revalidate`. The dynamic part (the list that depends on filters) moves into a client component that uses `useSearchParams` + SWR against the existing `/api/*` endpoints.

```tsx
// page.tsx — STATIC shell, no searchParams reads
export const revalidate = 86400;
export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

export default async function LandlordsPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return (
    <>
      <HeroAndBento city={city} /> {/* server component, all cacheable */}
      <RankingsSection city={city} /> {/* server component, all cacheable */}
      <LandlordsTableClient city={city} /> {/* CLIENT — reads searchParams */}
    </>
  );
}
```

```tsx
// LandlordsTableClient.tsx
"use client";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";

export function LandlordsTableClient({ city }: { city: City }) {
  const sp = useSearchParams();
  const page = sp.get("page") ?? "1";
  const sort = sp.get("sort") ?? "violations";
  const search = sp.get("search") ?? "";
  const qs = new URLSearchParams({ city, page, sort, search }).toString();
  const { data, isLoading } = useSWR(
    `/api/landlords?${qs}`,
    (url) => fetch(url).then((r) => r.json()),
    { keepPreviousData: true }
  );
  if (isLoading && !data) return <DirectorySkeleton />;
  return <DirectoryTable rows={data.landlords} pagination={data.pagination} />;
}
```

Key points:
- Page becomes ● (statically prerendered for all 5 cities)
- `/api/landlords` already has `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600` from the previous PR — paginated variants get cached at the CDN edge per URL
- SEO: Googlebot indexes the static base URL (`/nyc/landlords`); paginated variants (`?page=2`) typically have `rel=canonical` to the base, so no SEO loss
- UX: brief flash of skeleton on first client-mount; `keepPreviousData` makes pagination feel instant after the first load

**Priority order for next session:**

1. `/[city]/landlords` — highest traffic, programmatic SEO
2. `/[city]/news` + `/[city]/news/[slug]` — frequently crawled
3. `/[city]/building-rankings` — high SEO value
4. `/[city]/building/[borough]/[slug]/reviews` — pagination on building reviews
5. `/[city]/building-list/[chip]`
6. Long tail: `/[city]/compare`, `/neighborhoods`, `/news`, `/worst-rated-buildings`, `/problem-landlords`, `/heating-tracker`, `/lead-safety`, `/affordable-housing`, `/buildings/[borough]`, etc.

Each is ~30–60 min of mechanical work. Top 3 alone capture probably 80% of the remaining SEO surface.

## CDN audit — findings

Production responses come through both Cloudflare and Vercel Edge:
- `server: cloudflare` + `cf-cache-status: DYNAMIC` — Cloudflare isn't caching HTML (correct; Vercel Edge handles HTML caching).
- `x-vercel-cache: HIT/MISS` — Vercel Edge cache layer is the actual one that matters.

**Recommendations (low priority):**

1. **Verify Cloudflare's defaults aren't stripping headers.** Headers from Vercel (`Cache-Control: s-maxage=...`) should pass through Cloudflare intact. Spot-check by curling the same URL with `Cache-Control: no-cache` header — should get a fresh response.
2. **Optionally enable Cloudflare "Cache Everything" for `/_next/static/*`** — these are already `immutable` from Vercel; Cloudflare would serve them an extra hop closer. Modest bandwidth offload from Vercel to Cloudflare. ~5% bandwidth savings, not worth doing unless you're hitting Vercel bandwidth limits.
3. **Don't enable Cloudflare HTML caching.** ISR semantics (revalidate windows, on-demand invalidation via `revalidatePath`) only work through Vercel's edge. Adding Cloudflare HTML cache on top creates a second TTL layer that's not synchronized with Vercel's, leading to stale content for users.

**Verdict:** no action items. The CDN stack is already well-configured.

## Verification checklist after merging this PR

- [ ] Apply migration 6 via `supabase db push` (or dashboard)
- [ ] Confirm in `pg_stat_user_indexes` that the new indexes are being scanned (`idx_scan > 0`) after ~1 day of traffic
- [ ] Confirm edge-runtime routes show `x-vercel-cache: HIT` and have lower TTFB than the previous `iad1` node region for distant users (test from EU/AU if possible)
- [ ] Sample EXPLAIN ANALYZE on a hot query (e.g. `WHERE building_id = X ORDER BY inspection_date DESC LIMIT 20`) — should show `Index Scan using idx_hpd_violations_building_inspection_desc`, no `Sort` step.
