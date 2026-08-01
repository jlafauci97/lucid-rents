# Sync scheduling — who runs what

Two schedulers ingest data. They must stay **disjoint** or sources double-run.

| Scheduler | Where | Runs |
|---|---|---|
| launchd | Mac Mini (config **not** in this repo) | the high-volume daily sources |
| Vercel crons | `vercel.json` → `/api/cron/trigger` | everything else |

`/api/cron/trigger` is the contract between them. It dispatches **only** sources
in `VERCEL_DISPATCH_SOURCES`; anything else gets a 200 no-op. To move a source
between schedulers, edit that set — and keep it disjoint from launchd.

## The June 2026 silent outage (why this file exists)

The trigger route was blanket-disabled in April when syncs moved to the Mac
Mini. But `vercel.json` still declared 42 cron entries across 31 sources, and
launchd only scheduled ~14 of them. The other ~16 hit the disabled route, got
**HTTP 200**, and stopped ingesting on **2026-06-01**. Vercel saw success, so
nothing alerted. Discovered 2026-08-01, two months later, via `sync_log`.

Dead sources found: NYPD complaints (NYC crime), Chicago crimes / permits /
RLTO / lead, DOB permits, evictions, sidewalk sheds, bedbugs, HPD registrations
and contacts, LA permits, LA soft-story, LADBS violations, rent stabilization.
Three of them had ended in `failed`.

**Lesson:** a disabled dispatcher must not return 200 for sources nothing else
runs. The allowlist now makes the split explicit, and the nightly sync summary
(below) makes a stall visible within a day.

## Staged restore

Stage 1 (2026-08-01) re-enabled everything above **except `nypd`** — the single
heaviest source (multi-million rows), held back so a load spike couldn't wedge
the database the way the 2026-07-27 incident did.

**Stage 2:** once stage 1 has run clean for a few days, add `"nypd"` to
`VERCEL_DISPATCH_SOURCES` in `src/app/api/cron/trigger/route.ts`. Confirm with:

```sql
SELECT sync_type, MAX(started_at), SUM(records_added)
FROM sync_log WHERE started_at > now() - interval '3 days'
GROUP BY sync_type ORDER BY 2 DESC;
```

Still unscheduled anywhere: `lapd` (LA crime, last run 2026-03-25) has no cron
entry in either scheduler. Needs one added deliberately — it is also heavy.

## Alerting

`/api/cron/sync-summary` builds a per-city digest email (Resend) from
`sync_log`. It existed since April but was **never scheduled** — that is why
the outage stayed invisible. Now scheduled nightly at 22:30 UTC, half an hour
after the health check.

Requires `RESEND_API_KEY` and `CRON_SECRET`; sends to the admin address, from
`RESEND_FROM_EMAIL` (default `alerts@lucidrents.com`).

## Checking sync health by hand

```sql
SELECT sync_type,
       MAX(started_at)::date AS last_run,
       COUNT(*) FILTER (WHERE started_at > now() - interval '7 days') AS runs_7d,
       COALESCE(SUM(records_added) FILTER (WHERE started_at > now() - interval '7 days'),0) AS added_7d
FROM sync_log
GROUP BY sync_type
ORDER BY MAX(started_at) DESC NULLS LAST;
```

A source with recent runs but `added_7d = 0` is running but not ingesting —
worth a look. As of 2026-08-01 that applied to `lahd_evictions`,
`lahd_tenant_buyouts` and `lahd_ccris`.

## Separate: the Dewey rent dataset is stale

`dewey_building_rents` and `dewey_neighborhood_rents` (3.8M rows, powering
neighborhood rent charts, the seasonal index and the rent-timing calculator)
have no data past **March 2026**. This is a purchased dataset loaded by script,
not a live sync — it needs a re-import, not a cron fix. The live scraper feeding
`building_rents` is healthy (~36K rows/30d).
