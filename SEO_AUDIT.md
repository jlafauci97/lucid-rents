# LucidRents SEO Audit Report

**Date:** March 17, 2026
**Site:** https://lucidrents.com
**Framework:** Next.js 16.1.6 (App Router) + React 19
**Pages:** ~40 page types, 50,000+ dynamic building pages

---

## Overall SEO Score: 72 / 100

| Category                        | Score | Max | Grade |
|---------------------------------|-------|-----|-------|
| Meta Tags & Title Strategy      | 14    | 15  | A     |
| Structured Data (JSON-LD)       | 10    | 15  | B-    |
| Sitemap & Robots.txt            | 11    | 12  | A     |
| Canonical URLs                  | 9     | 10  | A     |
| Open Graph & Social             | 8     | 10  | B     |
| Image Optimization              | 3     | 10  | F     |
| Performance & Core Web Vitals   | 5     | 10  | D     |
| Internal Linking & Navigation   | 6     | 8   | B-    |
| Content & Heading Hierarchy     | 8     | 10  | B     |

---

## 1. Meta Tags & Title Strategy — 14/15 (A)

### What's Working Well
- Root layout defines `metadataBase`, default title, title template (`%s | Lucid Rents`), and description
- All 9 dynamic page types use `generateMetadata()` for data-driven titles/descriptions
- All static pages export `metadata` objects with unique titles and descriptions
- Keywords meta tag defined at root level
- `lang="en"` set on `<html>` element

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| M1 | Low | Search page `generateMetadata` only sets title, no description or OG tags | `src/app/[city]/search/page.tsx:17-24` |
| M2 | Low | Compare page has no canonical URL or OG tags | `src/app/[city]/compare/page.tsx:12-16` |
| M3 | Info | Homepage has no page-level metadata export (relies on root defaults only) — consider adding explicit OG image | `src/app/page.tsx` |

---

## 2. Structured Data (JSON-LD) — 10/15 (B-)

### What's Working Well
- `ApartmentComplex` schema on building pages with address, year built, units, aggregate rating
- `Organization` schema on landlord pages
- `CollectionPage` schema on news pages
- `BreadcrumbList` schema on news pages and sub-pages
- `ItemList` schema on buildings directory and borough pages
- Reusable `<JsonLd>` component and generator functions in `src/lib/seo.ts`

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| S1 | High | **No `WebSite` schema with `SearchAction`** on homepage — prevents sitelinks search box in Google SERPs | `src/app/page.tsx` |
| S2 | High | **No `LocalBusiness` or `Organization` schema** for the site itself — Google doesn't understand the entity behind the site | `src/app/layout.tsx` |
| S3 | Medium | No `FAQPage` schema on guides page — missed rich result opportunity | `src/app/guides/nyc-tenant-rights/page.tsx` |
| S4 | Medium | No `Article` or `NewsArticle` schema on individual news article pages (only `CollectionPage` used) | `src/app/[city]/news/[slug]/page.tsx` |
| S5 | Medium | Neighborhood and crime pages use inline JSON-LD instead of typed schemas — no recognized schema type | `src/app/[city]/crime/[zipCode]/page.tsx` |
| S6 | Low | Building JSON-LD uses `numberOfRooms` for units — `numberOfAccommodationUnits` is more semantically accurate | `src/lib/seo.ts:98` |

---

## 3. Sitemap & Robots.txt — 11/12 (A)

### What's Working Well
- Dynamic multi-part sitemap covering 50,000+ buildings in 45K batches
- Static sitemap includes all page types: boroughs, neighborhoods, crime, subway lines, landlords, news categories
- `robots.ts` correctly blocks `/api/`, `/dashboard/`, `/review/new`
- Sitemap URLs explicitly listed in robots.txt (16 sitemaps)
- `force-dynamic` ensures fresh sitemap data
- Priority values and change frequencies properly assigned

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| SM1 | Medium | **Static pages missing from sitemap:** `/about`, `/contact`, `/privacy`, `/terms`, `/guides/nyc-tenant-rights` | `src/app/sitemap.ts:53-86` |
| SM2 | Low | Hardcoded 16 sitemap references in `robots.ts` — should dynamically match `generateSitemaps()` count | `src/app/robots.ts:7` |
| SM3 | Low | No `lastModified` on static sitemap entries | `src/app/sitemap.ts:57-61` |

---

## 4. Canonical URLs — 9/10 (A)

### What's Working Well
- `canonicalUrl()` helper generates consistent absolute URLs
- Canonical set on all major page types via `alternates: { canonical: ... }`
- Middleware handles 301 redirects for old URLs (`/rankings` -> `/nyc/worst-rated-buildings`, bare zip neighborhoods)
- City-less routes redirect to city-prefixed versions

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| C1 | Medium | **Search page has no canonical URL** — risk of duplicate content with query params | `src/app/[city]/search/page.tsx` |
| C2 | Low | Compare page has no canonical URL | `src/app/[city]/compare/page.tsx` |
| C3 | Low | Homepage has no explicit canonical (relies on `metadataBase` inference) | `src/app/page.tsx` |

---

## 5. Open Graph & Social — 8/10 (B)

### What's Working Well
- Root layout sets default `og:type` and `twitter:card`
- Dynamic pages (buildings, news, landlords, neighborhoods, crime, energy, etc.) generate full OG tags
- Twitter card set to `summary_large_image`
- `og:locale` set on key pages

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| OG1 | High | **No default `og:image`** — shared links have no preview image on social media | `src/app/layout.tsx:42-48` |
| OG2 | Medium | No page-specific OG images for building pages (could auto-generate or use map thumbnail) | Building pages |
| OG3 | Low | Search, compare, feed, rent-stabilization pages have limited or no OG tags | Various |

---

## 6. Image Optimization — 3/10 (F)

### Critical Issues
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| I1 | **Critical** | **Logo PNG is 2.1 MB** — should be < 50 KB. Serves uncompressed on every page load | `public/lucid-rents-logo.png` |
| I2 | **Critical** | **Logo SVG is 2.2 MB** — SVGs should rarely exceed 50 KB. Likely contains embedded raster data | `public/lucid-rents-logo.svg` |
| I3 | **Critical** | **Hero background image is 900 KB** — loaded via CSS `background-image`, bypasses Next.js Image optimization entirely | `src/app/page.tsx:41` |
| I4 | High | `next.config.ts` is empty — no image optimization config, no `images.formats` for WebP/AVIF | `next.config.ts` |
| I5 | Medium | Hero background uses CSS `url()` instead of `<Image>` — no lazy loading, no responsive sizing, no format optimization | `src/app/page.tsx:41` |
| I6 | Medium | News card images use `alt=""` (empty alt) — should have descriptive alt text | `src/components/news/NewsCard.tsx:66` |
| I7 | Low | Only 3 `alt` text instances found across the entire codebase — most images/icons lack alt descriptions | Global |

---

## 7. Performance & Core Web Vitals — 5/10 (D)

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| P1 | **Critical** | **5+ MB of images loaded on homepage** (2.1 MB logo + 900 KB skyline + SVG) — destroys LCP | Homepage |
| P2 | High | **Google Analytics loaded on all pages** including server-rendered ones — blocks interactivity (FID/INP) | `src/app/layout.tsx:62-73` |
| P3 | High | No `next.config.ts` optimizations: no `images.formats`, no `compress`, no security headers | `next.config.ts` |
| P4 | Medium | Leaflet/Recharts loaded on pages that use them but not dynamically imported — increases bundle for all routes | `package.json` |
| P5 | Medium | No font `display: swap` explicitly set (Geist may default to it, but not verified) | `src/app/layout.tsx:13-21` |
| P6 | Low | No `<link rel="preconnect">` for Google Analytics or Supabase domains | `src/app/layout.tsx` |

### What's Working Well
- ISR with sensible revalidation times (30 min to 24 hours)
- Server components by default reduces client JS
- `priority` attribute on above-the-fold logo image
- Turbopack for dev builds

---

## 8. Internal Linking & Navigation — 6/8 (B-)

### What's Working Well
- Footer contains links to key pages
- Navbar provides primary navigation
- Building pages link to landlord, neighborhood, and crime pages
- Breadcrumbs on news pages with JSON-LD
- City-scoped URL structure provides clear hierarchy

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| IL1 | Medium | **No breadcrumbs on building, landlord, crime, or neighborhood pages** — only news pages have them | Various |
| IL2 | Medium | Homepage has no direct links to category pages (buildings, landlords, neighborhoods, etc.) — relies only on search | `src/app/page.tsx` |
| IL3 | Low | No "related buildings" or "nearby buildings" cross-links on individual building pages | Building page |

---

## 9. Content & Heading Hierarchy — 8/10 (B)

### What's Working Well
- Proper `<h1>` on homepage and all page types
- Logical `<h1>` -> `<h2>` -> `<h3>` hierarchy on homepage
- Semantic HTML: `<section>`, `<main>`, `<article>`, `<nav>`, `<footer>`
- Homepage has substantial SEO-friendly content ("How Lucid Rents Works" section with ~200 words)
- Descriptive, keyword-rich page descriptions

### Issues Found
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| H1 | Medium | Homepage `<h1>` is "Check Your Building" — generic, should include "NYC Apartments" or primary keyword | `src/app/page.tsx:56-58` |
| H2 | Low | No `<article>` semantic wrapper on individual news article content | News pages |

---

## Remediation Plan

### Phase 1: Critical Fixes (Week 1) — Estimated Impact: +15 points

| Priority | Task | Issues Addressed | Effort |
|----------|------|------------------|--------|
| P0 | **Compress/optimize all images** — Convert logo to optimized PNG (<50KB) or proper SVG. Compress skyline to WebP (<100KB). | I1, I2, I3, P1 | 2 hours |
| P0 | **Add `images.formats` and optimization config** to `next.config.ts` | I4, P3 | 30 min |
| P0 | **Convert hero background to `<Image>`** component with responsive sizing | I5 | 1 hour |
| P0 | **Add default OG image** to root layout metadata | OG1 | 30 min |

### Phase 2: High-Impact SEO Improvements (Week 2) — Estimated Impact: +8 points

| Priority | Task | Issues Addressed | Effort |
|----------|------|------------------|--------|
| P1 | **Add `WebSite` schema with `SearchAction`** to homepage | S1 | 1 hour |
| P1 | **Add `Organization` schema** to root layout | S2 | 30 min |
| P1 | **Add missing static pages to sitemap** (`/about`, `/contact`, `/privacy`, `/terms`, `/guides/*`) | SM1 | 30 min |
| P1 | **Add breadcrumbs** to building, landlord, neighborhood, and crime pages | IL1 | 3 hours |
| P1 | **Add security headers** to `next.config.ts` (X-Frame-Options, CSP, etc.) | P3 | 1 hour |
| P1 | **Add `<link rel="preconnect">`** for Google Analytics and Supabase | P6 | 15 min |

### Phase 3: Medium-Priority Enhancements (Week 3) — Estimated Impact: +5 points

| Priority | Task | Issues Addressed | Effort |
|----------|------|------------------|--------|
| P2 | **Add `NewsArticle` schema** on individual news article pages | S4 | 1 hour |
| P2 | **Add `FAQPage` schema** to tenant rights guide | S3 | 1 hour |
| P2 | **Add canonical URLs** to search and compare pages | C1, C2 | 30 min |
| P2 | **Add descriptive alt text** to news card images and all image instances | I6, I7 | 1 hour |
| P2 | **Add homepage links** to category pages (buildings, landlords, neighborhoods, crime, etc.) | IL2 | 2 hours |
| P2 | **Improve homepage `<h1>`** to include primary keywords (e.g., "Check Your NYC Apartment Building") | H1 | 15 min |
| P2 | **Add full metadata** to search page (description, OG, canonical) | M1 | 30 min |

### Phase 4: Polish & Monitoring (Week 4) — Estimated Impact: +2 points

| Priority | Task | Issues Addressed | Effort |
|----------|------|------------------|--------|
| P3 | Dynamic sitemap count in `robots.ts` to match `generateSitemaps()` | SM2 | 30 min |
| P3 | Add `lastModified` dates to static sitemap entries | SM3 | 15 min |
| P3 | Add explicit canonical on homepage | C3 | 15 min |
| P3 | Use `numberOfAccommodationUnits` in building JSON-LD | S6 | 15 min |
| P3 | Set up Google Search Console monitoring for Core Web Vitals | — | 1 hour |
| P3 | Implement dynamic `og:image` generation for building pages (e.g., via `@vercel/og`) | OG2 | 4 hours |

---

## Projected Score After Remediation

| Category                        | Current | After Phase 1 | After All Phases |
|---------------------------------|---------|---------------|------------------|
| Meta Tags & Title Strategy      | 14/15   | 14/15         | 15/15            |
| Structured Data (JSON-LD)       | 10/15   | 10/15         | 14/15            |
| Sitemap & Robots.txt            | 11/12   | 11/12         | 12/12            |
| Canonical URLs                  | 9/10    | 9/10          | 10/10            |
| Open Graph & Social             | 8/10    | 9/10          | 10/10            |
| Image Optimization              | 3/10    | 8/10          | 9/10             |
| Performance & Core Web Vitals   | 5/10    | 8/10          | 9/10             |
| Internal Linking & Navigation   | 6/8     | 6/8           | 8/8              |
| Content & Heading Hierarchy     | 8/10    | 8/10          | 10/10            |
| **Total**                       | **72**  | **83**        | **95+**          |

---

## Summary

LucidRents has a **solid SEO foundation** — proper use of Next.js metadata API, dynamic sitemaps for 50K+ pages, canonical URLs, structured data on key pages, and sensible ISR caching. The site architecture is well-suited for search engines.

The **biggest weakness is image optimization** — the homepage loads 5+ MB of images, with the logo alone at 2.1 MB. This severely impacts Core Web Vitals (LCP, FCP) and will hurt rankings. Fixing images alone could boost the score by 10+ points.

The second priority is **expanding structured data** (WebSite search action, Organization schema, NewsArticle) and **adding breadcrumbs** across more page types to unlock rich results in Google SERPs.

All critical issues can be resolved in the first two weeks with moderate effort, bringing the score from 72 to ~90.
