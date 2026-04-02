# Hybrid Cron Migration: Vercel Triggers + Supabase Edge Functions

**Date**: 2026-04-02
**Status**: Draft
**Goal**: Reduce Vercel function execution costs by ~95% by moving heavy cron work to Supabase Edge Functions while keeping Vercel's cron scheduler.

## Problem

54 Vercel cron jobs run daily, many executing for 60-300 seconds each. At mid-cycle the Vercel bill is $90 (tracking toward ~$180/month), with $160+ in overage above the $20 Pro baseline. The cron jobs are the primary cost driver — they account for the vast majority of function execution time.

## Decision: Hybrid Architecture

Pure Supabase (`pg_cron` + SQL) is wrong for this workload. The sync jobs fetch external HTTP APIs, parse complex JSON, normalize addresses, and upsert thousands of rows — application workflow, not DB maintenance. But running that application logic on Vercel for 5 minutes per job is expensive.

The hybrid keeps Vercel's strengths (cron scheduling, `revalidatePath()`) and offloads the expensive compute to Supabase Edge Functions (included in the Medium plan at no extra cost).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Vercel                                                  │
│                                                         │
│  vercel.json cron ──► /api/cron/trigger?source=hpd      │
│                       (auth check, invoke edge fn, ~2s) │
│                                                         │
│  /api/revalidate  ◄── callback from Edge Function       │
│  (revalidatePath, ~100ms)                               │
└─────────────────────────────────────────────────────────┘
          │                        ▲
          │ invoke                 │ POST /api/revalidate
          ▼                        │
┌─────────────────────────────────────────────────────────┐
│ Supabase Edge Functions                                 │
│                                                         │
│  sync/index.ts                                          │
│  - Receives { source, mode } in request body            │
│  - Fetches external APIs (NYC Open Data, LA, etc.)      │
│  - Parses, normalizes, upserts to Postgres              │
│  - Links records to buildings                           │
│  - Calls back to Vercel /api/revalidate                 │
│  - Notifies IndexNow                                    │
│                                                         │
│  _shared/                                               │
│  - supabase-admin.ts (client setup)                     │
│  - batch-upsert.ts                                      │
│  - parse-date.ts                                        │
│  - seo-helpers.ts (slug generation, buildingUrl)        │
│  - cities.ts (CITY_META, types)                         │
└─────────────────────────────────────────────────────────┘
```

## What Stays on Vercel

### 1. Cron schedules (vercel.json)

All 54 cron entries remain in `vercel.json` but point to a new generic trigger route instead of the heavy sync route. The schedules themselves are unchanged.

**Before:**
```json
{ "path": "/api/cron/sync?source=hpd", "schedule": "5 5 * * *" }
```

**After:**
```json
{ "path": "/api/cron/trigger?source=hpd", "schedule": "5 5 * * *" }
```

### 2. Thin trigger route — `/api/cron/trigger`

A single route that:
1. Validates `CRON_SECRET` from the Authorization header
2. Reads `source` and `mode` query params
3. Fires a `fetch()` to the Edge Function **without awaiting the response body** (fire-and-forget)
4. Returns `202 Accepted` immediately

**Important**: `supabase.functions.invoke()` is synchronous — it waits for the Edge Function to complete, which would defeat the purpose. We use raw `fetch()` instead and intentionally do not await the response.

This runs in ~1-2 seconds regardless of how long the actual sync takes.

```typescript
// Pseudocode
export async function GET(req: NextRequest) {
  // Auth check
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get("source");
  const mode = req.nextUrl.searchParams.get("mode") || "sync";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fire-and-forget: send the request but don't await the response body.
  // The Edge Function runs independently; we just confirm the request was accepted.
  fetch(`${supabaseUrl}/functions/v1/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source, mode }),
  }).catch((err) => console.error("Edge Function invoke failed:", err));

  return NextResponse.json({ triggered: true, source, mode }, { status: 202 });
}
```

### 3. Revalidation endpoint — `/api/revalidate`

A new lightweight route that the Edge Function calls after completing a sync:

```typescript
// POST /api/revalidate
// Body: { paths: string[], secret: string }

const ALLOWED_PATH_PATTERNS = [
  /^\/\[city\]/,
  /^\/$/,
];
const MAX_PATHS = 10;

export async function POST(req: NextRequest) {
  const { paths, secret } = await req.json();
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(paths) || paths.length > MAX_PATHS) {
    return NextResponse.json({ error: "Invalid paths" }, { status: 400 });
  }

  const validPaths = paths.filter(
    (p: unknown) => typeof p === "string" && ALLOWED_PATH_PATTERNS.some((re) => re.test(p))
  );

  for (const path of validPaths) {
    revalidatePath(path, "page");
  }

  return NextResponse.json({ revalidated: validPaths.length });
}
```

### 4. Routes that stay as-is on Vercel

- `/api/cron/refresh-stats` — lightweight (DB queries + revalidation, no external API fetching)
- `/api/cron/health-check` — trivial
- All 66 user-facing API routes
- All SSR/ISR pages, middleware

## What Moves to Supabase Edge Functions

### 1. `supabase/functions/sync/index.ts`

The main 5,377-line sync route ported to Deno. The logic is identical with two notable adjustments:

- **`STALE_SYNC_MINUTES`**: Currently 20 minutes, designed around Vercel's timeout behavior. In the Edge Function context, this constant should be increased to 30 minutes to account for the longer 400s timeout ceiling. The `cleanupStaleSyncs()` comment should be updated to reflect the new runtime.
- **`SYNC_TIME_BUDGET_MS`**: Currently 220s (leaves 80s for linking/response within Vercel's 300s limit). Increase to 350s to use the Edge Function's longer timeout.

**Key differences from the Vercel version:**

| Aspect | Vercel (current) | Supabase Edge Function |
|---|---|---|
| Entry point | `export async function GET(req: NextRequest)` | `Deno.serve(async (req) => { ... })` |
| Response | `NextResponse.json(...)` | `new Response(JSON.stringify(...))` |
| Env vars | `process.env.X` | `Deno.env.get("X")` |
| Imports | npm packages | `esm.sh` URLs or import maps |
| Timeout | 300s (Vercel Pro) | 400s (Supabase Medium, configurable) |
| `revalidatePath()` | Direct call | HTTP callback to `/api/revalidate` |
| Time budget | 220s (leaves room for response) | 350s (more headroom) |

### 2. `supabase/functions/_shared/`

Shared modules extracted from the monolithic route:

- **`supabase-admin.ts`** — `getSupabaseAdmin()` using `Deno.env`
- **`batch-upsert.ts`** — `batchUpsert()` helper
- **`parse-date.ts`** — `parseDate()`, `toSodaDate()`
- **`seo-helpers.ts`** — `generateBuildingSlug()`, `buildingUrl()`, `regionSlug()` (copied from `src/lib/seo.ts`)
- **`cities.ts`** — `CITY_META`, `City` type (copied from `src/lib/cities.ts`)
- **`crime-categories.ts`** — `categorizeCrime()` (copied from `src/lib/crime-categories.ts`)
- **`indexnow.ts`** — `notifyIndexNow()` (copied from `src/lib/indexnow.ts`)
- **`revalidate.ts`** — helper to call back to the Vercel revalidation endpoint

### 3. Other heavy cron routes to migrate

These also have `maxDuration = 300` and follow the same pattern:

- `sync-news/route.ts` → `supabase/functions/sync-news/index.ts`
- `sync-energy/route.ts` → `supabase/functions/sync-energy/index.ts`
- `sync-transit/route.ts` → `supabase/functions/sync-transit/index.ts`
- `sync-schools/route.ts` → `supabase/functions/sync-schools/index.ts`
- `sync-rent-stabilization/route.ts` → `supabase/functions/sync-rent-stabilization/index.ts`
- `sync-encampments/route.ts` → `supabase/functions/sync-encampments/index.ts`
- `sync-zillow-rents/route.ts` → `supabase/functions/sync-zillow-rents/index.ts`
- `geocode-buildings/route.ts` → `supabase/functions/geocode-buildings/index.ts`

## Deno Import Strategy

Use an import map (`supabase/functions/import_map.json`) referenced in `supabase/config.toml` to keep imports clean:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2",
    "shared/": "./_shared/"
  }
}
```

The Supabase CLI automatically picks up `import_map.json` when placed at `supabase/functions/import_map.json` — no `config.toml` entry needed.

This avoids littering every file with `esm.sh` URLs.

## Environment Variables

The Edge Functions need these env vars configured in the Supabase dashboard (Settings > Edge Functions):

| Variable | Source | Notes |
|---|---|---|
| `SUPABASE_URL` | Auto-injected | Available by default in Edge Functions |
| `SUPABASE_ANON_KEY` | Auto-injected | Available by default (not used, but noted for clarity) |
| `SUPABASE_SERVICE_ROLE_KEY` | Manual secret | Must be added via `supabase secrets set` — NOT auto-injected |
| `NYC_OPEN_DATA_APP_TOKEN` | Manual secret | For SODA API rate limits |
| `CRON_SECRET` | Manual secret | For auth on revalidation callback |
| `VERCEL_APP_URL` | Manual secret | e.g., `https://lucidrents.com` — for revalidation callback |
| `INDEXNOW_KEY` | Manual secret | For IndexNow notifications |

Note: Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected. All other env vars including `SUPABASE_SERVICE_ROLE_KEY` must be set manually via `supabase secrets set`.

## Revalidation Callback Detail

After the Edge Function completes a sync, it calls back to Vercel:

```typescript
// In _shared/revalidate.ts
export async function triggerRevalidation(paths: string[]) {
  const appUrl = Deno.env.get("VERCEL_APP_URL");
  const secret = Deno.env.get("CRON_SECRET");

  if (!appUrl || !secret) {
    console.warn("Skipping revalidation: missing VERCEL_APP_URL or CRON_SECRET");
    return;
  }

  try {
    await fetch(`${appUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, secret }),
    });
  } catch (err) {
    // Best-effort — don't fail the sync over a revalidation miss
    console.error("Revalidation callback failed:", err);
  }
}
```

This is best-effort. If it fails, ISR pages serve slightly stale data until the next revalidation window — acceptable.

## Cost Impact

### Before (current)
- ~40 daily crons × ~60s avg execution × 30 days = ~72,000 function-seconds/month
- Plus weekly/monthly crons with `maxDuration=300`
- Vercel bill: tracking toward ~$180/month

### After (hybrid)
- ~54 thin triggers × ~2s × 30 days = ~3,240 function-seconds
- ~54 revalidation callbacks × ~0.1s × 30 days = ~162 function-seconds
- Total: ~3,400 function-seconds/month (vs ~72,000)
- **~95% reduction in Vercel function execution time**
- Supabase Edge Function execution: included in Medium plan
- Expected Vercel bill: ~$20-25/month (back to baseline)

### Net savings
- Before: ~$180/month (Vercel) + $75/month (Supabase) = ~$255
- After: ~$25/month (Vercel) + $75/month (Supabase) = ~$100
- **Savings: ~$155/month**

## Migration Strategy

Migrate incrementally, one source at a time, to minimize risk:

### Phase 1: Infrastructure
1. Create `supabase/functions/_shared/` with extracted helpers
2. Create `/api/cron/trigger` route on Vercel
3. Create `/api/revalidate` route on Vercel
4. Deploy and test the trigger → Edge Function → revalidation flow with a single simple source

### Phase 2: Port the main sync function
5. Port `sync/route.ts` to `supabase/functions/sync/index.ts` (Deno conversion)
6. Test with one NYC source (e.g., `hpd` — well-understood, runs daily)
7. Migrate remaining NYC sources one-by-one, verifying sync_log results
8. Migrate LA, Chicago, Miami, Houston sources

### Phase 3: Port remaining heavy crons
9. Port `sync-news`, `sync-energy`, `sync-transit`, `sync-schools`, etc.
10. Update vercel.json entries to point to `/api/cron/trigger`

### Phase 4: Cleanup
11. Remove old Vercel cron routes (keep for rollback initially)
12. Remove `maxDuration = 300` from remaining routes
13. Verify Vercel bill reduction over one billing cycle

## Rollback Plan

If an Edge Function fails, revert the affected vercel.json entry to point back at the original Vercel route. The old routes stay deployed until Phase 4 cleanup, so rollback is a one-line config change.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Deno compatibility issues with API parsing | Test each source individually; the logic is mostly `fetch` + string manipulation which works identically |
| Edge Function cold starts | Not a concern — crons are scheduled, not user-facing |
| `rss-parser` npm package not Deno-compatible | Replace with `fast-xml-parser` (works via esm.sh) or native `DOMParser` for RSS feed parsing in `sync-news` |
| Revalidation callback fails | Best-effort; ISR pages still revalidate on their normal schedule |
| Edge Function timeout (400s max on Medium plan) | Current jobs finish well within 300s; 400s gives headroom. Verify actual limit during Phase 1 testing |
| External API blocks Supabase IPs | Monitor first few runs; fallback to Vercel route if blocked |

## Out of Scope

- Migrating user-facing API routes (these are lightweight, not cost drivers)
- Changing the database schema
- Modifying the sync logic itself (pure port, no behavior changes)
- Moving off Vercel entirely (Next.js SSR/ISR still needs Vercel)
