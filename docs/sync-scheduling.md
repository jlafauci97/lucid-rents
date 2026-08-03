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

## Restore status

Everything dead since June is now dispatched, including both heavy crime
sources. `nypd` runs at its existing 07:05 UTC slot; `lapd` and
`la-violation-summary` had **no cron entry in either scheduler** and were given
new ones at 20:05 / 20:35 UTC — off-peak and clear of the local scheduler's
01:00 / 17:00 / 21:00 windows, so a spike can't repeat the 2026-07-27 DB wedge.

**Dropped deliberately:** `sheds` (sidewalk sheds) — not needed as of
2026-08-01. Removed from both `VERCEL_DISPATCH_SOURCES` and `vercel.json`;
re-add in both places to bring it back.

Confirm a restore landed with:

```sql
SELECT sync_type, MAX(started_at), SUM(records_added)
FROM sync_log WHERE started_at > now() - interval '3 days'
GROUP BY sync_type ORDER BY 2 DESC;
```

### Known gap: HPD lead violations has no handler

`hpd_lead_violations` (last populated 2026-03-09) **cannot** be restored by a
cron. There is no `syncHPDLeadViolations` function in
`supabase/functions/sync/index.ts` and no matching key in its `SOURCES`
registry — the table was filled by a one-off import. Bringing it back means
writing the handler, registering it, and redeploying the edge function.

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
