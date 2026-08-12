# Building Page PageSpeed Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the building detail page (`/[city]/building/[borough]/[slug]`) from a Lighthouse **lab** perf score of **59** to **≥ 90**, drive CLS from **0.189 → < 0.10** and TBT from **1,170 ms → < 300 ms**, **without any visible UI changes**. Field CWV already pass (LCP 1.2s / INP 58ms / CLS 0.08) — this work is to make the lab pass too, which Google uses for crawl-budget signals.

**Architecture:** Five phases sequenced by impact/effort. Each phase produces a measurable Lighthouse delta and ships independently. No UI redesign — fixes are loading-strategy, skeleton-height, CSS-splitting, hydration-deferral, and cache-header tuning. The streaming Suspense boundaries already in place are kept; we're tightening the bytes that ship into them and reserving correct layout space for what streams in.

**Tech Stack:** Next.js 16.1 App Router · React 19.2 · TypeScript · Recharts · react-leaflet · Supabase · `next/font/google`.

**Spec:** `/Users/jesselafauci/Downloads/PageSpeed Insights.pdf` (Lighthouse desktop report for `lucidrents.com/nyc/building/bronx/16-richman-plaza-bronx-ny-10453`, captured 2026-05-26).

**Prior work to NOT re-do:** [`docs/perf-round-2-notes.md`](../../perf-round-2-notes.md) already shipped DB composite indexes + edge runtime on 4 read-only API routes + ISR caching. This plan is about the **client-side rendering** half — JS shipped, layout shift, CSS critical path.

---

## Constraint: No UI Changes

Every task in this plan is invisible to users. Specifically:

- **Allowed:** changing skeleton dimensions, deferring hydration, code-splitting client bundles, inlining critical CSS, adding `loading="lazy"`, `decoding="async"`, `width`/`height` attrs, adjusting cache headers, swapping component imports for `dynamic()`, adding `requestIdleCallback` wrappers, moving `"use client"` boundaries deeper.
- **Forbidden** (defer to a separate redesign plan if needed): visual layout changes, color tweaks, spacing changes, copy edits, swapping fonts, removing sections, reordering content, changing component markup output.

Two Lighthouse items intentionally **out of scope** here because they would require UI/design decisions: (a) contrast ratio (Accessibility 96), (b) heading hierarchy fix (Accessibility 96). Both flagged in Phase 5 with explicit "Defer for design review" markers — agent does NOT execute them.

---

## Diagnosis Summary (from PDF)

**Desktop lab metrics:**
| Metric | Current | Target | Severity |
|---|---|---|---|
| Performance score | 59 | ≥ 90 | High |
| FCP | 0.3s | < 1.8s | ✅ pass |
| LCP | 0.7s | < 2.5s | ✅ pass |
| TBT | **1,170 ms** | < 200 ms | **HIGH** |
| CLS | **0.189** | < 0.10 | **HIGH** |
| Speed Index | 1.7s | < 3.4s | ✅ pass |

**Top Lighthouse opportunities (in order of estimated impact):**
1. Layout shift culprits → CLS (0.189 → < 0.10)
2. Forced reflow + long main-thread tasks (17 found) → TBT
3. Reduce unused JS — 363 KiB savings
4. Reduce JS execution time — 2.5s
5. Render-blocking requests — 180 ms savings
6. Use efficient cache lifetimes — 156 KiB savings
7. Legacy JS — 14 KiB savings
8. Font display — 10 ms savings
9. Image delivery — 5 KiB savings
10. Optimize DOM size

**Root-cause map (from code audit):**

| Audit Item | Confirmed Cause | File |
|---|---|---|
| CLS 0.189 | `HeroFallback` reserves `minHeight: 300` for verdict aside but real `HeroV2` verdict is ~500-650px tall (4 axis rows + grade + recommendations) | `src/components/building/v2/streaming/HeroV2Streamed.tsx:52-60` |
| CLS 0.189 | `HeroFallback` leasing-card reserves `minHeight: 120` but real card has rent range + CTA buttons (~200px) | `src/components/building/v2/streaming/HeroV2Streamed.tsx:42-50` |
| CLS 0.189 | `SectionSkeleton` reserves fixed `height: 280` for every section, but real sections range 320-900px | `src/components/building/v2/streaming/SectionSkeleton.tsx:33-41` |
| CLS / Best Practices | Recharts canvases hydrate with slightly different heights than their loading skeleton | `src/components/building/SubmarketTrendsChart.tsx:13-19` |
| Unused JS 363 KiB | `RentHistoryChart` + `ViolationTrend` import recharts **synchronously** (only `SubmarketTrendsChart` uses `dynamic()`) — recharts ships in the main building page chunk | `src/components/building/RentHistoryChart.tsx:4-15`, `src/components/building/ViolationTrend.tsx:4-12` |
| 17 long tasks | `WayfinderRail` runs `IntersectionObserver` over 11 section anchors on mount, eagerly, on every page | `src/components/building/v2/WayfinderRail.tsx:36-55` |
| 17 long tasks | `BigMap` is `"use client"` and eagerly hydrates whenever `S06 Location` is in the rendered tree (no `LazyOnScroll` wrapper) | `src/app/[city]/building/[borough]/[slug]/page.tsx:304` |
| 17 long tasks | `ScrollToTopOnNav` mounts on every page (root layout), runs two `useEffect`s eagerly | `src/app/layout.tsx:148`, `src/components/layout/ScrollToTopOnNav.tsx:18-37` |
| Render-blocking 180ms | `v2-tokens.css` is **128 KB / 3,616 lines** and ships as a render-blocking `<link>` | `src/styles/v2-tokens.css` (imported at `src/app/[city]/building/[borough]/[slug]/page.tsx:1`) |
| Efficient cache lifetimes 156 KiB | OpenStreetMap tile responses + Leaflet marker PNGs from `unpkg.com` are uncached | `src/components/building/v2/BigMap.tsx:33-35,57` |

---

## File Map

**Modified (no new files except one new dynamic-wrapper helper):**

```
src/components/building/v2/streaming/HeroV2Streamed.tsx        # Fix HeroFallback dimensions
src/components/building/v2/streaming/SectionSkeleton.tsx       # Per-section min-height map
src/components/building/RentHistoryChart.tsx                   # Split recharts via dynamic()
src/components/building/ViolationTrend.tsx                     # Split recharts via dynamic()
src/components/building/v2/WayfinderRail.tsx                   # Defer IO setup to idle
src/app/[city]/building/[borough]/[slug]/page.tsx              # Wrap BigMap section in LazyOnScroll
src/app/layout.tsx                                             # Defer ScrollToTopOnNav, drop redundant preconnect
src/styles/v2-tokens.css                                       # Split: critical inline + lazy rest
next.config.ts                                                 # Cache headers for /tile, /unpkg proxy
```

**New (one helper):**

```
src/components/building/RentHistoryCanvas.tsx                  # Pure recharts canvas, split target
src/components/building/ViolationTrendCanvas.tsx               # Pure recharts canvas, split target
src/styles/v2-tokens.critical.css                              # Above-fold subset of v2-tokens.css
```

---

# Phase 1 — CLS Fixes (target: 0.189 → < 0.10)

CLS is the single biggest miss and the fastest to fix. All work here is changing skeleton placeholder dimensions — no real-component changes.

### Task 1.1: Measure exact rendered heights of HeroV2 + each section in production

We need ground truth before changing skeletons. Don't guess.

**Files:**
- Read: `src/components/building/v2/HeroV2.tsx`
- Read: `src/components/building/v2/sections/*.tsx` (every section)

- [ ] **Step 1: Open the URL in Chrome at desktop emulation (1350×940)**

URL: `https://lucidrents.com/nyc/building/bronx/16-richman-plaza-bronx-ny-10453`

- [ ] **Step 2: For each Suspense fallback target, record rendered height once data resolves**

Open DevTools → Elements. For each selector below, record `getBoundingClientRect().height` after the page fully settles:

```js
// Paste in DevTools console
const targets = {
  heroVerdict: '.hero .verdict',
  heroLeasing: '.hero .leasing-card',
  s01Rent: '#rent',
  s015NbhRisks: '#neighborhood-risks',
  s02Issues: '#issues',
  s03Reviews: '#reviews',
  s04Amenities: '#amenities',
  s05Landlord: '#landlord',
  s06Location: '#location',
  s07History: '#history',
  s08Similar: '#similar',
  s09FAQ: '#faq',
  s10Insights: '#la-insights, #chicago-insights, #miami-insights, #houston-insights, #nyc-insights',
};
Object.fromEntries(Object.entries(targets).map(([k, sel]) => {
  const el = document.querySelector(sel);
  return [k, el ? Math.round(el.getBoundingClientRect().height) : 'not-found'];
}));
```

- [ ] **Step 3: Save the measurements**

Append a `<!-- Section heights @ desktop 1350px (2026-05-27) -->` block to the top of [`src/components/building/v2/streaming/SectionSkeleton.tsx`](src/components/building/v2/streaming/SectionSkeleton.tsx) as a code comment that future agents can read.

Example format:
```
/*
 * Section heights @ desktop 1350px (2026-05-27 measurement):
 *   hero.verdict   = 524
 *   hero.leasing   = 188
 *   #rent          = 612
 *   ...
 */
```

- [ ] **Step 4: Commit**

```bash
git add src/components/building/v2/streaming/SectionSkeleton.tsx
git commit -m "perf(building): record measured section heights for CLS work"
```

---

### Task 1.2: Fix HeroFallback dimensions

**Files:**
- Modify: `src/components/building/v2/streaming/HeroV2Streamed.tsx:42-60`

- [ ] **Step 1: Update `HeroFallback` to use the measured heights (from Task 1.1)**

Replace the two skeleton `minHeight` values with the measured-or-slightly-larger values. Use `min-height` (not `height`) so that on rare edge cases (very long address, narrow viewport reflow) the skeleton can grow without truncation.

```tsx
// HeroV2Streamed.tsx — leasing-card placeholder
<div
  className="leasing-card"
  style={{
    minHeight: 200,                  // was 120 — measured at ~188
    background: "rgba(0,0,0,0.03)",
    animation: "v2-pulse 1.4s ease-in-out infinite",
  }}
  aria-hidden="true"
/>

// HeroV2Streamed.tsx — verdict aside
<aside
  className="verdict"
  style={{
    minHeight: 540,                  // was 300 — measured at ~524
    background: "rgba(0,0,0,0.03)",
    animation: "v2-pulse 1.4s ease-in-out infinite",
  }}
  aria-hidden="true"
/>
```

Replace the literal `200` and `540` with **the measured values from Task 1.1 + 10px buffer**.

- [ ] **Step 2: Manual smoke test in dev**

```bash
pnpm dev
```

Open the building URL with throttling enabled (DevTools → Performance → Slow 4G + 4× CPU). Watch the page paint. The hero region should NOT visibly jump when verdict data resolves. Use the CLS visualizer (DevTools → Performance → enable "Web Vitals").

Expected: hero verdict area paints empty (gray pulse) at correct height, then content fades in at the same height. Zero shift.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/v2/streaming/HeroV2Streamed.tsx
git commit -m "perf(building): match HeroFallback dimensions to real hero — kill hero CLS"
```

---

### Task 1.3: Per-section skeleton heights

`SectionSkeleton` currently uses a flat `height: 280` for every section. Replace with a per-section map keyed by the `id` prop the page already passes.

**Files:**
- Modify: `src/components/building/v2/streaming/SectionSkeleton.tsx`

- [ ] **Step 1: Add the height map**

```tsx
// SectionSkeleton.tsx
// Heights are 90th-percentile rendered heights observed on 2026-05-27
// across 10 sample buildings. Pad +20px to avoid undersizing.
// Update if a section's content density meaningfully changes.
const MIN_HEIGHTS: Record<string, number> = {
  rent: 620,
  "neighborhood-risks": 420,
  issues: 560,
  reviews: 720,
  amenities: 380,
  landlord: 480,
  location: 540,           // includes BigMap once hydrated
  "about-this-area": 340,
  history: 460,
  similar: 520,
  faq: 380,
  "la-insights": 420,
  "chicago-insights": 420,
  "miami-insights": 420,
  "houston-insights": 420,
  "nyc-insights": 420,
};
const DEFAULT_MIN_HEIGHT = 320;
```

- [ ] **Step 2: Use the map in the rendered skeleton**

```tsx
export function SectionSkeleton({ num, title, sub, id }: Props) {
  const reservedHeight = id ? (MIN_HEIGHTS[id] ?? DEFAULT_MIN_HEIGHT) : DEFAULT_MIN_HEIGHT;
  return (
    <section className="section" id={id}>
      <style>{`
        @keyframes v2-pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }
      `}</style>
      <div className="section-head">
        <div>
          <div className="num">{num}</div>
          <h2>{title}</h2>
          {sub ? <p className="ww-sub" style={{ marginTop: 4 }}>{sub}</p> : null}
        </div>
        <div className="meta"></div>
      </div>
      <div
        className="ri-card"
        style={{
          minHeight: reservedHeight,    // was height: 280
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
```

Note: `minHeight` (not `height`) so under-content sections aren't visibly padded after data resolves.

- [ ] **Step 3: Also update every section's Streamed wrapper that passes its own custom `SectionSkeleton`**

Grep for `<SectionSkeleton ` and confirm each call site now passes an `id` prop. If any pass no `id`, add one matching the corresponding `SECTIONS` entry in `WayfinderRail.tsx`.

```bash
rg -n '<SectionSkeleton' src/
```

- [ ] **Step 4: Verify CLS in dev with throttling**

Same flow as Task 1.2, but scroll the whole page top→bottom. Total CLS should be < 0.05.

- [ ] **Step 5: Commit**

```bash
git add src/components/building/v2/streaming/SectionSkeleton.tsx
git commit -m "perf(building): per-section min-heights in SectionSkeleton — eliminate body CLS"
```

---

### Task 1.4: Chart-skeleton dimensions

**Files:**
- Modify: `src/components/building/SubmarketTrendsChart.tsx:13-19`
- Modify: `src/components/building/RentHistoryChart.tsx` (after Task 2.1 splits it)
- Modify: `src/components/building/ViolationTrend.tsx` (after Task 2.2 splits it)

- [ ] **Step 1: Confirm SubmarketTrendsCanvas final rendered height matches its skeleton (`height: 320`)**

Open DevTools, inspect the canvas after it hydrates. If the recharts ResponsiveContainer renders at ~320px (it should, since the parent sets it), no change needed. If it differs, set the skeleton to match.

- [ ] **Step 2: Same check for `RentHistoryChart` and `ViolationTrend` after their splits land**

- [ ] **Step 3: Commit if any height needed adjustment**

---

# Phase 2 — JS Reduction (target: TBT 1,170ms → < 300ms)

The biggest TBT contributor is hydration of components that don't need to ship eagerly. Three quick code-split wins + one defer wrapper.

### Task 2.1: Code-split `RentHistoryChart`

**Files:**
- Create: `src/components/building/RentHistoryCanvas.tsx`
- Modify: `src/components/building/RentHistoryChart.tsx`

- [ ] **Step 1: Move all recharts imports + chart JSX into `RentHistoryCanvas.tsx`**

Pattern is identical to the existing `SubmarketTrendsChart.tsx` → `SubmarketTrendsCanvas.tsx` split. The wrapper component keeps the `Card`, header, tabs, and trend stats — only the recharts `<ComposedChart>` block moves to the canvas file.

Read `SubmarketTrendsChart.tsx` and `SubmarketTrendsCanvas.tsx` first to mirror the exact pattern.

- [ ] **Step 2: Replace direct chart JSX in `RentHistoryChart.tsx` with `dynamic()` import**

```tsx
// RentHistoryChart.tsx
"use client";
import dynamic from "next/dynamic";
// ...existing non-recharts imports

const RentHistoryCanvas = dynamic(
  () => import("./RentHistoryCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 320, width: "100%" }}
        className="bg-[#f8fafc] rounded-lg animate-pulse"
      />
    ),
  }
);
```

Use the **measured** rendered height of the recharts canvas (Phase 1 Task 1.4) for the skeleton.

- [ ] **Step 3: Verify the page still renders the same chart**

```bash
pnpm dev
# Open the building URL, scroll to History section, confirm chart looks identical
```

- [ ] **Step 4: Confirm recharts is no longer in the initial chunk**

```bash
pnpm build
ls -lah .next/static/chunks/ | sort -k5 -h | tail -20
```

Look for a new chunk that contains recharts (it should be named with a hash like `1234.abc.js` and be ~50KB gzipped). The page chunk should be smaller than before.

- [ ] **Step 5: Commit**

```bash
git add src/components/building/RentHistoryChart.tsx src/components/building/RentHistoryCanvas.tsx
git commit -m "perf(building): code-split RentHistoryChart's recharts canvas"
```

---

### Task 2.2: Code-split `ViolationTrend`

Same pattern as Task 2.1.

**Files:**
- Create: `src/components/building/ViolationTrendCanvas.tsx`
- Modify: `src/components/building/ViolationTrend.tsx`

- [ ] **Step 1-5: Mirror Task 2.1 exactly, substituting `ViolationTrend` ↔ `RentHistoryChart`**

- [ ] **Step 6: Commit**

```bash
git add src/components/building/ViolationTrend.tsx src/components/building/ViolationTrendCanvas.tsx
git commit -m "perf(building): code-split ViolationTrend's recharts canvas"
```

---

### Task 2.3: Defer `WayfinderRail` IntersectionObserver setup

The rail mounts on every building page and immediately calls `document.getElementById` 11 times + `new IntersectionObserver`. Move this into `requestIdleCallback` (fallback `setTimeout`) so it doesn't block hydration on the critical path.

**Files:**
- Modify: `src/components/building/v2/WayfinderRail.tsx:36-55`

- [ ] **Step 1: Wrap the IO effect in idle deferral**

```tsx
useEffect(() => {
  const setup = () => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0 }
    );
    for (const el of els) observer.observe(el);
    return observer;
  };

  let observer: IntersectionObserver | null = null;
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  const handle = ric
    ? ric(() => { observer = setup(); }, { timeout: 1500 })
    : window.setTimeout(() => { observer = setup(); }, 200);

  return () => {
    observer?.disconnect();
    if (ric) {
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      cic?.(handle as number);
    } else {
      clearTimeout(handle as number);
    }
  };
}, []);
```

- [ ] **Step 2: Verify rail still highlights the right section as user scrolls**

Open the page in dev, scroll slowly. Active section in the rail (visual highlight) should update within ~1s of crossing into a new section. This is fine — scroll-spy doesn't need to be instant.

- [ ] **Step 3: Commit**

```bash
git add src/components/building/v2/WayfinderRail.tsx
git commit -m "perf(building): defer WayfinderRail IO setup to requestIdleCallback"
```

---

### Task 2.4: Wrap `BigMap` (S06 Location) in `LazyOnScroll`

`BigMap` is `"use client"` and hydrates eagerly whenever S06 is in the rendered tree. Even though `react-leaflet` itself is dynamic-imported, the wrapper `BigMap` component ships eagerly, runs a `useEffect` that imports the full `leaflet` ESM module, and instantiates an icon — on every page load.

S06 sits below the fold on desktop and well below on mobile. Wrap the streaming entry in `LazyOnScroll`.

**Files:**
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx:304`

- [ ] **Step 1: Wrap `S06LocationStreamed` in the existing `LazyOnScroll`**

```tsx
// page.tsx — replace line 304
<LazyOnScroll fallback={<SectionSkeleton num="06 / 10" title="Location & neighborhood." id="location" />}>
  <S06LocationStreamed building={building} city={typedCity} />
</LazyOnScroll>
```

Confirm `num` and `title` strings match what `S06LocationStreamed` currently passes to its first-render header. If they differ, copy the exact values to avoid a brief flash of mismatched header.

- [ ] **Step 2: Verify in dev**

Scroll to S06 — map should still render correctly. Page initial JS bundle (open Network tab, filter to "JS") should be smaller. Leaflet/react-leaflet chunks should now load **after** scroll, not on first paint.

- [ ] **Step 3: Commit**

```bash
git add src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "perf(building): lazy-load S06 location (leaflet) on scroll"
```

---

### Task 2.5: Defer `ScrollToTopOnNav` to client idle

`ScrollToTopOnNav` mounts in the root layout on every page. Its job is to scroll-to-top on forward navigation — that only matters on the *second* page view, not the first. Defer mounting until after first paint.

**Files:**
- Modify: `src/app/layout.tsx:148`
- Modify: `src/components/layout/ScrollToTopOnNav.tsx` (gate the effect)

- [ ] **Step 1: Add a mount-after-idle gate inside `ScrollToTopOnNav`**

```tsx
// ScrollToTopOnNav.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTopOnNav() {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const isBackForward = useRef(false);

  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const handle = ric
      ? ric(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 500);
    return () => {
      if (ric) {
        const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
        cic?.(handle as number);
      } else {
        clearTimeout(handle as number);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onPopState = () => { isBackForward.current = true; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    if (isBackForward.current) { isBackForward.current = false; return; }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname, ready]);

  return null;
}
```

- [ ] **Step 2: Verify**

- Initial page load: no scroll-to-top fires (was firing immediately before — wasteful).
- Click a `Link` to navigate to another building. Page should scroll to top normally.
- Browser back: scroll position preserved.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ScrollToTopOnNav.tsx
git commit -m "perf(layout): defer ScrollToTopOnNav effects until idle"
```

---

### Task 2.6: Audit `optimizePackageImports` and bundle composition

**Files:**
- Modify: `next.config.ts` (possibly add packages)
- Read: bundle analyzer output

- [ ] **Step 1: Generate a bundle analysis**

```bash
pnpm next experimental-analyze --serve --port 4001
```

Open `http://localhost:4001`. Filter to the building page route. Identify the top 10 largest modules in the **client** bundle.

- [ ] **Step 2: For any package > 20KB that's only imported via a few named exports, add it to `optimizePackageImports`**

Already in list: `lucide-react`, `recharts`, `framer-motion`, `date-fns`. Likely candidates to add (verify from analyzer): `@supabase/supabase-js`, `clsx`, `react-leaflet`. Only add if the analyzer shows the full package is being shipped when only a few exports are used.

- [ ] **Step 3: Diff `.next/static/chunks/` sizes before/after**

```bash
# Before
du -sh .next/static/chunks/ > /tmp/chunks-before.txt
# After
pnpm build && du -sh .next/static/chunks/ > /tmp/chunks-after.txt
diff /tmp/chunks-before.txt /tmp/chunks-after.txt
```

- [ ] **Step 4: Commit if anything changed**

```bash
git add next.config.ts
git commit -m "perf(next): extend optimizePackageImports with measured wins"
```

---

# Phase 3 — Render-Blocking / CSS Critical Path (target: −180ms FCP)

`v2-tokens.css` is **128KB / 3,616 lines**. It's render-blocking. Most of it styles below-the-fold sections that don't need to be parsed before first paint.

### Task 3.1: Split `v2-tokens.css` into critical + lazy chunks

This is the only Phase-3 task. Done carefully it produces zero UI change.

**Files:**
- Create: `src/styles/v2-tokens.critical.css`
- Modify: `src/styles/v2-tokens.css`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx:1`

- [ ] **Step 1: Identify above-fold selectors**

Above-fold on desktop = `.v2`, `.container`, `.crumbs`, `.hero`, `.hero-left`, `.verdict`, `.leasing-card`, `.wayfinder` (sidebar), `.body`, `.skip-link`, font-face, CSS reset, `:root` design tokens, and `@keyframes v2-pulse`.

Use this DevTools coverage report to verify:
```
DevTools → Cmd+Shift+P → "Show coverage" → reload page → filter to v2-tokens.css
```

The "Unused bytes" column shows what's safe to defer.

- [ ] **Step 2: Extract above-fold rules into `v2-tokens.critical.css`**

Copy all `:root`, font-face, reset rules, and the selectors listed above (and their pseudos / responsive variants) into the new file. Target size: **< 20KB** (vs 128KB original).

- [ ] **Step 3: Update `v2-tokens.css` to remove the extracted rules**

Leave a header comment explaining the split:
```css
/*
 * v2-tokens.css — BELOW-fold styles for building detail page v2.
 * Above-fold styles live in v2-tokens.critical.css and are imported first.
 * This file is loaded async after first paint.
 *
 * If you add a new style here that's used above the fold, MOVE IT to critical.
 * Otherwise you'll regress CLS / FCP.
 */
```

- [ ] **Step 4: Update the page import order**

```tsx
// src/app/[city]/building/[borough]/[slug]/page.tsx — replace line 1
import "@/styles/v2-tokens.critical.css";
import "@/styles/v2-tokens.css";  // Next.js bundles both but critical wins at the top of cascade
```

Next.js App Router will still inline both as render-blocking by default. To actually defer the non-critical file we need to NOT import it from a route module. Instead, inject it via a `<link rel="stylesheet" media="print" onLoad="this.media='all'">` pattern in a server component:

Add a `LazyStyles` server component:

```tsx
// src/components/building/v2/LazyStyles.tsx
export function LazyStyles() {
  return (
    <>
      <link
        rel="preload"
        as="style"
        href="/_next/static/css/v2-tokens.css"  /* path resolved at build — see Step 5 */
        onLoad={"this.onload=null;this.rel='stylesheet'" as unknown as React.ReactEventHandler<HTMLLinkElement>}
      />
      <noscript>
        <link rel="stylesheet" href="/_next/static/css/v2-tokens.css" />
      </noscript>
    </>
  );
}
```

**Caveat:** Next.js doesn't expose a stable URL for CSS imported by a route. If this Step is fragile, alternative is to use Next's `dynamic import with css side-effect` pattern — load the lazy CSS from inside a client component that mounts post-hydration.

Simpler fallback: just keep both imports — `optimizePackageImports` and the critical-first ordering still get a smaller initial paint surface even if both files block. The big win is from reducing parse cost, not network.

- [ ] **Step 5: Verify nothing visually broke**

Open the building URL in dev. Scroll the whole page. Compare side-by-side with production (open `lucidrents.com/...` in another tab) — there should be ZERO visible differences.

- [ ] **Step 6: Commit**

```bash
git add src/styles/v2-tokens.critical.css src/styles/v2-tokens.css src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "perf(building): split v2-tokens.css into critical (~20KB) + lazy"
```

---

# Phase 4 — Cache Headers & Image Delivery (target: −156KiB + small image wins)

### Task 4.1: Set long cache on Leaflet marker assets

Currently the BigMap component pulls marker PNGs from `unpkg.com/leaflet@1.9.4/dist/images/...` on every page load. These are cached by unpkg with reasonable headers but Lighthouse flagged "use efficient cache lifetimes" for 156KiB worth of assets — likely these + OSM tiles.

**Option A (smaller diff):** Copy marker PNGs into `public/leaflet/` and serve from our own CDN with `immutable` cache headers.

**Option B (better but more code):** Replace the marker icon with an inline SVG so no PNG round-trip is needed.

Recommend **Option A** for this plan since it's a pure file-move with zero UI change.

**Files:**
- Add: `public/leaflet/marker-icon.png`
- Add: `public/leaflet/marker-icon-2x.png`
- Add: `public/leaflet/marker-shadow.png`
- Modify: `src/components/building/v2/BigMap.tsx:33-35`
- Modify: `next.config.ts` (add cache header for `/leaflet/*`)

- [ ] **Step 1: Download the three marker PNGs and check them into `public/leaflet/`**

```bash
mkdir -p public/leaflet
curl -L -o public/leaflet/marker-icon.png      https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png
curl -L -o public/leaflet/marker-icon-2x.png   https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png
curl -L -o public/leaflet/marker-shadow.png    https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png
```

- [ ] **Step 2: Update `BigMap.tsx` to reference the local paths**

```tsx
setIcon(
  new L.Icon({
    iconUrl:       "/leaflet/marker-icon.png",
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    shadowUrl:     "/leaflet/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
);
```

- [ ] **Step 3: Add cache header in `next.config.ts`**

```ts
{
  source: "/leaflet/:path*",
  headers: [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
  ],
},
```

Insert near the existing `/_next/static/:path*` block (around line 102).

- [ ] **Step 4: Verify in dev**

Scroll to map, confirm marker pin appears with the same Leaflet blue/teal styling. Check Network panel — marker should now load from `localhost:3000/leaflet/marker-icon.png` with the `Cache-Control: public, max-age=31536000, immutable` header.

- [ ] **Step 5: Commit**

```bash
git add public/leaflet/ src/components/building/v2/BigMap.tsx next.config.ts
git commit -m "perf(building): self-host leaflet markers with 1y immutable cache"
```

---

### Task 4.2: Add explicit `width`/`height` to any plain `<img>` tags on the page

Audit confirmed there are no `<img>` tags in building components directly. The PageSpeed "incorrect aspect ratio" finding likely refers to images in `Navbar` or `Footer` (loaded on every page).

**Files:**
- Read: `src/components/layout/Navbar.tsx`
- Read: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Grep**

```bash
rg -n '<img ' src/components/layout/
```

- [ ] **Step 2: For each `<img>` found, add explicit `width`, `height`, `loading`, and `decoding` attributes**

```tsx
// Before
<img src="/lucid-rents-logo.png" alt="Lucid Rents" />

// After
<img
  src="/lucid-rents-logo.png"
  alt="Lucid Rents"
  width={160}
  height={32}
  loading="lazy"     /* omit for above-fold logo — use eager + fetchpriority="high" */
  decoding="async"
/>
```

If the image is above the fold (Navbar logo): use `loading="eager"` and `fetchPriority="high"`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/Footer.tsx
git commit -m "perf(layout): explicit dimensions on plain <img> tags — kill aspect-ratio CLS"
```

---

### Task 4.3: Drop unused root preconnect

The root layout opens a Supabase TLS connection for `NavAuth`'s client-side auth check. Verify this is still needed (Navbar auth check might have moved server-side). If unused, removing the preconnect saves a connection slot.

**Files:**
- Read: `src/components/layout/Navbar.tsx`
- Modify: `src/app/layout.tsx:122-123` if appropriate

- [ ] **Step 1: Confirm `Navbar` actually calls Supabase on the client**

```bash
rg -n 'supabase|createClient' src/components/layout/Navbar.tsx
```

If the file does NOT import a client Supabase, the preconnect can be removed.

- [ ] **Step 2: If safe to remove, delete lines 122-123 of `src/app/layout.tsx`**

- [ ] **Step 3: Commit (only if you removed)**

```bash
git add src/app/layout.tsx
git commit -m "perf(layout): drop unused Supabase preconnect from root"
```

---

# Phase 5 — Validation

### Task 5.1: Run Lighthouse locally on the changes

**Files:** none modified

- [ ] **Step 1: Start production build locally**

```bash
pnpm build && pnpm start
```

- [ ] **Step 2: Run Lighthouse against the local build**

```bash
npx lighthouse http://localhost:3000/nyc/building/bronx/16-richman-plaza-bronx-ny-10453 \
  --output=json --output-path=/tmp/lh-after.json \
  --preset=desktop \
  --chrome-flags="--headless"
```

- [ ] **Step 3: Verify against targets**

```bash
jq '.categories.performance.score, .audits["cumulative-layout-shift"].numericValue, .audits["total-blocking-time"].numericValue' /tmp/lh-after.json
```

Expected:
- `performance.score` ≥ 0.90
- `cumulative-layout-shift` < 0.10
- `total-blocking-time` < 300ms

If any metric misses target, identify the worst remaining audit and add a follow-up task. **Do NOT proceed to Step 4 with red metrics.**

---

### Task 5.2: Confirm field CWV unchanged (real users still pass)

- [ ] **Step 1: After PR merges and deploys, wait 48h**

- [ ] **Step 2: Pull PageSpeed Insights field data**

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Flucidrents.com%2Fnyc%2Fbuilding%2Fbronx%2F16-richman-plaza-bronx-ny-10453&strategy=desktop&key=$PAGESPEED_API_KEY" \
  | jq '.loadingExperience.metrics'
```

- [ ] **Step 3: Confirm**

- LCP p75 ≤ 1.2s (unchanged or better)
- INP p75 ≤ 58ms (unchanged or better)
- CLS p75 ≤ 0.08 (unchanged or better — should improve to < 0.05)

If any field metric regresses, open a rollback PR immediately. Field metrics > lab metrics.

---

### Task 5.3: Final commit + PR

- [ ] **Step 1: Squash phase commits into a single PR with summary**

```bash
gh pr create --title "perf(building): kill CLS, halve TBT, fix lab Lighthouse to 90+" \
  --body "$(cat <<'EOF'
## Summary

Lab Lighthouse on `/[city]/building/[borough]/[slug]` was scoring 59 (CLS 0.189, TBT 1170ms) despite field CWV passing. Drove lab to 90+ with no UI changes.

## What changed

- **CLS 0.189 → < 0.05**: corrected skeleton dimensions in HeroFallback + SectionSkeleton to match real rendered heights
- **TBT 1170ms → < 300ms**: code-split recharts in RentHistoryChart and ViolationTrend; deferred WayfinderRail IO setup to idle; lazy-loaded BigMap (S06) on scroll; deferred ScrollToTopOnNav
- **Render-blocking −180ms**: split v2-tokens.css into critical (~20KB) and lazy (~108KB)
- **Cache lifetimes −156KiB**: self-hosted Leaflet markers with 1y immutable cache
- **Image aspect ratio**: explicit width/height on Navbar/Footer images

## Test plan
- [ ] Lighthouse desktop score ≥ 90 on `/nyc/building/bronx/16-richman-plaza-bronx-ny-10453`
- [ ] Visual diff (production vs. PR preview): zero pixel differences above the fold
- [ ] Map still renders with correct marker in S06 after scroll
- [ ] Wayfinder rail still highlights active section as user scrolls
- [ ] Scroll-to-top still works on forward navigation
- [ ] Field CWV unchanged 48h post-deploy

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Out of Scope (explicit punt list)

Items flagged by Lighthouse that this plan does NOT execute because they require UI/design decisions:

1. **Accessibility 96 → 100:**
   - "Background and foreground colors do not have a sufficient contrast ratio" — needs design review of token contrasts.
   - "Heading elements are not in a sequentially-descending order" — needs decision on whether to demote `<h2>` in some sections or restructure.
   - "Identical links have the same purpose" — needs disambiguation copy.

2. **Best Practices 88 → 100:**
   - "Issues were logged in the Issues panel in Chrome DevTools" — usually deprecation warnings from third-party (GA/AdSense); upgrade scripts when vendor patches.
   - "Ensure CSP is effective against XSS attacks" — CSP is currently `Content-Security-Policy-Report-Only`. Flipping to enforced requires monitoring reports first.
   - "Mitigate DOM-based XSS with Trusted Types" — separate hardening effort.

3. **DB / data-layer:** Already addressed in `docs/perf-round-2-notes.md` (composite indexes + edge runtime on read-only APIs). No further DB work in this plan.

Open a follow-up plan after this one lands if any of those become priorities.

---

# Execution Notes

- Phases are sequential; commit between phases so each phase produces an isolated, revertable change.
- Run Lighthouse after **every** phase, not just at the end — partial wins should be measurable to validate the model.
- If Phase 1 (CLS fixes) alone doesn't drop CLS below 0.10, **stop and re-measure** — the heights are wrong and continuing won't help.
- The `LazyOnScroll` rootMargin is currently `400px`. If TBT remains high after Phase 2, tightening this to `200px` may help further (at the cost of slightly slower scroll-to-content).
- No need to update `MEMORY.md` after this lands — perf wins decay and the code is the source of truth.
