# Hybrid Cron Migration Implementation Plan
For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Move heavy cron job execution from Vercel serverless functions to Supabase Edge Functions, keeping Vercel as the cron scheduler with thin fire-and-forget triggers, to reduce Vercel costs by ~95%.

**Architecture:** Vercel cron schedules fire thin trigger routes (~2s) that invoke Supabase Edge Functions via fire-and-forget fetch(). Edge Functions do the heavy lifting (API fetching, parsing, upserting). After completion, Edge Functions call back to a Vercel /api/revalidate endpoint for cache invalidation.

**Tech Stack:** Supabase Edge Functions (Deno), Supabase JS Client v2, Next.js App Router, Vercel Cron

**Spec:** docs/superpowers/specs/2026-04-02-hybrid-cron-migration-design.md

---

## File Structure

### New files to create
```
supabase/functions/import_map.json          — shared import map for all edge functions
supabase/functions/_shared/supabase-admin.ts — getSupabaseAdmin() for Deno
supabase/functions/_shared/batch-upsert.ts   — batchUpsert() helper
supabase/functions/_shared/parse-date.ts     — parseDate(), toSodaDate()
supabase/functions/_shared/cities.ts         — City type, CITY_META (copied from src/lib/cities.ts)
supabase/functions/_shared/seo-helpers.ts    — generateBuildingSlug, buildingUrl, regionSlug
supabase/functions/_shared/crime-categories.ts — categorizeCrime (copied from src/lib/crime-categories.ts)
supabase/functions/_shared/indexnow.ts       — notifyIndexNow (copied from src/lib/indexnow.ts)
supabase/functions/_shared/revalidate.ts     — triggerRevalidation callback helper
supabase/functions/_shared/news-sources.ts   — NEWS_SOURCES, helpers (copied from src/lib/news-sources.ts)
supabase/functions/sync/index.ts             — main sync edge function (port of src/app/api/cron/sync/route.ts)
supabase/functions/sync-news/index.ts        — news sync edge function
supabase/functions/sync-energy/index.ts      — energy sync edge function
supabase/functions/sync-transit/index.ts     — transit sync edge function
supabase/functions/sync-la-transit/index.ts  — LA transit edge function
supabase/functions/sync-schools/index.ts     — schools sync edge function
supabase/functions/sync-encampments/index.ts — encampments sync edge function
supabase/functions/sync-rent-stabilization/index.ts — rent stabilization edge function
supabase/functions/sync-zillow-rents/index.ts — Zillow rents edge function
supabase/functions/geocode-buildings/index.ts — geocode buildings edge function
src/app/api/cron/trigger/route.ts            — thin fire-and-forget trigger
src/app/api/revalidate/route.ts              — revalidation callback endpoint
```

### Files to modify
```
vercel.json — update cron paths from /api/cron/sync to /api/cron/trigger
```

### Files that stay unchanged
```
src/app/api/cron/refresh-stats/route.ts  — lightweight, uses revalidatePath directly
src/app/api/cron/health-check/route.ts   — trivial, stays on Vercel
src/app/api/cron/crime-alerts/route.ts   — uses resend, not a cost driver
src/app/api/cron/sync-summary/route.ts   — uses resend, not a cost driver
src/app/api/cron/marketing/route.ts      — has maxDuration=300 but not scheduled in vercel.json, so not a cost driver
```

---

## Task 1: Supabase Edge Functions infrastructure
Set up the shared modules and import map that all edge functions will use.

**Files:**
- Create: `supabase/functions/import_map.json`
- Create: `supabase/functions/_shared/supabase-admin.ts`
- Create: `supabase/functions/_shared/batch-upsert.ts`
- Create: `supabase/functions/_shared/parse-date.ts`
- Create: `supabase/functions/_shared/revalidate.ts`

### Step 1: Create the import map

Create `supabase/functions/import_map.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.49.1",
    "shared/": "./_shared/"
  }
}
```

### Step 2: Create the Supabase admin client helper
Create `supabase/functions/_shared/supabase-admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

### Step 3: Create the batch upsert helper
Port `batchUpsert()` from `src/app/api/cron/sync/route.ts:153-192`:

```ts
import { type SupabaseClient } from "@supabase/supabase-js";

const BATCH_SIZE = 500;

export async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  errors: string[],
  label: string,
  ignoreDuplicates = false
): Promise<number> {
  let totalCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    if (ignoreDuplicates) {
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates });

      if (upsertError) {
        errors.push(`${label} upsert error (batch ${i}): ${upsertError.message}`);
      } else {
        totalCount += batch.length;
      }
    } else {
      const { error: upsertError, count } = await supabase
        .from(table)
        .upsert(batch, { onConflict, count: "exact" });

      if (upsertError) {
        errors.push(`${label} upsert error (batch ${i}): ${upsertError.message}`);
      } else {
        totalCount += count ?? batch.length;
      }
    }
  }

  return totalCount;
}
```

### Step 4: Create the parse-date helper
Create `supabase/functions/_shared/parse-date.ts`:

```ts
export function parseDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sliced = raw.slice(0, 10);
  const normalized = sliced.includes("-")
    ? sliced
    : `${sliced.slice(0, 4)}-${sliced.slice(4, 6)}-${sliced.slice(6, 8)}`;
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (parsed > oneYearFromNow) return null;
  return normalized;
}

export function toSodaDate(isoString: string): string {
  return isoString.replace("Z", "").replace(/\+00:00$/, "");
}
```

### Step 5: Create the revalidation callback helper
Create `supabase/functions/_shared/revalidate.ts`:

```ts
export async function triggerRevalidation(paths: string[]) {
  const appUrl = Deno.env.get("VERCEL_APP_URL");
  const secret = Deno.env.get("CRON_SECRET");

  if (!appUrl || !secret) {
    console.warn("Skipping revalidation: missing VERCEL_APP_URL or CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(`${appUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, secret }),
    });
    if (!res.ok) {
      console.error(`Revalidation callback returned ${res.status}`);
    }
  } catch (err) {
    console.error("Revalidation callback failed:", err);
  }
}
```

### Step 6: Commit
```bash
git add supabase/functions/import_map.json supabase/functions/_shared/
git commit -m "feat: add Supabase Edge Function shared infrastructure for cron migration"
```

---

## Task 2: Copy library helpers to Edge Functions shared directory
Copy the pure-TypeScript library files that the sync functions import.

**Files:**
- Create: `supabase/functions/_shared/cities.ts`
- Create: `supabase/functions/_shared/crime-categories.ts`
- Create: `supabase/functions/_shared/indexnow.ts`
- Create: `supabase/functions/_shared/seo-helpers.ts`
- Create: `supabase/functions/_shared/news-sources.ts`

**Source:** `src/lib/cities.ts`, `src/lib/crime-categories.ts`, `src/lib/indexnow.ts`, `src/lib/seo.ts`, `src/lib/news-sources.ts`

### Step 1: Copy cities.ts — Pure TypeScript, no imports. Copy as-is.

### Step 2: Copy crime-categories.ts — Pure TypeScript, no imports. Copy as-is.

### Step 3: Copy indexnow.ts — Uses only fetch(). Copy as-is.

### Step 4: Create seo-helpers.ts — Copy only `generateBuildingSlug`, `buildingUrl`, `regionSlug` from `src/lib/seo.ts`. Update import:

```ts
// Change: import { CITY_META, type City } from "@/lib/cities";
// To:     import { CITY_META, type City } from "shared/cities.ts";
```

### Step 5: Copy news-sources.ts — Read `src/lib/news-sources.ts` first and verify it has no `@/` aliased imports that would break in Deno. If there are any `@/lib/` imports, update them to use `shared/` paths.

### Step 6: Commit

```bash
git add supabase/functions/_shared/
git commit -m "feat: copy library helpers to edge function shared directory"
```

---

## Task 3: Vercel trigger route and revalidation endpoint

**Files:**
- Create: `src/app/api/cron/trigger/route.ts`
- Create: `src/app/api/revalidate/route.ts`

### Step 1: Create the trigger route

Create `src/app/api/cron/trigger/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get("source");
  const mode = req.nextUrl.searchParams.get("mode") || "sync";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  // Determine which edge function to call based on the source param.
  //
  // IMPORTANT: The `source` param serves double duty:
  //   - For data sources (hpd, complaints, etc.) → routes to the "sync" edge function
  //   - For standalone crons (sync-news, sync-energy, etc.) → routes to their own edge function
  //
  // In vercel.json, standalone crons are rewritten as:
  //   /api/cron/sync-news  →  /api/cron/trigger?source=sync-news
  // The source value IS the edge function name for standalone crons.
  const fnName = getFunctionName(source, mode);

  // Fire-and-forget: send the request but don't await the response body.
  // The Edge Function runs independently; we just confirm the request was sent.
  fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source, mode }),
  }).catch((err) => console.error("Edge Function invoke failed:", err));

  return NextResponse.json(
    { triggered: true, function: fnName, source, mode },
    { status: 202 }
  );
}

/**
 * Map source/mode params to the correct Edge Function name.
 *
 * For standalone crons, the source param IS the edge function name:
 *   /api/cron/trigger?source=sync-news → invokes "sync-news" edge function
 *
 * For data sources handled by the main sync function:
 *   /api/cron/trigger?source=hpd → invokes "sync" edge function with { source: "hpd" }
 */
function getFunctionName(
  source: string | null,
  mode: string
): string {
  const standaloneFunctions = new Set([
    "sync-news",
    "sync-energy",
    "sync-transit",
    "sync-la-transit",
    "sync-schools",
    "sync-encampments",
    "sync-rent-stabilization",
    "sync-zillow-rents",
    "geocode-buildings",
  ]);

  if (source && standaloneFunctions.has(source)) {
    return source;
  }

  return "sync";
}
```

### Step 2: Create the revalidation endpoint
Create `src/app/api/revalidate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const ALLOWED_PATH_PATTERNS = [/^\/\[city\]($|\/)/, /^\/$/];
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
    (p: unknown) =>
      typeof p === "string" &&
      ALLOWED_PATH_PATTERNS.some((re) => re.test(p))
  );

  for (const path of validPaths) {
    revalidatePath(path, "page");
  }

  return NextResponse.json({ revalidated: validPaths.length });
}
```

### Step 3: Test trigger route locally
```bash
npm run dev
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/trigger?source=hpd"
```
Expected: `{"triggered":true,"function":"sync","source":"hpd","mode":"sync"}` with status 202.

### Step 4: Commit
```bash
git add src/app/api/cron/trigger/route.ts src/app/api/revalidate/route.ts
git commit -m "feat: add thin cron trigger route and revalidation callback endpoint"
```

---

## Task 4: Port the main sync Edge Function
The biggest task — porting the 5,377-line `src/app/api/cron/sync/route.ts` to Deno. Contains 34 handler functions across 5 cities.

**Files:**
- Create: `supabase/functions/sync/index.ts`

**Source:** `src/app/api/cron/sync/route.ts` (5,377 lines)

### Step 1: Create the Edge Function entry point

Create `supabase/functions/sync/index.ts` with Deno entry point:

```ts
import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import { batchUpsert } from "shared/batch-upsert.ts";
import { parseDate, toSodaDate } from "shared/parse-date.ts";
import { categorizeCrime } from "shared/crime-categories.ts";
import { generateBuildingSlug, buildingUrl, regionSlug } from "shared/seo-helpers.ts";
import { notifyIndexNow } from "shared/indexnow.ts";
import { type City, CITY_META } from "shared/cities.ts";
import { triggerRevalidation } from "shared/revalidate.ts";

// ... (constants and helpers below)

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { source, mode } = await req.json();
  // ... (port the GET handler logic)
});
```

### Step 2: Port all constants and shared helpers
Copy from `src/app/api/cron/sync/route.ts`, with these changes:
- `SYNC_TIME_BUDGET_MS`: change from `220_000` to `350_000`
- `STALE_SYNC_MINUTES`: change from `20` to `30`
- `buildSodaUrl()`: change `process.env.NYC_OPEN_DATA_APP_TOKEN` to `Deno.env.get("NYC_OPEN_DATA_APP_TOKEN")`
- All other `process.env` → `Deno.env.get()`
- Remove `import { revalidatePath } from "next/cache"`

### Step 3: Port NYC sync handlers (9 functions)

Copy: `syncHPDViolations`, `sync311Complaints`, `syncHPDLitigations`, `syncDOBViolations`, `syncNYPDComplaints`, `syncBedBugReports`, `syncEvictions`, `syncSidewalkSheds`, `syncDobPermits`

### Step 4: Port LA sync handlers (10 functions)
Copy: `syncLAHDViolations`, `syncLA311Complaints`, `syncLADBSViolations`, `syncLAPDCrimeData`, `syncLAPermits`, `syncLASoftStory`, `syncLAHDEvictions`, `syncLAHDTenantBuyouts`, `syncLAHDCCRIS`, `syncLAHDViolationSummary`

### Step 5: Port Chicago sync handlers (6 functions)
Copy: `syncChicagoViolations`, `syncChicago311`, `syncChicagoCrimes`, `syncChicagoPermits`, `syncChicagoRLTO`, `syncChicagoLead`

### Step 6: Port Miami sync handlers (6 functions)
Copy: `syncMiamiViolations`, `syncMiami311`, `syncMiamiCrimes`, `syncMiamiPermits`, `syncMiamiUnsafeStructures`, `syncMiamiRecertifications`

### Step 7: Port Houston sync handlers (3 functions)
Copy: `syncHoustonViolations`, `syncHouston311`, `syncHoustonCrimes`

### Step 8: Port the main handler (router + linking + finalization)
Port the orchestration layer. Key change — replace `revalidatePath()` with:

```ts
await triggerRevalidation([
  "/[city]",
  "/[city]/building/[borough]/[slug]",
  "/[city]/worst-rated-buildings",
  "/[city]/buildings/[borough]",
]);
```

Wrap response as:

```ts
return new Response(JSON.stringify(response), {
  headers: { "Content-Type": "application/json" },
});
```

### Step 9: Commit
```bash
git add supabase/functions/sync/
git commit -m "feat: port main sync cron to Supabase Edge Function"
```

---

## Task 5: Port remaining heavy cron Edge Functions
Port the standalone cron routes that are heavy (long-running or frequent). Note: not all of these have `maxDuration = 300` — some rely on Vercel's default 60s timeout but are still worth porting to reduce function invocation costs.

**Files:**
- Create: `supabase/functions/sync-news/index.ts` (from 132-line route)
- Create: `supabase/functions/sync-energy/index.ts` (from 382-line route)
- Create: `supabase/functions/sync-transit/index.ts` (from 207-line route)
- Create: `supabase/functions/sync-la-transit/index.ts` (from 200-line route)
- Create: `supabase/functions/sync-schools/index.ts` (from 287-line route)
- Create: `supabase/functions/sync-encampments/index.ts` (from 135-line route)
- Create: `supabase/functions/sync-rent-stabilization/index.ts` (from 449-line route)
- Create: `supabase/functions/sync-zillow-rents/index.ts` (from 197-line route)
- Create: `supabase/functions/geocode-buildings/index.ts` (from 110-line route)

### Step 1: Port sync-news

Critical change: Replace `rss-parser` with `fast-xml-parser` (`rss-parser` uses Node.js http modules):

```ts
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.4";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "$_",
});

async function parseRSS(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "LucidRents/1.0 (https://lucidrents.com)" },
    signal: AbortSignal.timeout(10000),
  });
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const channel = parsed.rss?.channel || parsed.feed;
  const items = channel?.item || channel?.entry || [];
  return { items: Array.isArray(items) ? items : [items] };
}
```

Map RSS fields from `fast-xml-parser` to match `rss-parser` output.

### Step 2: Port sync-energy (382 lines, mechanical conversion)

### Step 3: Port sync-transit (207 lines, mechanical conversion)

### Step 4: Port sync-la-transit (200 lines) — Note: NOT currently scheduled in vercel.json, created for manual invocation.

### Step 5: Port sync-schools (287 lines, mechanical conversion)

### Step 6: Port sync-encampments (135 lines) — Note: NOT currently scheduled in vercel.json, created for manual invocation.

### Step 7: Port sync-rent-stabilization (449 lines, mechanical conversion)

### Step 8: Port sync-zillow-rents (197 lines, mechanical conversion)

### Step 9: Port geocode-buildings (110 lines, mechanical conversion)

### Step 10: Commit

```bash
git add supabase/functions/sync-news/ supabase/functions/sync-energy/ \
  supabase/functions/sync-transit/ supabase/functions/sync-la-transit/ \
  supabase/functions/sync-schools/ supabase/functions/sync-encampments/ \
  supabase/functions/sync-rent-stabilization/ supabase/functions/sync-zillow-rents/ \
  supabase/functions/geocode-buildings/
git commit -m "feat: port remaining heavy cron routes to Supabase Edge Functions"
```

---

## Task 6: Set Supabase Edge Function secrets

### Step 0: Verify Supabase CLI is linked
```bash
supabase projects list
supabase link --project-ref <your-project-ref>  # if not already linked
```

### Step 1: Set secrets
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set NYC_OPEN_DATA_APP_TOKEN="your-nyc-app-token"
supabase secrets set CRON_SECRET="your-cron-secret"
supabase secrets set VERCEL_APP_URL="https://lucidrents.com"
supabase secrets set INDEXNOW_KEY="abef9b924e2f4854b589f0b2aad38695"
```

### Step 2: Verify
```bash
supabase secrets list
```

---

## Task 7: Deploy and test with a single source

### Step 1: Deploy the sync Edge Function
```bash
supabase functions deploy sync --import-map supabase/functions/import_map.json
```

### Step 2: Test the Edge Function directly
Use a lightweight source (CLI has ~60s timeout):
```bash
supabase functions invoke sync --body '{"source":"bedbugs","mode":"sync"}'
```

If CLI times out, check `sync_log` table:
```sql
SELECT * FROM sync_log WHERE sync_type = 'bedbugs' ORDER BY started_at DESC LIMIT 1;
```

Check logs:
```bash
supabase functions logs sync --limit 20
```

### Step 3: Test the full trigger flow
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/trigger?source=bedbugs"
```
Expected: immediate 202. Then verify `sync_log` shows completion.

### Step 4: Compare results with existing sync
Run the old Vercel route for the same source and compare `sync_log` entries.

### Step 5: Commit any fixes

---

## Task 8: Deploy all Edge Functions and migrate vercel.json

### Step 1: Deploy all Edge Functions
```bash
supabase functions deploy --import-map supabase/functions/import_map.json
```

Verify:
```bash
supabase functions list
```
Expected: All 10 functions listed.

### Step 2: Smoke test each function
```bash
supabase functions invoke sync-news --body '{}'
supabase functions invoke sync-energy --body '{}'
supabase functions invoke sync-transit --body '{}'
supabase functions invoke sync-schools --body '{}'
```

### Step 3: Update vercel.json cron paths
For main sync sources, change:
```
{ "path": "/api/cron/sync?source=hpd", ... }
→ { "path": "/api/cron/trigger?source=hpd", ... }
```

For standalone crons (source param becomes edge function name):
```
/api/cron/sync-news  →  /api/cron/trigger?source=sync-news
/api/cron/sync-energy  →  /api/cron/trigger?source=sync-energy
/api/cron/sync-transit  →  /api/cron/trigger?source=sync-transit
/api/cron/sync-schools  →  /api/cron/trigger?source=sync-schools
/api/cron/sync-rent-stabilization  →  /api/cron/trigger?source=sync-rent-stabilization
/api/cron/sync-zillow-rents  →  /api/cron/trigger?source=sync-zillow-rents
/api/cron/geocode-buildings  →  /api/cron/trigger?source=geocode-buildings
```

Leave **UNCHANGED**:
```
/api/cron/refresh-stats
/api/cron/health-check
```

Not in vercel.json (no changes needed):
- `sync-la-transit` and `sync-encampments` — not currently scheduled

### Step 4: Verify valid JSON

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('Valid JSON')"
```

### Step 5: Commit
```bash
git add vercel.json
git commit -m "feat: migrate cron schedules to fire-and-forget edge function triggers"
```

---

## Task 9: Deploy to Vercel and monitor

### Step 1: Push and deploy
```bash
git push origin dev
```

### Step 2: Monitor first cron cycle
Check Vercel function logs (triggers should complete in 1-2s), Supabase Edge Function logs, and `sync_log` table.

### Step 3: Verify revalidation working
Visit a recently-synced building page to confirm fresh data.

### Step 4: Monitor Vercel usage
Check Usage → Function Execution in Vercel dashboard after a full day.

---

## Task 10: Cleanup (after one full billing cycle)
**Do NOT execute until the hybrid setup has been stable for 2+ weeks.**

### Step 1: Verify cost savings in Vercel billing dashboard.

### Step 2: Remove old Vercel cron routes (the 10 files that were ported).

### Step 3: Commit cleanup

```bash
git add -A
git commit -m "chore: remove old Vercel cron routes, replaced by Supabase Edge Functions"
```

---

## Rollback Plan
If any Edge Function fails: change the affected `vercel.json` entry back from `/api/cron/trigger?source=X` to `/api/cron/sync?source=X`, push to deploy. Old routes still exist until Task 10 cleanup.
