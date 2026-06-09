# LucidRents — Full-Site Optimization & Bug Audit

**Date:** June 9, 2026
**Stack:** Next.js 16.2 (App Router) · React 19 · Supabase (Postgres 17) · Tailwind 4 · Vercel · Upstash · Anthropic
**Method:** Static analysis across rendering, SEO, backend security, frontend correctness, and the data layer; plus live Supabase advisor lints, `tsc`, `vitest`, and a production build.

---

## TL;DR — Top priorities

| # | Severity | Issue | Where |
|---|----------|-------|-------|
| 1 | 🔴 Critical | Marketing API routes have **no auth** — anyone can read drafts/analytics, burn AI credits, delete data | `src/app/api/marketing/*` |
| 2 | 🔴 Critical | **55 SECURITY DEFINER functions executable by `anon`**; 62 functions with mutable `search_path` | Supabase |
| 3 | 🟠 High | **8 failing unit tests** (SEO JSON-LD + landlord FAQ bank) — drift between code and tests | `tests/lib/*` |
| 4 | 🟠 High | **752 MB of sitemap XML committed to git** (367 files) — bloats every clone/deploy | `public/sitemap/` |
| 5 | 🟠 High | Write endpoints (reviews, helpful votes) have **no rate limiting** | `src/app/api/reviews/*` |
| 6 | 🟡 Med | `kv-cache.ts` has an **inverted boolean** that disables Redis — but the file is **unused** (dead code) | `src/lib/kv-cache.ts` |
| 7 | 🟡 Med | Search/list race conditions; missing fetch cleanup in review wizard | `src/components/search/*`, `review/*` |
| 8 | 🟡 Med | `/api/search` browse path does `SELECT * … count:"exact"` on the buildings table | `src/app/api/search/route.ts:83` |
| 9 | 🟢 Low | SEO gaps: NewsArticle/FAQPage schema, building-page breadcrumb UI, search canonical query-string handling, robots lists only 3 of N sitemaps | various |

The codebase is, overall, **well-engineered** — see "What's already excellent" at the end. The critical items are concentrated in the marketing surface and the database permission grants.

---

## 1. Security (highest impact)

### 1.1 🔴 Unauthenticated marketing API — CONFIRMED
`src/proxy.ts` (Next 16 middleware) only password-gates `/mission-control/*` **pages**, and its matcher explicitly excludes `/api` (`matcher: "/((?!_next|api|…).*)"`). So every `/api/marketing/*` route must protect itself. Some do (`approve`, `approve-reddit` call `checkAdmin()`), but these do **not**:

- `GET /api/marketing/drafts` and `/drafts/[id]` — leaks all marketing draft content
- `POST /api/marketing/create-post`, `/generate-prompt`, `/generate-video` — anyone can spend Anthropic/AI-Gateway credits at will (`maxDuration = 120`)
- `POST /api/marketing/clear-failed` — anyone can delete drafts
- `GET /api/marketing/analytics`, `/reddit`, `/reddit/counts` — data disclosure

**Fix:** extract the existing `checkAdmin()` into `src/lib/marketing/auth.ts` and guard every handler (GET included). Return 401 when unauthenticated. ~30 min, mechanical.

### 1.2 🔴 Supabase: SECURITY DEFINER functions exposed to anon
Live advisor lints (0 ERROR, but high-impact WARNs):
- **55 functions** flagged `anon_security_definer_function_executable` *and* `authenticated_security_definer_function_executable` — they run with definer privileges, bypassing RLS, and are callable by unauthenticated users. Several are destructive ETL/admin mutators: `bulk_set_owner`, `rls_auto_enable`, `terminate_idle_advisory_locks`, `reset_pg_stat_statements`, `backup_reviews_batch`, `upsert_flood_zones_batch`.
  **Fix:** `REVOKE EXECUTE … FROM anon, authenticated` on all internal functions; keep grants only on the handful the public API legitimately calls. Docs: [lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- **62 functions** with `function_search_path_mutable` — add `SET search_path = ''` (schema-qualify references). Hijack risk, amplified by SECURITY DEFINER. [lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- **Leaked-password protection is OFF** — one toggle in Auth settings to check passwords against HaveIBeenPwned.
- Confirm deny-all RLS is intentional on `user_profiles`, `review_photos`, `review_amenities`, `crime_incidents` (RLS enabled, no policy → API returns 0 rows; the app may be reading these only via the service role).

### 1.3 🟠 No rate limiting on write endpoints
`/api/reviews` (POST), `/api/reviews/[id]/helpful` are authenticated (they call `auth.getUser()`) but have **no `checkRateLimit()`** — unlike `/api/search`. A logged-in user can spam reviews / inflate helpful votes. (`monitor` and `save` are also auth-gated and idempotent-ish, lower risk.) Add the same Upstash `checkRateLimit("reviews:"+userId)` guard already used on search.

### 1.4 🟠 Silently-swallowed DB errors in the review flow
In `src/app/api/reviews/route.ts`, several `.single()` calls destructure only `{ data }` and ignore `{ error }` (lines ~35, 55, 79, 181). `.single()` errors when 0 rows match, so the code reads `null` and falls through to *creating a duplicate unit* instead of failing. **Fix:** switch these reads to `.maybeSingle()` (returns `null`, no error on 0 rows) and check `error` on the rest.

### Done well
CRON_SECRET bearer checks on every cron; HMAC-signed mission-control cookies with constant-time compare; `safeRedirect()` prevents open redirect; Zod validation on review input; `escapeHtml()` before markdown render (no `dangerouslySetInnerHTML` XSS); service-role key strictly server-side; no `rls_disabled` tables, no SECURITY DEFINER views, `auth.users` not exposed.

---

## 2. Correctness / bugs

### 2.1 🟠 8 failing tests (`npm test` → 8 failed / 213 passed)
- `tests/lib/seo-jsonld.test.ts`: `buildingJsonLd` no longer emits `priceRange` (`$$`) and `@type` is now a single `"ApartmentComplex"` string, but tests expect `["ApartmentComplex","LocalBusiness"]`.
- `tests/lib/landlord-city-adapters.test.ts`: `faqBankForCity` now returns **7** items (test expects 6), and Chicago's RLTO / trend / operator / `{{portfolioRank}}` questions were renamed or moved.

Either the code regressed or the tests are stale — they need reconciling. `tsc --noEmit` passes and ESLint passes, so this is the only failing gate. (Note: `npm run lint` is itself broken — `next lint` was removed in Next 16 and the script errors with "Invalid project directory: lint"; migrate to ESLint CLI / `eslint .`.)

### 2.2 🟡 Production build instantiates a Supabase client at module load
`next build` fails in this sandbox at `/api/cron/sync-zillow-rents` with `supabaseUrl is required` because a client is created at **module top-level**. It builds on Vercel (env present) but the pattern is fragile and breaks CI/local builds without secrets. Move client creation inside the handler (lazy). Worth grepping for other top-level `createClient`/`createAdminClient` calls in route modules.

### 2.3 🟡 Search & wizard race conditions / leaks (frontend)
- `SearchBar.tsx` and `SearchOverlay.tsx`: rapid typing can let a slow earlier response overwrite a newer one (no request-sequence guard / AbortController on the display path). Add an incrementing `requestId` ref and ignore stale responses.
- `ReviewWizard.tsx` `handleBuildingSelect` and `BuildingStep.tsx` fetch amenities/search without `AbortController` → state-set-after-unmount warnings and stale overwrites. Add abort + cleanup.
- `mock/page.tsx:36` links to `/mock/wall` — the `wall/` dir exists but verify it renders; broader point below.

### 2.4 🟡 `kv-cache.ts` inverted condition (dead code, low impact)
`getRedis()` reads `if (!URL || UPSTASH_URL || !TOKEN || UPSTASH_TOKEN) return null` — the OR-fallback vars are un-negated, so setting them *disables* Redis. **But this module is imported nowhere** (the landlord `_data.ts` `cached` helper is a separate `unstable_cache` wrapper). Either delete `kv-cache.ts` or fix the condition before wiring it in:
```ts
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) return null;
```

---

## 3. Performance & efficiency

### 3.1 🟠 752 MB of sitemap XML committed to git
`public/sitemap/` holds **367 tracked `.xml` files (~752 MB)**, 10k URLs each. `.git` is already 115 MB of packed history from these. This inflates every clone, CI checkout, and Vercel build. **Fix:** generate sitemaps at build time (the `generate-sitemaps` script + cron already exist) or write them to Vercel Blob, and gitignore `public/sitemap/*.xml`. Keep only the index. This is the single biggest repo-hygiene/deploy-speed win.

### 3.2 🟡 `/api/search` browse path
`src/app/api/search/route.ts:83` — `.select("*", { count: "exact" })` on the wide `buildings` table for filter-only browse. Two fixes: select an explicit column list (reuse `BUILDING_COLUMNS`), and use `count: "planned"` (estimate) to avoid a full `COUNT(*)` that risks `statement_timeout`. The text-search path already does this correctly via the `search_buildings_ranked` RPC.

### 3.3 🟡 `/api/map/buildings`
Fetches up to 5000 buildings with `or=(violation_count.gt.0,complaint_count.gt.0)` **before** filtering by metro. Apply `metro=eq.<city>` first so a single city's map query doesn't scan all cities' flagged buildings.

### 3.4 🟢 Dead assets
- `Lucid Rents Fav Icon.png` (2.1 MB) and `Lucid Rents Logo.png` (2.2 MB) in the **repo root** are imported nowhere — 4.3 MB of dead weight, delete.
- `public/nyc-skyline.png` (613 KB) appears unreferenced (WebP variants are used) — verify and remove.

### 3.5 Database index hygiene (Supabase advisors)
- **7 duplicate index pairs** (e.g. `dob_violations`, `hpd_violations`, `evictions`, `bedbug_reports` each have `_date` *and* `_*_desc` indexes covering the same columns) — drop one of each; pure write-speed + storage win.
- **240 "unused index" lints across 92 tables** (buildings alone: 22). Don't bulk-drop — the perf-stats window resets weekly via cron — but review over a longer window; there is clear over-indexing.
- `monitored_buildings` RLS policies re-evaluate `auth.uid()` **per row** (`auth_rls_initplan`). Wrap as `(select auth.uid())` in all three policies.
- 2 unindexed FKs: `review_amenities.review_id`, `featured_news_history.article_id` — add covering indexes.

### Done well
On-demand ISR with empty `generateStaticParams` + `dynamicParams` for 50k+ building pages; Suspense-streamed building sections (parallel, not waterfall); `React.cache()` + `unstable_cache` with single-flight stampede protection on the activity feed; heavy libs (leaflet, recharts) dynamically imported `ssr:false`; AdSense deferred to first interaction, GA `lazyOnload`; fonts `display:swap`; preconnects for Supabase/Google; `v2-tokens.css` (127 KB) scoped to only building/landlord pages; well-tuned CDN `Cache-Control` headers; materialized views refreshed `CONCURRENTLY`; recent covering-index migration eliminated ~18 hrs/month of slow zip queries.

---

## 4. SEO (refresh of `SEO_AUDIT.md`)

**Most March-2026 criticals are FIXED:** logo now 47 KB, hero images are WebP via `<Image>`, `images.formats` set, default `og-image.jpg`, `WebSite`+`SearchAction` and `Organization` schema present, static pages now in the sitemap generator, comprehensive security headers (CSP currently report-only — flip to enforced after reviewing reports).

**Still open / new:**
- **NewsArticle JSON-LD** missing on `/[city]/news/[slug]` (only OG `article` type) — blocks Google News rich results.
- **FAQPage JSON-LD** missing on `/guides/nyc-tenant-rights` despite Q&A content.
- **Building pages** have breadcrumb JSON-LD but **no visible `<Breadcrumbs>` UI** (landlord/crime/neighborhood pages have both).
- **Search canonical** doesn't strip `?page`/`?sort` — duplicate-content risk; add base canonical + `rel=next/prev`.
- **`robots.ts` lists only 3 sitemaps** while the system emits more (hubs, landlords, building chunks) — list them all or point to a single index.
- Global `/search` metadata lacks full OpenGraph block.
- Add a `Place` schema to neighborhood pages; consider per-building dynamic OG images (`@vercel/og`).
- `llms.txt` / `llms-full.txt` exist (nice — AI-discoverability) but aren't linked via `<link rel="alternate">`.

---

## 5. Innovation opportunities

These build on data you already have and differentiate the product:

1. **Per-building dynamic OG images** (`@vercel/og`): render the building's grade, rent range, and violation count into the social card. Big CTR lift on shared links; directly leverages existing scores.
2. **"Should I sign?" verdict API + embeddable widget.** You already have `/embed/building/[id]` and `for-ai`/`llms.txt`. Package the verdict as a one-call JSON endpoint and a copy-paste embed — landlords/brokers linking back is free backlinks + brand.
3. **Saved-search & price/violation alerts.** You have `monitored_buildings` and a Resend pipeline. Let users subscribe to "notify me when a building in 11377 drops below $X or gets a new HPD violation." Recurring engagement + email list growth.
4. **Natural-language search** over the building corpus ("quiet rent-stabilized 1BR in Astoria with no recent violations") using the Anthropic SDK already in the stack + a structured query translator. Differentiator vs StreetEasy/Zillow.
5. **Neighborhood "risk score" composite + comparison tool** surfacing crime + flood + encampment + violation density you already sync — a single shareable letter grade per block.
6. **Cost lever:** benchmark `claude-haiku-4-5` for the daily news drafter (currently `claude-sonnet-4-6`, ~50 articles/day). If quality holds, ~5× cheaper output. Keep Sonnet/Opus for anything user-facing.

---

## What I verified vs. inferred
- **Verified by running:** `tsc` passes; `vitest` → 8 failures (listed); production build fails locally on a module-level Supabase client; ESLint script broken; 752 MB / 367 tracked sitemap files; `kv-cache.ts` unused; marketing routes lack auth; proxy excludes `/api`; reviews/monitor/save call `auth.getUser`; live Supabase advisor counts.
- **Inferred from agent code-reading (high confidence, not executed):** the search/wizard race conditions and the specific SEO schema gaps.

---

## Suggested order of work
1. **Today:** gate marketing API routes (1.1); enable leaked-password protection; reconcile or fix the 8 failing tests (3); delete the two 4.3 MB root PNGs.
2. **This week:** REVOKE EXECUTE on internal SECURITY DEFINER functions + pin `search_path` (1.2); rate-limit review writes (1.3); fix `.single()`→`.maybeSingle()` (1.4); stop committing sitemaps + gitignore (3.1).
3. **Next:** search/wizard race fixes; `/api/search` column+count fix; drop duplicate indexes + fix `monitored_buildings` RLS; SEO schema additions.
4. **Roadmap:** dynamic OG images, alerts, NL search, Haiku cost test.
