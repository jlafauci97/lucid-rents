# Neighborhood Risks — Deploy Runbook

This walks through every step to take the Neighborhood Risks tool from merged PR to live in production. Run it once after merging PR #223 (or whichever PR shipped this feature).

**Time estimate:** 15 minutes end-to-end.

**Prerequisites:**

- Repo merged to `main`, Vercel auto-deploy completes (the app code goes live first, harmless because pages handle missing tables gracefully)
- Supabase CLI installed and logged in: `npx supabase login`
- Supabase project linked: `npx supabase link --project-ref <ref>` (one-time)
- Environment variables in Vercel already set (they are — used by all other crons): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 1 — Apply database migrations

Six new migrations need to land in production Supabase. They're additive (new tables, indexes, RPCs) and safe to apply in any order, but easiest as a single push.

```bash
git checkout main
git pull
npx supabase db push --linked
```

This runs:

- `20260520100000_nearby_concerns.sql` — unified POI table
- `20260520100100_sex_offender_restricted.sql` — RLS-gated table + count RPC
- `20260520100200_nearby_concerns_overrides.sql` — admin escape hatch
- `20260520100300_calm_score_baselines.sql` — score baseline table
- `20260520400000_nearby_concerns_within_radius_rpc.sql` — search RPC
- `20260520400100_block_level_count_rpcs.sql` — 311/rat/bedbug count RPCs

**Verify:**

```bash
npx supabase db remote query --linked "SELECT table_name FROM information_schema.tables WHERE table_name IN ('nearby_concerns', 'sex_offender_locations_restricted', 'nearby_concerns_overrides', 'calm_score_baselines') ORDER BY table_name;"
```

Expected: 4 rows back. If you see fewer, the push didn't apply cleanly — check the Supabase dashboard SQL editor for errors.

---

## Step 2 — Confirm sex-offender table is RLS-protected

Critical security check. The table must be unreadable via the anon key.

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sex_offender_locations_restricted?select=*&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `{"code":"42501","message":"permission denied for table sex_offender_locations_restricted",...}` (or an empty `[]` if RLS denies via no policies — either is correct).

Anything that returns row data with names/coordinates is a security failure. Roll back the migration and investigate.

Confirm the count RPC works (returns 0 until the sync runs):

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/count_sex_offenders_near" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7679,"lng":-73.9819,"radius_meters":1207}'
```

Expected: `0`.

---

## Step 3 — Deploy the edge function

```bash
npx supabase functions deploy sync-nearby-concerns
```

This deploys `supabase/functions/sync-nearby-concerns/` (orchestrator + 4 module files + the `_shared/` helpers via the import map).

**Verify the deploy:**

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/sync-nearby-concerns?source=all" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  | jq .
```

Expected: a JSON response with non-zero `synced` counts for each module:

```json
{
  "ok": true,
  "requested": "all",
  "results": {
    "sirens-fdny": { "synced": 250, "errors": [] },
    "sirens-hospitals": { "synced": 11, "errors": [] },
    "dsny-garages": { "synced": 59, "errors": [] },
    "active-construction": { "synced": 1500, "errors": [] }
  }
}
```

The exact counts will vary — what matters is no error strings.

If any module errors:

- `Cannot find module 'shared/...'` → import map didn't deploy; redeploy with `--no-verify-jwt --import-map supabase/functions/import_map.json` (Supabase usually auto-detects)
- `relation "nearby_concerns" does not exist` → Step 1 didn't apply; rerun migrations
- `permission denied` → service role key isn't being passed; check `supabase secrets list`

---

## Step 4 — Smoke-test the live page

Pick a known NYC building from the database. For example:

```
https://lucidrents.com/nyc/tenant-tools/neighborhood-risks
```

Search for any well-known NYC building (e.g. "220 Central Park South"), click into the result, and verify:

- [ ] Hero loads with building name, breadcrumbs, three stat tiles
- [ ] Sticky jump nav shows 4 pills with non-zero counts (at least Block-level should be populated)
- [ ] Public-safety section: most blocks "All clear" — sex offender block shows count + privacy note
- [ ] 24/7 Noise section: Sirens block populated with FDNY firehouses + HHC hospital ERs, Active Construction populated
- [ ] Environmental section: DSNY garages populated
- [ ] Block-level section: 311 noise / rat / bedbug counts non-zero
- [ ] Calm score displays as a number out of 10 (gold gradient text)
- [ ] Page TTFB < 1 second on cold ISR cache

---

## Step 5 — Compute calm-score baselines (optional but recommended)

Without baselines, the calm score uses hardcoded fallback medians (30 / 5 / 2) for noise / rats / bedbugs. To compute actual NYC medians:

```bash
# Set env vars locally if not already
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

node scripts/compute-calm-score-baselines.mjs
```

This is a one-shot script — re-run quarterly or whenever 311/rat/bedbug volumes meaningfully shift.

**Note:** This script doesn't exist yet — see the deferred follow-up in the implementation plan. Until it's written, the hardcoded fallbacks are fine.

---

## Step 6 — Verify the cron is registered

Vercel auto-picks up the new entry in `vercel.json` (`/api/cron/sync-nearby-concerns` at `0 7 * * 0` = Sundays 7am UTC = 3am ET).

Check the Vercel dashboard → Project → Settings → Cron Jobs. You should see:

```
/api/cron/sync-nearby-concerns    0 7 * * 0    Active
```

You can manually trigger it from the dashboard to confirm it works (it'll hit the edge function and return a JSON response).

---

## Step 7 — Monitor first weekly run

Sunday 3am ET. Check:

- Vercel function logs for `/api/cron/sync-nearby-concerns` — should return `{ok: true}`
- Supabase function logs for `sync-nearby-concerns` — should show per-module run records
- `sync_log` table — should have 4 new rows (one per module) with `status = 'completed'`

```sql
SELECT source, records_synced, status, completed_at
FROM sync_log
WHERE source LIKE 'nyc_open_data_%' OR source = 'nyc_dob_sidewalk_sheds_derived'
ORDER BY completed_at DESC LIMIT 10;
```

---

## Rollback

If something goes wrong post-deploy, the tool is fully isolated and can be cleanly disabled:

1. **Hide the nav entry:** revert the `NavDropdown.tsx` and `tenant-tools/page.tsx` entries (or push a quick PR removing them)
2. **Pause the cron:** comment out the entry in `vercel.json`
3. **Disable the page:** add a `notFound()` at the top of both `neighborhood-risks/page.tsx` and `[buildingSlug]/page.tsx`

Migrations can stay applied — they're additive and don't affect anything else.

---

## Known limitations at v1 launch

Documented in `supabase/functions/sync-nearby-concerns/index.ts` and the PR description:

- **10 sub-categories show "All clear"** until follow-up sync modules ship. Affected: homeless shelters, migrant reception, methadone clinics, halfway houses, NYPD precinct stations, private hospitals, brownfields, IBZ, elevated rail/highway, scraped advocacy shelter directories.
- **Sex-offender count is 0** until the NYS DCJS scrape module ships (sensitive — requires human review pre-deploy).
- **Family shelters are intentionally excluded** per design (DHS protects family-shelter addresses).
- **Search is building-autocomplete only** — free-text address geocoding is v1.1.
