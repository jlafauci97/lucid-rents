# Violation Linking Fix (Houston + Miami + LA) Implementation Plan

> **STATUS: SHELVED 2026-04-11.** Investigation revealed the "56% unlinked" headline metric is mostly product-scope mismatch, not a linking bug. See "Shelving Note" below. The plan document is preserved for historical reference.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Shelving Note — 2026-04-11

**TL;DR:** We thought we had a severe linking bug (56% of Houston 311, 67% of Miami 311, 47% of LA 311 unlinked). Investigation showed the linker is fine; the "unlinked" rows are mostly 311 calls about single-family homes that will never be in our `buildings` table (which only tracks multi-unit rentals). Real link-failure rate is ≤10%. Not worth further investment right now.

**What got built and stays:**
- ✅ `supabase/migrations/20260410100100_diagnostics_unlinked_violations.sql` — applied to prod, safe to leave. Provides `unlinked_violations_by_metro()` and `unlinked_violations_sample()` RPCs for future use.
- ✅ `scripts/deep-sweep-link.mjs` — standalone Node script that drains the unlinked backlog for any metro/source. Dry-run tested and working. Not run live. Ready if we ever want it.

**What we learned (save the next person this investigation):**
1. The linker at `src/app/api/cron/sync/route.ts:~4401` (`runLinkOnly()`) is sophisticated and correct. It loads all buildings for a metro into an in-memory map, normalizes addresses via `normalizeAddressForLinking()` at line 2128, and batch-matches unlinked rows. This is good code.
2. `normalizeAddressForLinking()` is a real normalizer (USPS abbreviations, directionals, ordinals, unit stripping, city/state/zip removal, range collapsing). Do not build another one.
3. `parsed_house_num` / `parsed_street` columns in `complaints_311` are **dead code** — nothing reads or writes them. Don't waste time on them.
4. The linker only considers rows imported in the last 30 days (see `linkCutoff` at ~line 5053 per metro). This is fine given the above — rows that don't match a building on first pass don't magically become matchable later.
5. Dry-run match rates on unlinked rows: Houston 9.6%, Miami 5.7%, LA didn't finish (timeout loading 350K buildings). This means the deep-sweep can recover ~10% of the backlog if we ever want to run it — real rows, but not a lot in the scheme of things.
6. `complaints_311` is ~23M rows and ~13GB partitioned by metro. Aggregate queries like `count(*) filter (where building_id is null)` can time out on the NYC/Chicago partitions.

**When to revive this plan:**
- If we start rendering 311 complaints on single-family-home pages (we'd need to expand `buildings` to include SFHs, which is a much bigger product decision)
- If Mission Control surfaces an actual linking-health metric and it comes back genuinely bad
- If a specific building page is visibly missing complaints users expect to see

**Files to leave in place:**
- `supabase/migrations/20260410100100_diagnostics_unlinked_violations.sql` — harmless, useful, keep
- `scripts/deep-sweep-link.mjs` — ready to run if ever needed, keep

---

**Goal (original):** Drain the backlog of unlinked `complaints_311` rows in Houston, Miami, and LA, and prevent the backlog from re-accumulating. Secondary goal: surface linking health in Mission Control so regressions are caught within a day.

**Baseline captured 2026-04-10 (`complaints_311.building_id IS NULL`):**

| Metro | Total | Unlinked | % unlinked |
|---|---:|---:|---:|
| Houston | 853,602 | 480,405 | **56.28%** |
| Miami | 1,687,237 | 1,135,048 | **67.27%** |
| Los Angeles | 3,548,345 | 1,684,465 | **47.47%** |
| NYC | *(query timeout — deferred)* | — | — |
| Chicago | *(query timeout — deferred)* | — | — |

`dob_violations` is mostly fine: Miami 13.4% unlinked, Houston recent rows (2025+) 0% unlinked. The pain is in `complaints_311`. NYC and Chicago numbers timed out and are deferred — they are not known to be broken.

---

## Root cause — NOT what the original plan assumed

**Original hypothesis:** address normalizer is missing / broken / city-specific parsing is inconsistent; build a shared normalizer, add `normalized_address` column to `buildings`, rewrite `linkByAddress()`.

**Actual root cause (discovered while reading `src/app/api/cron/sync/route.ts` line by line):**

1. **A sophisticated linker already exists.** `runLinkOnly()` (line 4401) runs an in-memory batch match:
   - Loads all buildings for a metro into a `Map<normalizedAddress, buildingId>`
   - Pages unlinked rows from the target table
   - Normalizes each row's address via `normalizeAddressForLinking()` (line 2128)
   - Looks up in the map; if no match, **auto-creates a new building** with coordinates from the row
   - Works for NYC, LA, Chicago, Miami, Houston — each metro has its own block

2. **`normalizeAddressForLinking()` already handles every city.** It does USPS abbreviations, directional collapsing, ordinal suffix removal (`138TH → 138`), unit stripping, city/state/zip removal, address-range collapsing (`4601 - 4621 → 4601`). This is the normalizer the original plan wanted to build — it's already written and already called for all 5 metros.

3. **The actual bug is a 30-day window cap** at line 5053-5054 (and mirrored in every metro block):
   ```ts
   const linkCutoff = new Date();
   linkCutoff.setDate(linkCutoff.getDate() - 30);
   // ...
   .gte("imported_at", linkCutoff.toISOString())
   ```
   The linker only considers rows imported in the last 30 days. Any row older than that, if it wasn't successfully linked in its window, is **never retried**. Over time this leaves a permanent orphan backlog — exactly matching the 480K/1.1M/1.7M numbers above.

4. **`parsed_house_num` / `parsed_street` are dead code.** Schema has them, Houston ingestion doesn't populate them, nothing reads them. Earlier intermediate plan versions assumed fixing these columns mattered. They don't. Ignore them.

5. **`linkByAddress()` at line 548** (the "old" linker the original plan wanted to rewrite) is only used for NYC-specific BBL/APN paths, not for 311. Rewriting it would not affect the 311 backlog.

**Conclusion:** The linker is fundamentally correct and already written. We don't need a new normalizer, a new column on `buildings`, or a rewrite of `linkByAddress()`. We need:
- A one-time deep-sweep to drain the historical backlog (bypassing the 30-day window)
- A durable way to prevent the backlog from re-accumulating (either a periodic deep-sweep cron, or raising the cutoff)
- Observability so we can tell the next time something drifts

**Tech Stack:** Node.js (mjs scripts), TypeScript (Next.js API route), Supabase JS client, PostgreSQL.

**Related plan:** `docs/superpowers/plans/2026-03-30-mission-control-diagnostics.md`

---

## File Structure

### Code (modify)
- `src/app/api/cron/sync/route.ts:~5053` — Houston linking block: add structured log line with `{ matched, unmatched, auto_created, time_spent_ms, time_budget_hit }`
- `src/app/api/cron/sync/route.ts:~4878` — Miami linking block: same
- `src/app/api/cron/sync/route.ts:~4478` — NYC 311 linking block: same
- `src/app/api/cron/sync/route.ts:~4713` — Chicago linking block: same
- `src/app/api/cron/sync/route.ts:~4635` — LA linking block: same
- `src/app/api/cron/sync/route.ts:~5254` — Cron handler: accept a new `?mode=deep-sweep` query param that invokes the deep-sweep path (no 30-day cutoff)

### Database (new)
- `supabase/migrations/20260410100100_diagnostics_unlinked_violations.sql` — **Already applied.** RPCs `unlinked_violations_by_metro` and `unlinked_violations_sample`.

### Scripts (new)
- `scripts/deep-sweep-link.mjs` — Standalone Node script that reuses the same in-memory linker pattern as `runLinkOnly()` but without the 30-day cutoff. Accepts `--metro <name>` and `--source <complaints_311|dob_violations|nypd_complaints>`. Idempotent. Checkpoints to a local file so it can resume after interruption.

### Mission Control (modify)
- `src/app/profile/mission-control/page.tsx` — Add an "Unlinked Violations" panel that surfaces `unlinked_violations_by_metro` per metro with red/amber/green thresholds.

---

## Task 1: Quantify the Problem ✅ COMPLETE

**Files:**
- `supabase/migrations/20260410100100_diagnostics_unlinked_violations.sql`

- [x] **Step 1: Write the diagnostic RPC** — Done 2026-04-10
- [x] **Step 2: Apply the migration** — Done 2026-04-10
- [x] **Step 3: Capture baseline** — Numbers recorded at the top of this file.

---

## Task 2: Deep-Sweep Backfill Script

**Files:**
- New: `scripts/deep-sweep-link.mjs`

This is the single highest-impact task. It drains the existing backlog without touching production code.

- [ ] **Step 1: Study the existing Houston linker code path**

Read `src/app/api/cron/sync/route.ts` lines 5013-5167. This is the template. Understand:
- How `houstonBuildingAddrMap` is built (one query pages all `metro='houston'` buildings, normalizes each `full_address` via `normalizeAddressForLinking()`)
- How unlinked rows are paged and grouped by normalized address
- How auto-create works via `findOrCreateBuilding()`
- The update batching (chunks of 200 for `in(idColumn, ...)` updates)

- [ ] **Step 2: Extract the core logic into `scripts/deep-sweep-link.mjs`**

Port the in-memory linker pattern to a standalone Node script. Key differences from the existing cron path:

- **No 30-day `linkCutoff`.** Remove it. Sweep everything where `building_id IS NULL`.
- **Resumable via checkpoint file.** Write a local `.deep-sweep-checkpoint.json` after every completed metro+source pair: `{ "houston/complaints_311": { last_offset: 240000, completed: false } }`. On startup, resume from the last offset.
- **Reuse `normalizeAddressForLinking()` logic.** Copy the function verbatim from `route.ts` into `scripts/_addressNormalize.mjs` (new file) so both the script and the route stay in sync. Add a one-line comment at both call sites pointing to the other.
- **Run against one (metro, source) pair per invocation.** CLI: `node scripts/deep-sweep-link.mjs --metro houston --source complaints_311 [--dry-run] [--max-rows N]`.
- **Log aggressively.** Emit a JSON line per 1000 processed rows with `{ metro, source, scanned, matched, auto_created, unmatched, elapsed_ms }`.
- **Do not auto-create buildings on the first pass.** Add a `--auto-create` flag (default off). Auto-create on the first sweep adds risk; we want to see the "pure match" numbers first, then optionally re-run with `--auto-create` to mop up.

- [ ] **Step 3: Dry-run against Houston complaints_311**

```bash
node scripts/deep-sweep-link.mjs --metro houston --source complaints_311 --dry-run --max-rows 5000
```

This should:
- Load Houston buildings into memory (~one query, pages of 10K)
- Page 5000 unlinked complaints
- Report match / unmatched counts WITHOUT writing anything
- Complete in well under 60 seconds

If the "matched" rate on the dry run looks sensible (e.g. 30–70%), proceed. If it's near zero, there's a deeper bug — STOP and investigate.

- [ ] **Step 4: Live run on Houston complaints_311 (no auto-create)**

```bash
node scripts/deep-sweep-link.mjs --metro houston --source complaints_311
```

Expected to drop Houston's unlinked % substantially (the subset of unlinked rows that match existing buildings).

- [ ] **Step 5: Re-measure Houston**

```sql
select * from unlinked_violations_by_metro('houston');
```

Record the new `pct_unlinked` here as a plan comment.

- [ ] **Step 6: Repeat for Miami and LA**

Same sequence. LA will process the most rows (~1.7M unlinked); budget multiple hours. The script is resumable so breaking it into chunks is fine.

- [ ] **Step 7 (optional): Re-run with `--auto-create`**

For each metro, re-run with `--auto-create` to mop up addresses that clearly represent real buildings not yet in the buildings table. Review the first 50 auto-created rows manually before letting it run across all remaining.

---

## Task 3: Prevent Re-Accumulation

**Files:**
- Modify: `src/app/api/cron/sync/route.ts` (five linking blocks, one per metro)
- New (optional): `vercel.json` cron entry for a weekly deep-sweep

- [ ] **Step 1: Raise the per-run linkCutoff from 30 days to 365 days**

Search for `linkCutoff.setDate(linkCutoff.getDate() - 30)` and change to `- 365` in all 5 metro blocks. This isn't perfect (still a window) but it's cheap and turns "rows orphaned for 31 days" into "rows orphaned for 366 days", which is a much softer failure mode.

Confirm each of the 5 call sites uses the same pattern before changing — don't blindly replace.

- [ ] **Step 2: Add structured logging to each linking block**

After each metro's linker finishes, emit one JSON line:

```ts
console.log(JSON.stringify({
  evt: "link_sweep",
  metro: "houston",
  source: "complaints_311",
  scanned,
  matched,
  unmatched,
  auto_created,
  time_spent_ms: Date.now() - sweepStartMs,
  time_budget_hit: (Date.now() - startTime) / 1000 > 250,
}));
```

Mission Control (Task 4) scrapes these from `sync_log.errors` (or wherever cron output lands).

- [ ] **Step 3 (optional): Weekly deep-sweep cron**

Add a Vercel cron entry hitting `/api/cron/sync?mode=deep-sweep&metro=houston` weekly. Staggered days: Houston Mon, Miami Tue, LA Wed, Chicago Thu, NYC Fri. Each run is capped at the existing 280-second Vercel timeout; the script's checkpoint logic ensures progress accumulates across weeks.

Implementation: add a `mode=deep-sweep` branch to the cron handler at ~line 5265 that invokes the same logic as Task 2's script but runs inside the Next.js route. Can share code via a `src/lib/sync/deep-sweep.ts` module that both the script and the route import.

---

## Task 4: Surface in Mission Control

**Files:**
- Modify: `src/app/profile/mission-control/page.tsx`

- [ ] **Step 1: Add "Unlinked Violations" panel**

Server-side fetch `unlinked_violations_by_metro` for each metro (the RPC is already deployed per Task 1). Render a grid: rows = metro, columns = source (`dob_violations`, `complaints_311`, `nypd_complaints`, `hpd_violations`), cell = `pct_unlinked`.

Thresholds:
- Green: ≤10%
- Amber: 10–25%
- Red: >25%

Click a red cell to drill down via `unlinked_violations_sample(metro, source, 25)` showing raw address strings for eyeball inspection.

**Note:** The RPC times out on NYC and Chicago 311 (their partitions are huge). Wrap the fetch in a `try/catch` and show "query timeout — partition too large" in those cells. A follow-up optimization: add a materialized view refreshed nightly that pre-aggregates the counts per metro.

- [ ] **Step 2: Add sweep-log panel (optional)**

Parse the new `link_sweep` JSON lines from `sync_log.errors` and show last-7-days history of matches per metro. Low priority.

---

## Done When

- `unlinked_violations_by_metro('houston')` shows `complaints_311` at ≤20%
- `unlinked_violations_by_metro('miami')` shows `complaints_311` at ≤25%
- `unlinked_violations_by_metro('los-angeles')` shows `complaints_311` at ≤25%
- A random Houston / Miami / LA building page renders ≥1 311 complaint that previously didn't appear
- Mission Control shows the Unlinked Violations panel with at least Houston/Miami/LA quantified (NYC/Chicago can say "timeout")
- The 30-day linkCutoff has been raised to 365 days in all 5 metro blocks
- `scripts/deep-sweep-link.mjs` is idempotent (second run reports ~zero new matches)

---

## Things explicitly NOT in this plan (to save future-me time)

- ❌ Building a new `normalizeAddress()` library — one already exists at `route.ts:2128`
- ❌ Adding a `normalized_address` column on `buildings` — the in-memory map approach is faster and already works
- ❌ Rewriting `linkByAddress()` at line 548 — it doesn't touch 311; it's for NYC BBL/APN paths only
- ❌ Fixing Houston 311 ingestion to populate `parsed_house_num` / `parsed_street` — those columns are dead code; nothing reads them
- ❌ Migrating NYC/Chicago — not known to be broken; baselines deferred due to query timeout
