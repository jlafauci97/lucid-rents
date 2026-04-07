# Performance Hardening Design

**Date:** 2026-04-07
**Status:** Approved

## Problem

The site has 2.2M buildings across 5 metros on Supabase (Postgres). A single slow query can saturate the connection pool (42/42 active), cascading into a site-wide outage. On 2026-04-07, a 10-hour linking UPDATE triggered autovacuum on a 13GB table, which saturated IO, which caused every query to queue, taking down search, building pages, and the homepage for hours.

Root causes identified:
- No connection pooling — direct Postgres connections from serverless functions
- `get_neighborhood_median_rents` RPC runs a heavy join on every building page, takes 30-60s under load
- No statement timeout — queries hold connections indefinitely
- No bot filtering — bots inflate page load count, amplifying DB pressure
- `complaints_311` table is 23M rows / 13GB with no partitioning

## Architecture: 5 Layers of Defense

### Layer 1: PgBouncer Connection Pooling (P0)

Switch all Supabase client configurations to use the pooled connection string (port 6543 via PgBouncer) instead of direct connections (port 5432). PgBouncer queues requests at the pooler level instead of opening a new Postgres connection per serverless function invocation.

**Files to change:**
- `src/lib/supabase/server.ts` — use pooled URL
- `src/lib/supabase/client.ts` — already client-side, no change needed
- `src/lib/supabase/admin.ts` — use pooled URL
- `.env.local` / Vercel env vars — add `SUPABASE_POOLED_URL` if needed

**Constraint:** Supabase JS SDK uses the REST API (PostgREST), not direct Postgres connections. The pooling benefit applies to any direct `pg` connections or edge functions using `postgres://` connection strings. The REST API goes through Supabase's own connection pooler. Verify which connection method each client uses before changing.

### Layer 2: Materialized Views (P0)

Pre-compute expensive per-request data into materialized views, refreshed on a schedule.

#### mv_neighborhood_median_rents

Replaces the `get_neighborhood_median_rents` RPC that caused the 2026-04-07 meltdown.

```sql
CREATE MATERIALIZED VIEW mv_neighborhood_median_rents AS
SELECT
  b.zip_code,
  br.bedrooms,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY br.median_rent)::numeric AS median_rent
FROM building_rents br
JOIN buildings b ON b.id = br.building_id
WHERE br.median_rent > 0 AND b.zip_code IS NOT NULL
GROUP BY b.zip_code, br.bedrooms;

CREATE UNIQUE INDEX ON mv_neighborhood_median_rents (zip_code, bedrooms);
```

**RPC replacement:** Rewrite `get_neighborhood_median_rents` to read from the materialized view instead of computing on the fly. The `p_exclude_building` parameter can be dropped since the median across hundreds of buildings barely changes when excluding one.

**Refresh:** Vercel cron every 6 hours via `/api/cron/refresh-stats` (extend existing endpoint).

#### mv_building_violation_summary

Pre-compute violation counts by category and year for building timeline pages.

```sql
CREATE MATERIALIZED VIEW mv_building_violation_summary AS
SELECT
  building_id,
  extract(year FROM violation_date)::int AS year,
  count(*) AS violation_count
FROM hpd_violations
WHERE building_id IS NOT NULL
GROUP BY building_id, extract(year FROM violation_date);

CREATE UNIQUE INDEX ON mv_building_violation_summary (building_id, year);
```

### Layer 3: Bot Management Middleware (P1)

Add bot detection to the existing proxy/middleware. Block known bad bots before they hit serverless functions.

**Block list (User-Agent substrings):**
- AhrefsBot, SemrushBot, MJ12bot, DotBot, BLEXBot, PetalBot, YandexBot
- Generic crawlers: Go-http-client, python-requests, curl/, wget/
- AI scrapers: GPTBot, CCBot, anthropic-ai, Claude-Web

**Allow list:**
- Googlebot, Bingbot, DuckDuckBot, Slurp (Yahoo)
- Social: facebookexternalhit, Twitterbot, LinkedInBot
- Monitoring: UptimeRobot, Pingdom

**Implementation:** Add to existing `middleware.ts` or `proxy.ts`. Return 403 for blocked bots before any route handling.

### Layer 4: Table Partitioning (P2)

Partition `complaints_311` (23M rows, 13GB) by `metro`. Most queries already filter by metro, so Postgres can skip 4/5 partitions.

```sql
-- Create partitioned table
CREATE TABLE complaints_311_partitioned (LIKE complaints_311 INCLUDING ALL)
PARTITION BY LIST (metro);

CREATE TABLE complaints_311_nyc PARTITION OF complaints_311_partitioned FOR VALUES IN ('nyc');
CREATE TABLE complaints_311_la PARTITION OF complaints_311_partitioned FOR VALUES IN ('los-angeles');
CREATE TABLE complaints_311_chicago PARTITION OF complaints_311_partitioned FOR VALUES IN ('chicago');
CREATE TABLE complaints_311_miami PARTITION OF complaints_311_partitioned FOR VALUES IN ('miami');
CREATE TABLE complaints_311_houston PARTITION OF complaints_311_partitioned FOR VALUES IN ('houston');
```

**Migration strategy:** Create new partitioned table, copy data in batches during off-peak, swap table names in a transaction. Must be done carefully to avoid downtime.

### Layer 5: Vercel KV for Hot Data (P2)

Cache frequently-accessed, slowly-changing data at the edge.

**Candidates:**
- Trending buildings per city (homepage) — key: `trending:{city}`, TTL: 1 hour
- Borough stats (city landing pages) — key: `borough-stats:{city}`, TTL: 6 hours
- Common search autocomplete results — key: `search:{city}:{query}`, TTL: 5 minutes

**Implementation:** Add `@vercel/kv` dependency. Create a `src/lib/kv-cache.ts` helper with get/set/invalidate. Wrap existing data fetches with cache-first logic.

## Statement Timeout (Already Applied)

As an emergency measure during the 2026-04-07 incident:
- `ALTER DATABASE postgres SET statement_timeout = '5s'` — all queries
- `ALTER ROLE postgres SET statement_timeout = '30s'` — admin/cron queries
- `ALTER ROLE authenticator SET statement_timeout = '5s'` — app queries

These should remain in place permanently. The 5s timeout for app queries ensures no single request can hold a connection for more than 5 seconds, preventing pool saturation.

## What We're NOT Doing

- **Neon/PlanetScale migration** — Supabase is fine with proper pooling
- **Turborepo** — single app, no benefit
- **pg_cron** — Vercel crons already handle scheduling
- **Cloudflare CDN** — ISR + SWR headers already handle caching
- **Supabase Edge Functions** — network hop isn't the bottleneck

## Implementation Order

1. PgBouncer connection pooling (~30 min)
2. Materialized views + cron refresh (~2-3 hours)
3. Bot middleware (~1 hour)
4. Table partitioning (~2-3 hours, off-peak)
5. Vercel KV (~2-3 hours)
