# Miami & Houston removal (July 2026)

Miami and Houston were pulled from public view on 2026-07-26 so the site
focuses on NYC, LA, and Chicago. All sync/handler code stays in the repo, and
this document is the runbook for turning the two metros back on.

> **Update 2026-08-12:** the Miami/Houston **tables were dropped** from the
> database as part of a cost cleanup (~1.5 GB; migration
> `20260812000000_drop_miami_houston_and_dead_tables.sql`). Miami/Houston rows
> in shared tables (`buildings`, etc.) were left alone. Everything dropped is
> re-importable from public open-data portals via the `scripts/backfill-*`
> scripts, so bringing the metros back now also means re-running those
> backfills.

## What was changed

| Area | Change | Where |
|---|---|---|
| City config | `VALID_CITIES` narrowed to 3 active cities; `ALL_CITIES` (5) and `HIDDEN_CITIES` added | `src/lib/cities.ts` |
| Routing | Hard 404 at the edge for `/miami`, `/houston`, `/FL/Miami/*`, `/TX/Houston/*`, `/mia/*`, `/hou/*` | `src/proxy.ts` (hidden-city gate) |
| Pages | `[city]` layout + all `generateStaticParams` follow `VALID_CITIES` automatically | no per-page edits needed |
| Embed | Hidden-metro buildings 404 instead of falling back to nyc | `src/app/embed/building/[id]/page.tsx` |
| Public APIs | Unscoped queries default to `.in("metro", VALID_CITIES)`; unvalidated city params now validated; building-id subroutes 404 for hidden metros | `src/app/api/**` (search, landlords, buildings/nearby, rankings, news, activity, violations, map, crime, transit, schools, checklist, building subroutes) |
| UI copy | Homepage, footer, search, about, for-ai, layout metadata, calculators, llms.txt trimmed to 3 cities | various |
| Sitemaps | Both generators exclude hidden metros (`ACTIVE_METRO_FILTER`); 686,221 Miami/Houston URLs stripped from `public/sitemap/*.xml` | `src/lib/sitemap/generator.ts`, `scripts/generate-sitemaps.mjs` |
| Vercel crons | 17 miami/houston entries removed (backup below) | `vercel.json` |
| Sync engine | `DISABLED_SOURCES` guard (returns 200 `{skipped:true}`); link-mode guard; fan-out filter | `supabase/functions/sync/index.ts` + legacy `src/app/api/cron/sync/route.ts` |
| News ingest | Miami/Houston RSS feeds skipped (`DISABLED_METROS`) | `supabase/functions/sync-news/index.ts` (feed defs kept in `_shared/news-sources.ts`) |
| Maintenance crons | miami/houston dropped from `refresh-stats` metros; houston dropped + Miami block gated (`REFRESH_MIAMI`) in `refresh-crime-cache` | `src/app/api/cron/*` |
| Reddit marketing | Miami/Houston subreddits + market terms removed from the scheduled scan task (backup at `~/.claude/scheduled-tasks/lucidrents-reddit-scan/SKILL.md.pre-miami-houston-removal.bak`) | outside repo |

## Still running outside this repo (manual step)

The real data syncs run from a **launchd scheduler on the Mac Mini** (not this
repo; `/api/cron/trigger` was already a no-op). The edge-function
`DISABLED_SOURCES` guard makes miami/houston calls no-ops server-side once the
`sync` and `sync-news` edge functions are redeployed, but the Mac Mini's
miami/houston jobs should also be disabled/commented there to stop wasted runs.

## Post-merge steps

1. Redeploy edge functions so the guards take effect:
   `supabase functions deploy sync` and `supabase functions deploy sync-news`.
2. Hit `/api/cron/regenerate-sitemaps` (with `CRON_SECRET`) so the Blob copies
   served by `/sitemap-v2/[chunk]` match the trimmed static files.
3. Disable miami/houston jobs on the Mac Mini launchd scheduler.
4. Optional: in Google Search Console, use the removals tool / let the 404s
   deindex naturally.

## How to bring Miami/Houston back

1. `src/lib/cities.ts`: move `"miami"` / `"houston"` back into `VALID_CITIES`.
2. `src/lib/sitemap/generator.ts` + `scripts/generate-sitemaps.mjs`: re-add the
   two cities to the local `VALID_CITIES`, re-add `miami`/`houston` to
   `ZIP_MAPS` (mjs), and delete `ACTIVE_METRO_FILTER` (or widen it).
3. Empty `DISABLED_SOURCES` in `supabase/functions/sync/index.ts` and
   `src/app/api/cron/sync/route.ts`; remove `DISABLED_METROS` in
   `supabase/functions/sync-news/index.ts`; redeploy both edge functions.
4. Re-add metros in `refresh-stats` and `refresh-crime-cache`
   (`REFRESH_MIAMI = true`).
5. Restore the cron entries below into `vercel.json`.
6. Regenerate sitemaps (`node scripts/generate-sitemaps.mjs`) and re-run the
   blob regeneration cron.
7. Revert the copy edits (homepage, footer, about, for-ai, search, layout,
   llms.txt) — `git log --grep "miami" --oneline` or this PR's diff is the map.
8. Re-add Miami/Houston subreddits to the Reddit scan task (backup file above).
9. Re-enable the Mac Mini launchd sync jobs.

## Removed vercel.json cron entries (restore verbatim)

```json
[
  { "path": "/api/cron/generate-news?city=miami", "schedule": "15 11 * * *" },
  { "path": "/api/cron/generate-news?city=houston", "schedule": "15 12 * * *" },
  { "path": "/api/cron/trigger?source=miami-violations", "schedule": "5 20 * * *" },
  { "path": "/api/cron/trigger?source=miami-311", "schedule": "35 20 * * *" },
  { "path": "/api/cron/trigger?source=miami-crimes", "schedule": "5 21 * * *" },
  { "path": "/api/cron/trigger?source=miami-permits", "schedule": "35 21 * * *" },
  { "path": "/api/cron/trigger?source=miami-unsafe", "schedule": "5 5 * * 2" },
  { "path": "/api/cron/trigger?source=miami-recerts", "schedule": "35 5 * * 2" },
  { "path": "/api/cron/trigger?mode=link&source=miami-violations", "schedule": "5 22 * * *" },
  { "path": "/api/cron/trigger?mode=link&source=miami-311", "schedule": "35 22 * * *" },
  { "path": "/api/cron/trigger?mode=link&source=miami-permits", "schedule": "5 23 * * *" },
  { "path": "/api/cron/trigger?source=houston-violations", "schedule": "5 2 * * *" },
  { "path": "/api/cron/trigger?source=houston-311", "schedule": "35 2 * * *" },
  { "path": "/api/cron/trigger?source=houston-crimes", "schedule": "5 4 * * *" },
  { "path": "/api/cron/trigger?mode=link&source=houston-violations", "schedule": "35 0 * * *" },
  { "path": "/api/cron/trigger?mode=link&source=houston-311", "schedule": "5 1 * * *" },
  { "path": "/api/cron/trigger?mode=link&source=houston-crimes", "schedule": "35 1 * * *" }
]
```
