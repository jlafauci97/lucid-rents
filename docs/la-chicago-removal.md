# Los Angeles & Chicago removal (August 2026)

Los Angeles and Chicago were pulled from public view on 2026-08-22 so the site
focuses entirely on NYC (growth strategy: depth over breadth, and pruning thin
pages after the Google Search Console traffic collapse). All sync/handler code
and DB rows stay in place, and this document is the runbook for turning the
two metros back on. It follows the same playbook as
`docs/miami-houston-removal.md`.

## What was changed

| Area | Change | Where |
|---|---|---|
| City config | `VALID_CITIES` narrowed to `["nyc"]`; `HIDDEN_CITIES` now includes los-angeles/chicago (derived) | `src/lib/cities.ts` |
| Routing | Hard 404 at the edge for `/los-angeles`, `/chicago`, `/CA/Los-Angeles/*`, `/IL/Chicago/*`, `/la/*`, `/chi/*` via the existing hidden-city gate (+ `la`/`chi` shorthands) | `src/proxy.ts` |
| Pages | `[city]` layout + all `generateStaticParams` follow `VALID_CITIES` automatically | no per-page edits needed |
| Public APIs | Unscoped queries already default to `.in("metro", VALID_CITIES)` (from the Miami/Houston pass) — narrowing `VALID_CITIES` covers them | `src/app/api/**` |
| UI copy | Homepage (hero, directory, streams, rent snapshot, coverage matrix, stats band, CTA), search, about, for-ai, layout metadata, calculators, ReviewForm, llms.txt trimmed to NYC | various |
| Sitemaps | Both generators NYC-only (`VALID_CITIES`, `ACTIVE_METRO_FILTER=in.(nyc)`, `ZIP_MAPS`, LA/Chicago-only page gates); 1,371,432 LA/Chicago URLs stripped from `public/sitemap/*.xml` (613 MB → 321 MB) | `src/lib/sitemap/generator.ts`, `scripts/generate-sitemaps.mjs` |
| Vercel crons | 17 LA/Chicago entries removed (backup below) | `vercel.json` |
| Sync engine | 16 LA/Chicago sources added to `DISABLED_SOURCES` in the edge function; 18 in the legacy route (extra `la-energy`, `la-scep`, `chicago-rodents`, `chicago-scofflaws`) | `supabase/functions/sync/index.ts`, `src/app/api/cron/sync/route.ts` |
| News ingest | los-angeles/chicago added to `DISABLED_METROS` (feed defs kept in `_shared/news-sources.ts`) | `supabase/functions/sync-news/index.ts` |
| Maintenance crons | LA/Chicago dropped from `refresh-stats` and `refresh-crime-cache` metro lists; `warm-buildings` NYC-only | `src/app/api/cron/*` |
| Shared-source crons | LA/Chicago blocks gated off with `SYNC_*` flags: `sync-energy` (`SYNC_LA`, `SYNC_CHICAGO`), `sync-transit` (`SYNC_CTA`), `sync-schools` (`SYNC_LA_SCHOOLS`), `sync-zillow-rents` (`SYNC_LA`), `sync-rent-stabilization` (`SYNC_LA_RSO`) | `src/app/api/cron/*` |
| LA-only crons | `sync-encampments` and `sync-la-transit` return 200 `{skipped:true}` via a `DISABLED` guard | `src/app/api/cron/*` |
| Reddit marketing | Workflow scans NYC + general subs only; relevance-scorer prompts (workflow + `reddit-scoring.ts`) rewritten NYC-only. Subreddit definitions kept in `brand-voice.ts`; `reddit-data-hook.ts` follows `VALID_CITIES` | `workflows/marketing-reddit.ts`, `src/lib/marketing/reddit-scoring.ts` |

Retained on purpose (relaunch-ready): all LA/Chicago sync handlers, city
metadata in `CITY_META`, neighborhood/vibes/zip data files, building-page
Chicago/LA sections, tenant-rights configs, and all DB rows in shared tables.

## Post-merge steps

1. Redeploy edge functions so the guards take effect:
   `supabase functions deploy sync` and `supabase functions deploy sync-news`.
2. Hit `/api/cron/regenerate-sitemaps` (with `CRON_SECRET`) so the Blob copies
   served by `/sitemap-v2/[chunk]` match the trimmed static files.
3. `POST /api/seo/submit-sitemaps` (with `CRON_SECRET`) to resubmit the
   trimmed sitemaps to Google Search Console — this is what prompts Google to
   recrawl, drop the 1.37M removed URLs, and deindex the 404s.
4. Disable LA/Chicago jobs on the Mac Mini launchd scheduler (same manual step
   as the Miami/Houston removal — the edge-function guard makes them no-ops
   server-side, but the local jobs waste runs).
5. Optional: Google Search Console removals tool for any high-visibility
   LA/Chicago URLs that should disappear from results immediately (temporary
   ~6-month hide; the 404s make it permanent), or just let them deindex
   naturally.
6. Optional cost cleanup (separate decision, destructive): dropping
   `complaints_311_chicago` (~6.2 GB) and `complaints_311_la` (~2.2 GB) — plus
   LA/Chicago rows in shared tables — mirrors the later Miami/Houston table
   drop. Both are re-importable from public open-data portals via the sync
   handlers. NOT done in this pass.

## How to bring LA/Chicago back

1. `src/lib/cities.ts`: move `"los-angeles"` / `"chicago"` back into
   `VALID_CITIES`.
2. `src/proxy.ts`: remove `la`/`chi` from `HIDDEN_SHORTHANDS` (the `/la` and
   `/chi` 301 redirect blocks further down are still there).
3. `src/lib/sitemap/generator.ts` + `scripts/generate-sitemaps.mjs`: re-add the
   two cities to the local `VALID_CITIES`, re-add them to `ZIP_MAPS` (mjs),
   widen `ACTIVE_METRO_FILTER`, and un-gate the LA/Chicago-only page blocks.
4. Remove the 16/18 LA/Chicago sources from `DISABLED_SOURCES` in
   `supabase/functions/sync/index.ts` and `src/app/api/cron/sync/route.ts`;
   remove them from `DISABLED_METROS` in `supabase/functions/sync-news/index.ts`;
   redeploy both edge functions.
5. Flip the per-route flags back on: `SYNC_LA`/`SYNC_CHICAGO` (sync-energy),
   `SYNC_CTA` (sync-transit), `SYNC_LA_SCHOOLS` (sync-schools), `SYNC_LA`
   (sync-zillow-rents), `SYNC_LA_RSO` (sync-rent-stabilization), and remove
   the `DISABLED` guards in `sync-encampments` / `sync-la-transit`.
6. Re-add metros in `refresh-stats`, `refresh-crime-cache`, and
   `warm-buildings`.
7. Restore the cron entries below into `vercel.json`.
8. Regenerate sitemaps (`node scripts/generate-sitemaps.mjs`) and re-run the
   blob regeneration cron.
9. Revert the copy edits (homepage, search, about, for-ai, layout, calculators,
   ReviewForm, llms.txt) — this PR's diff is the map.
10. Restore LA/Chicago subs in `workflows/marketing-reddit.ts` and the scorer
    prompts (workflow + `src/lib/marketing/reddit-scoring.ts`).
11. Re-enable the Mac Mini launchd sync jobs.

## Removed vercel.json cron entries (restore verbatim)

```json
[
  { "path": "/api/cron/generate-news?city=chicago", "schedule": "0 12 * * *" },
  { "path": "/api/cron/generate-news?city=los-angeles", "schedule": "0 14 * * *" },
  { "path": "/api/cron/trigger?source=la-permits", "schedule": "5 11 * * *" },
  { "path": "/api/cron/trigger?source=ladbs", "schedule": "5 14 * * *" },
  { "path": "/api/cron/trigger?source=la-soft-story", "schedule": "5 11 1 * *" },
  { "path": "/api/cron/trigger?source=lapd", "schedule": "5 20 * * *" },
  { "path": "/api/cron/trigger?source=la-violation-summary", "schedule": "35 20 * * *" },
  { "path": "/api/cron/trigger?source=chicago-crimes", "schedule": "5 17 * * *" },
  { "path": "/api/cron/trigger?source=chicago-permits", "schedule": "35 17 * * *" },
  { "path": "/api/cron/trigger?source=chicago-rlto", "schedule": "5 5 * * 3" },
  { "path": "/api/cron/trigger?source=chicago-lead", "schedule": "35 5 * * 3" },
  { "path": "/api/cron/rankings-snapshot?city=los-angeles&kind=worst_buildings", "schedule": "30 5 1 * *" },
  { "path": "/api/cron/rankings-snapshot?city=los-angeles&kind=worst_landlords", "schedule": "40 5 1 * *" },
  { "path": "/api/cron/rankings-snapshot?city=los-angeles&kind=worst_neighborhoods", "schedule": "50 5 1 * *" },
  { "path": "/api/cron/rankings-snapshot?city=chicago&kind=worst_buildings", "schedule": "0 6 1 * *" },
  { "path": "/api/cron/rankings-snapshot?city=chicago&kind=worst_landlords", "schedule": "10 6 1 * *" },
  { "path": "/api/cron/rankings-snapshot?city=chicago&kind=worst_neighborhoods", "schedule": "20 6 1 * *" }
]
```
