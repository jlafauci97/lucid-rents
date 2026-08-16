# LucidRents SEO Audit Report

**Date:** August 15, 2026 (supersedes March 17, 2026 audit)
**Site:** https://lucidrents.com
**Framework:** Next.js App Router + React 19
**Scale:** ~2.0M building pages + ~0.87M landlord pages in sitemaps (March audit said 50K), 5 metros
**Method:** Full code re-audit (3 parallel deep passes) + live Lighthouse runs (mobile emulation) + production TTFB/cache measurements

---

## Overall Score: 65 / 100 (was 72, but measuring different problems)

| Category                        | Mar 2026 | Aug 2026 | Trend |
|---------------------------------|----------|----------|-------|
| Meta Tags & Title Strategy      | 14/15    | 12/15    | ▼ new news-canonical bug |
| Structured Data (JSON-LD)       | 10/15    | 12/15    | ▲ all 4 old gaps fixed |
| Sitemap & Robots.txt            | 11/12    | 4/12     | ▼▼ frozen pipeline, 404s |
| Canonical URLs                  | 9/10     | 6/10     | ▼ redirects are 307, canonical→redirect |
| Open Graph & Social             | 8/10     | 8/10     | ▲ og:image fixed; twitter:image regressed |
| Image Optimization              | 3/10     | 8/10     | ▲▲ essentially fixed |
| Performance & Core Web Vitals   | 5/10     | 4/10     | ▼ cold TTFB up to 8.6s |
| Internal Linking & Navigation   | 6/8      | 3/8      | ▼▼ 2.9M pages are link-orphans |
| Content & Heading Hierarchy     | 8/10     | 8/10     | — (not re-assessed) |

**The March audit's headline problems (images, missing schemas) are fixed. The real problems today are invisible to a page-level audit: the sitemap pipeline is frozen, the page corpus is unreachable by crawling links, the highest-value on-page content never reaches the HTML, and cold building pages take 3.4–8.8s to render server-side.**

---

## Live measurements (Aug 15, 2026, Lighthouse mobile + curl)

| Page | Perf | LH SEO | LCP | TBT | TTFB |
|------|------|--------|-----|-----|------|
| Homepage | 50 | 100 | 5.7s | 1,480ms | 190ms |
| Building page (cold) | 48 | 100 | 4.9s | 1,270ms | **8,650ms** |
| /nyc/neighborhoods | 73 | 100 | 2.4s | 1,160ms | 130ms |

- Building-page TTFB by cache state: **HIT ~0.2s / MISS 3.4–8.8s** (3 URLs sampled). With ~2M pages, Googlebot predominantly hits cold pages.
- CLS is 0 everywhere tested. Images are optimized (AVIF/WebP, correct `priority`/`sizes`). The JS story is the drag: 3.3–4.0s script boot-up, GTM is the single heaviest resource (166KB).

---

## Critical findings (fix these first)

### C1. Production sitemaps are frozen static files; the live pipeline never runs
Three sitemap generations coexist:
- **Serving prod:** hand-run `scripts/generate-sitemaps.mjs` → 367 committed files in `public/sitemap/` (612MB in the repo). Not in `build`, not in any cron. Every `lastmod` reads 2026-05-26; last regenerated ~2026-07-27.
- **Dead:** the Blob pipeline (`src/lib/sitemap/generator.ts`, 758 lines) — its cron `api/cron/regenerate-sitemaps` is **not in vercel.json**; its serving route `sitemap-v2/[chunk]` is referenced by nothing.
- **Dead:** `api/sitemap-xml/**` Supabase-Storage proxy, blocked by robots anyway.

Google has received zero freshness signal for ~2.9M URLs for ~3 months. **Action:** pick one pipeline (schedule the Blob cron + point robots/rewrites at it, or cron the script), delete the other two, make `lastmod` flow from `updated_at`.

### C2. Cold building pages take 3.4–8.8s of server render
`revalidate = 604800` (7 days) with empty `generateStaticParams` means nearly every Googlebot visit to the 2M-page corpus is a cache miss paying full render cost. Google throttles crawl on slow servers — this compounds C1. **Action:** profile the blocking data path in [page.tsx](src/app/[city]/building/[borough]/[slug]/page.tsx) — the shell above the first `Suspense` boundary should render in <500ms; everything slow should stream.

### C3. Highest-value content and links never reach the HTML (`LazyOnScroll`)
[LazyOnScroll.tsx](src/components/building/v2/streaming/LazyOnScroll.tsx) is a client component gating render on IntersectionObserver — SSR emits only skeletons. Hidden behind it on every building page ([page.tsx:365-416](src/app/[city]/building/[borough]/[slug]/page.tsx)): the **FAQ section** (and any FAQPage JSON-LD inside it), **crime/about-this-area prose**, **city insight sections** (rent stabilization, Ellis Act, soft-story), and **S08SimilarNearby — the only building→building link block on the site**. The server already runs all 12 data loaders and serializes the results into the flight payload, so `LazyOnScroll` saves nothing on server or wire — it only hides content from crawlers. **Action:** delete the `LazyOnScroll` wrappers (the existing `Suspense`/`*Streamed` pattern already provides streaming); hoist any JSON-LD to page level.

### C4. The 2.9M-page corpus is link-orphaned (sitemap-only)
- [buildings/[borough]/page.tsx:72](src/app/[city]/buildings/[borough]/page.tsx) hardcodes `page = 1`; every `?page=N` link serves identical page-1 content and canonicalizes to page 1. Link-reachable buildings ≈ 25 per borough hub out of ~2M.
- [landlords/page.tsx:206](src/app/[city]/landlords/page.tsx) — same bug; ~870K landlord pages reachable only via ~36 curated links.
- Building→building links are inside `LazyOnScroll` (C3).
- News index/category lists are client-fetched (`NewsListClient`), so ~5,000 articles are also sitemap-only. A server-rendered `NewsListSection.tsx` exists, unused.

**Action:** make pagination real (self-referential canonicals) or add A–Z/street index hubs; swap news lists to the server component.

### C5. Slug changes 404 instead of 301, and canonical redirects are 307
`building_slug_redirects` exists in the DB but **no code reads it** — a renamed slug hits `notFound()` ([page.tsx:255-271](src/app/[city]/building/[borough]/[slug]/page.tsx)), dropping link equity. Canonical-city corrections use `redirect()` (307 temporary) instead of `permanentRedirect()`; Google won't consolidate signals on 307s. **Action:** wire the redirects table in before `notFound()`; switch to `permanentRedirect()` here and in [landlord/[name]/buildings/page.tsx:90,95](src/app/[city]/landlord/[name]/buildings/page.tsx).

---

## High findings

| ID | Issue | Location |
|----|-------|----------|
| H1 | News article canonicals omit the city prefix → every canonical points at a redirect; LA/Chicago articles canonicalize to the wrong city's URL. Same bug in NewsArticle `url` + breadcrumbs. Sitemap emits the city-prefixed form, so sitemap and canonical disagree. | [news/[slug]/page.tsx:37,67,259,285-291](src/app/[city]/news/[slug]/page.tsx) |
| H2 | Sitemap emits guaranteed 404s: `/scaffolding`, `/permits`, `/energy` (per city), `/guides/la-tenant-rights`. The two generators have drifted (script vs generator.ts static lists). | [generator.ts:297,302](src/lib/sitemap/generator.ts), [generate-sitemaps.mjs:267](scripts/generate-sitemaps.mjs) |
| H3 | ~15 real, nav-linked page types missing from sitemaps (rankings, problem-landlords, affordable-housing, heating-tracker, lead-safety, tenant-tools/checklist, neighborhood-risks, etc.), plus all building/landlord sub-pages (reviews/violations/timeline/units — 3×2M + 3×0.87M URLs). | [generator.ts](src/lib/sitemap/generator.ts) |
| H4 | News article hero is a raw `<img>` with no dimensions — unoptimized, CLS-inducing LCP on every article. Root cause: Pexels not in `remotePatterns` (only Unsplash/loremflickr), but the image pipeline prefers Pexels. | [news/[slug]/page.tsx:334](src/app/[city]/news/[slug]/page.tsx), [next.config.ts:7-10](next.config.ts) |
| H5 | JS main-thread cost: 3.3–4.0s boot-up on mobile on all pages tested; GTM 166KB. Contributes 1.1–1.5s TBT everywhere. | site-wide, [layout.tsx:137-154](src/app/layout.tsx) |

---

## Medium findings

| ID | Issue | Location |
|----|-------|----------|
| M1 | robots.ts doesn't disallow `/mission-control/`, `/mock/` (16 prototype pages), `/embed/`. Footer links site-wide to robots-blocked `/review/new`. | [robots.ts:22-32](src/app/robots.ts), [Footer.tsx:136](src/components/layout/Footer.tsx) |
| M2 | Homepage title renders doubled: `Lucid Rents — Apartment Building Intelligence \| Lucid Rents` (root template applies to `app/page.tsx`). Needs `title: { absolute }`. | [page.tsx:13](src/app/page.tsx) |
| M3 | News category pages say "NYC Housing News" for all five metros. | [news/[slug]/page.tsx:33](src/app/[city]/news/[slug]/page.tsx) |
| M4 | City home pages render a visible FAQ (`CityFaq`) with no FAQPage JSON-LD (component emits no schema, unlike `FAQSection`). | [CityFaq.tsx](src/components/home/CityFaq.tsx) |
| M5 | NewsArticle schema too thin to qualify for rich results: publisher without logo, no `mainEntityOfPage`/`dateModified`. Article OG images never set despite `image_url` in DB. | [news/[slug]/page.tsx:255-272](src/app/[city]/news/[slug]/page.tsx) |
| M6 | Hardcoded `twitter.images` in root layout overrides the six dynamic opengraph-image routes — building/landlord/neighborhood shares get generic twitter cards. Root also double-declares og:image (static + file-based). | [layout.tsx:94-105](src/app/layout.tsx) |
| M7 | Homepage news grid + region grid use CSS `backgroundImage` with raw remote URLs — unoptimized, no lazy-load, no preconnect. | [HomepageNewsGrid.tsx:99](src/components/home/HomepageNewsGrid.tsx), [RegionGrid.tsx:33](src/components/home/RegionGrid.tsx) |
| M8 | Breadcrumb sends the borough crumb to `/building-rankings` instead of `/buildings/[borough]` — the borough hub loses ~2M inbound links. | [Crumbs.tsx:43](src/components/building/v2/Crumbs.tsx) |
| M9 | Missing canonicals: `/seismic-fire-safety`, unit pages. Dead `[city]/rankings` page carries a wrong canonical. | [seismic-fire-safety/page.tsx:29-35](src/app/[city]/seismic-fire-safety/page.tsx), [unit/[unitId]/page.tsx:43-46](src/app/[city]/building/[borough]/unit/[unitId]/page.tsx) |
| M10 | 8 AdSense slots per building page (5 in-content + 3 rail). Loader deferral is excellent, but slot count is the largest remaining interaction-time tax. | [page.tsx:355-368,405](src/app/[city]/building/[borough]/[slug]/page.tsx) |
| M11 | `images.minimumCacheTTL` unset (60s default) — optimizer re-fetches remote originals constantly. Set ~31 days. | [next.config.ts](next.config.ts) |

---

## Low findings

- Dead code that muddies the SEO picture: `Deferred*` components in `src/components/building/` (5 files, orphaned by the v2 rebuild), `SameLandlordBuildings.tsx`, `NearbyBuildings.tsx` (building-level), unused `NewsListSection.tsx`.
- Unreferenced large assets: `public/nyc-skyline.png` (612KB), `miami-skyline.jpg` (688KB), `nyc-skyline.jpg` (430KB); wordmark PNG 357KB for a 200px render.
- `public/sitemap/` is 612MB committed to git — dominates clone/deploy; move to Blob or build-time generation (folds into C1).
- Four Google font families loaded; verify Geist Sans is actually used (body defaults to Sora).
- Landlord Organization schema lacks `address`/`areaServed`; several data pages (air-quality, fire-safety, ellis-act, landlords index, building-rankings…) emit no JSON-LD where the existing `Dataset`/`ItemList` pattern would fit.
- Root opengraph-image alt still says "Know Your NYC Apartment" (site is 5 metros). No `twitter.site` handle despite X profile in Organization schema.
- Sitemap still lists redirecting `/worst-rated-buildings` and `/map` per city.
- `framer-motion` is the only heavy dep in shared chunks without a dynamic boundary (`FadeIn`, `GradeBar` — both replaceable with CSS).

---

## What's fixed since March (do not re-fix)

- ✅ WebSite + SearchAction, Organization schema, FAQPage on guides, NewsArticle schema — all present.
- ✅ Images: AVIF/WebP formats, `next/image` with correct `priority`/`sizes`/alt, logo compressed, hero optimized. CLS = 0.
- ✅ Charts (recharts) and maps (leaflet) properly code-split behind `next/dynamic` with skeletons.
- ✅ Fonts via `next/font`, `display: swap`, self-hosted.
- ✅ Third-party scripts well-deferred; interaction-gated AdSense loader is better than standard practice.
- ✅ ISR everywhere it matters: 69 pages with `revalidate`, zero SEO routes `force-dynamic`.
- ✅ Six dynamic OG image routes; default og:image present.
- ✅ Breadcrumbs (visual + JSON-LD) on ~35 page types.

---

## Remediation plan (ordered by impact)

**Phase 1 — Crawl infrastructure (the compounding fixes)**
1. Consolidate to one sitemap pipeline, scheduled, with real per-URL `lastmod`; delete the other two (C1). Add missing page types + building/landlord sub-pages; remove 404/redirect URLs (H2, H3).
2. Profile and fix cold building-page TTFB to <500ms shell (C2).
3. Remove `LazyOnScroll` wrappers on the building page (C3).
4. Wire `building_slug_redirects` + switch 307→`permanentRedirect` (C5).

**Phase 2 — Crawl paths & canonicals**
5. Real pagination on borough + landlord directories (C4); server-render news lists.
6. Fix news canonical city-prefix bug (H1); fix borough breadcrumb target (M8); add missing canonicals (M9).
7. robots.ts disallows + footer link fix (M1).

**Phase 3 — On-page polish**
8. Pexels in remotePatterns + news hero → `<Image>` (H4); homepage grids off CSS backgrounds (M7).
9. Homepage title fix (M2), news category city names (M3), CityFaq JSON-LD (M4), NewsArticle enrichment + OG images (M5), twitter image fix (M6).
10. Trim ad slots if business allows (M10); `minimumCacheTTL` (M11); dead-code deletion; asset cleanup.
