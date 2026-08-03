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

## HPD lead violations — restored 2026-08-03

`hpd_lead_violations` had no handler anywhere, which is why it stopped on
2026-03-09. Rather than add a source to the 4,400-line `sync` function (a risky
redeploy), it now has its own small standalone function:
`supabase/functions/sync-hpd-lead`, dispatched via
`/api/cron/trigger?source=sync-hpd-lead`.

**The upstream dataset is retired.** SODA `au8t-hgv2` stops at **2020-01-07**
with 29,416 rows total and zero records in the last two years. This sync
therefore maintains a historical set — it will not produce new violations
unless NYC republishes. The cron runs **weekly** (Mon 23:05 UTC) for that
reason, not daily.

We hold all 16,239 rows in the 2010+ window (verified 2026-08-03). The
remaining upstream rows are pre-2010 or have no issue date; `POST {"full":
true, "offset": N}` walks the dataset from the start if they're ever wanted.

Only ~16% of rows link to a building — BBL matching against old records is
inherently lossy.

## sync-news — Miami/Houston guard is live

Deployed 2026-08-03 (v6). Before that, the guard existed in the repo but had
never been deployed, so Houston was still ingesting ~27 articles/week and Miami
~6. Post-deploy the function processes **14 sources instead of 22** and no
hidden-metro feed appears in its results.

That deploy also shipped #289 (HTML-entity decoding + RSS date normalization in
slugs), which had been sitting undeployed since 2026-06-01 — the live function
was still on the April build.

**Known pre-existing bug:** the Chicago Sun-Times feed fails with
`rawContent.replace is not a function`. Its RSS content field parses to an
object, and the `as string` cast in `sync-news/index.ts` doesn't guard against
that. It has been contributing 0 articles; needs a typeof check.

## sync-news RSS field handling — fixed 2026-08-03 (v8)

Two bugs, same root cause: RSS/Atom fields are not reliably strings, and the
code used `as string` casts that lied about it.

1. **Chicago Sun-Times threw every run** — `rawContent.replace is not a
   function`. fast-xml-parser returns an object when an element carries
   attributes or CDATA (`{ "#text": "...", "$_type": "html" }`).
2. **After the throw was fixed it still yielded 0** — the feed is *Atom*, where
   the URL is an attribute-only element (`<link rel="alternate" href="…"/>`)
   parsed as `{ $_href, $_rel }` with no text node. Every entry resolved to an
   empty link and was dropped by the title/link filter.

Now handled by `toText` / `pickContent` / `pickLink` / `pickAuthor`, which cover
strings, `#text` objects, Atom link arrays (preferring `rel="alternate"`), and
nested `<author><name>`. Result: **Sun-Times 0 → 55 articles**, run total
132 → 187, zero errors across all 14 sources.

**Still at zero, not a code bug:** `The Real Deal LA` and
`Crain's Chicago Business` both return **HTTP 403** — those publishers block our
user agent. Needs a UA/fetch strategy change or dropping the feeds.
