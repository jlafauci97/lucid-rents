# Walk Score Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add official Walk Score, Transit Score, and Bike Score to every building page across all 5 cities. Store scores per-building (cached) and render alongside the existing `WalkabilityScore` component (which today computes an *internal* transit score from OSM transit stops).

**Key decision:** Keep the existing internal `WalkabilityScore` component as a fallback/complement — don't delete it. The official Walk Score API has rate limits and costs; the internal score remains useful when the API is unavailable or when we want building-level density signals the API doesn't provide.

**Architecture:** Three pieces — (1) persist scores in a new `building_scores` table keyed by `(building_id, source)`, (2) a backfill script that paginates through all buildings with coordinates and calls the Walk Score API with polite rate limiting, (3) a new `WalkScoreBadge` component rendered next to the existing walkability section.

**Tech Stack:** Node.js (mjs scripts), TypeScript (Next.js), Supabase JS client, PostgreSQL, Walk Score API (https://www.walkscore.com/professional/api.php).

---

## File Structure

### Database (new)
- `supabase/migrations/20260410400000_building_scores.sql` — `building_scores` table with `(building_id, source, score, description, metadata_json, fetched_at)` and unique `(building_id, source)` constraint. `source` is an enum: `walk`, `transit`, `bike`.

### Scripts (new)
- `scripts/backfill-walk-scores.mjs` — Paginates buildings with `latitude IS NOT NULL` and no fresh Walk Score record (or `fetched_at < now() - interval '180 days'`), calls the Walk Score API, inserts. Respects rate limit (default: 5000/day on the free tier, paid plans higher). Idempotent.

### Code (new)
- `src/lib/scores/walkScore.ts` — Typed client wrapper. Exports `fetchWalkScore({ lat, lng, address })` returning `{ walk, transit, bike }`.
- `src/components/building/WalkScoreBadge.tsx` — Compact 3-badge display. Hydrated at render time from the `building_scores` table.

### Code (modify)
- `src/app/[city]/building/[borough]/[slug]/page.tsx` — Fetch scores alongside other building data, pass to `WalkScoreBadge`. Render above or next to `<WalkabilityScore>`.
- `src/components/building/WalkabilityScore.tsx` — Label the internal score as "Transit density (Lucid index)" so users don't confuse it with the official Transit Score.
- `next.config.ts` — Add `WALKSCORE_API_KEY` to env schema if one exists, otherwise surface via `process.env`.
- `.env.example` (or equivalent) — Document `WALKSCORE_API_KEY=...`.

### API (new)
- `src/app/api/scores/walk/route.ts` — On-demand endpoint for buildings whose score isn't yet cached (lazy backfill). POST body: `{ buildingId }`. Rate-limited per IP.

---

## Task 1: Database Schema

**Files:**
- New: `supabase/migrations/20260410400000_building_scores.sql`

- [ ] **Step 1: Define the table**

```sql
create table building_scores (
  id bigserial primary key,
  building_id bigint not null references buildings(id) on delete cascade,
  source text not null,             -- 'walk' | 'transit' | 'bike'
  score numeric not null,
  description text,                 -- API returns "Very Walkable", etc.
  metadata jsonb,                   -- full API response for debugging
  fetched_at timestamptz not null default now(),
  unique(building_id, source)
);

create index building_scores_building_idx on building_scores (building_id);
create index building_scores_stale_idx on building_scores (fetched_at)
  where fetched_at < now() - interval '180 days';
```

- [ ] **Step 2: Add a convenience view**

```sql
create or replace view v_building_scores as
select
  building_id,
  max(score) filter (where source = 'walk')    as walk_score,
  max(score) filter (where source = 'transit') as transit_score,
  max(score) filter (where source = 'bike')    as bike_score,
  max(fetched_at) as fetched_at
from building_scores
group by building_id;
```

---

## Task 2: Walk Score API Client

**Files:**
- New: `src/lib/scores/walkScore.ts`

- [ ] **Step 1: Environment setup**

Add `WALKSCORE_API_KEY` to env. Document the fact that a single key is used server-side only (never expose). Add it to `.env.example`.

- [ ] **Step 2: Implement the client**

```ts
export type WalkScoreResult = {
  walk: number | null;
  walkDescription: string | null;
  transit: number | null;
  transitDescription: string | null;
  bike: number | null;
  raw: unknown;
};

export async function fetchWalkScore(args: {
  lat: number;
  lng: number;
  address: string;
}): Promise<WalkScoreResult | null> { ... }
```

Endpoint: `https://api.walkscore.com/score?format=json&lat=...&lon=...&address=...&transit=1&bike=1&wsapikey=...`

Handle these statuses: `1` (OK), `2` (score in progress — retry once after 2s), `30` (invalid lat/lng), `40` (invalid API key), `41` (daily quota exceeded — return null, don't throw), `42` (IP blocked). Log quota exhaustion loudly.

- [ ] **Step 3: Unit-test the parser**

Pin a real API response fixture and assert parsing is stable.

---

## Task 3: Backfill Script

**Files:**
- New: `scripts/backfill-walk-scores.mjs`

- [ ] **Step 1: Build the pager**

Query: `select id, full_address, latitude, longitude, metro from buildings where latitude is not null and id not in (select building_id from building_scores where source='walk') order by metro, id limit 500`.

- [ ] **Step 2: Apply rate limiting**

Default cap: 4000 calls/day (buffer under the 5000 free-tier limit). Configurable via `--daily-cap` flag. Use a simple in-memory sleep between calls (`3000ms` default = 1200/hour = safely under limit).

- [ ] **Step 3: Insert results**

For each score returned, insert three rows (`walk`, `transit`, `bike`). Skip any where the API returned null.

- [ ] **Step 4: Checkpoint and resume**

Write last-processed `building_id` to a local file (`.walkscore-checkpoint`) so the script can resume after quota exhaustion.

- [ ] **Step 5: Run across all metros**

Expect NYC to saturate the daily budget for multiple days. Prioritize cities with live SEO traffic first: LA, NYC, then Chicago/Miami/Houston.

---

## Task 4: On-Demand API Route

**Files:**
- New: `src/app/api/scores/walk/route.ts`

- [ ] **Step 1: Implement POST handler**

Body: `{ buildingId: number }`. Fetch building lat/lng. If a fresh cached row exists (<180d), return it. Otherwise call `fetchWalkScore()`, insert, return.

- [ ] **Step 2: Rate-limit per IP**

Use the existing rate-limit middleware (check `src/lib/` for a helper first). 10 req/min/IP is plenty.

- [ ] **Step 3: Deny-list metros with zero Walk Score coverage**

Walk Score has dense coverage in all 5 target cities, so this is probably unnecessary — but add a guard in case the API returns "coverage unavailable."

---

## Task 5: Building Page Display

**Files:**
- New: `src/components/building/WalkScoreBadge.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`
- Modify: `src/components/building/WalkabilityScore.tsx`

- [ ] **Step 1: Build `WalkScoreBadge`**

Three badges in a row:
- 🚶 Walk Score: `{score}` with color ramp (90+ green, 70+ teal, 50+ amber, <50 red)
- 🚇 Transit Score: same ramp
- 🚴 Bike Score: same ramp

Each badge clickable → opens a popover with the API's plain-language description ("Very Walkable — most errands can be accomplished on foot").

Include a "powered by Walk Score" attribution link (required by their TOS).

- [ ] **Step 2: Fetch in the page**

Server-side: query `v_building_scores` when fetching the building. Pass to `<WalkScoreBadge>`. If the building has no cached scores, fire the on-demand endpoint from the client on mount (don't block SSR).

- [ ] **Step 3: Relabel the existing component**

Change `WalkabilityScore`'s title from "Walkability & Transit" to "Nearby Transit (detailed)". This makes the distinction clear: Walk Score is the headline badge, the existing component is the detailed per-stop breakdown.

---

## Task 6: Monitoring

**Files:**
- Modify: `src/app/profile/mission-control/page.tsx`

- [ ] **Step 1: Add a "Walk Score Coverage" panel**

Query: `select metro, count(*) filter (where walk_score is not null) as covered, count(*) as total from buildings b left join v_building_scores s on s.building_id = b.id group by metro`.

Show a progress bar per metro. Surface the freshness of the oldest cached row (`min(fetched_at)`).

---

## Done When

- `WALKSCORE_API_KEY` is set in production
- ≥80% of buildings with coordinates in each metro have a cached Walk Score
- A building page renders the 3-badge `WalkScoreBadge` above the existing walkability section
- On-demand endpoint lazy-populates a brand-new building within 2 seconds of page load
- Mission Control shows a "Walk Score Coverage" panel
- Walk Score attribution link is visible on every building page (TOS requirement)
