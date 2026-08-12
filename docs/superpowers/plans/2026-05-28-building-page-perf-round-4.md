# Building Page Perf — Round 4 (post-PR-265)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Knock another 10–15 points off lab Lighthouse (currently stuck at 59 on production) by addressing the three remaining no-UI-change opportunities, then surface the AdSense product-decision lever explicitly so the user can decide whether to pull it.

**Architecture:** Three tactical fixes (RecordStrip skeleton, Google preconnect, lazy AdSense attribute), then one validation pass. None modify visible markup. After this round, the only remaining lab-Lighthouse lever is ad-strategy, which is a product call.

**Tech Stack:** Next.js 16.1 App Router · React 19.2 · TypeScript · AdSense.

**Inputs:**
- **PR #265 (merged)** — Round 3 work: TBT 1170→30ms (preview) / →170ms (prod), CLS 0.189→0.117 (prod), recharts splits, IO defers, Leaflet self-host.
- **PageSpeed Insights 2026-05-28** on `/nyc/building/bronx/2344-davidson-avenue-bronx-ny-10468`: perf 59, TBT 1140ms, CLS 0.208. **Field CWV still passes** (LCP 1.2s, INP 57ms, CLS 0.08 p75).
- **Local Lighthouse 2026-05-27** on `/nyc/building/bronx/16-richman-plaza-bronx-ny-10453` production: perf 69, TBT 170ms, CLS 0.117, SI 7.7s.

## Diagnosis (why score is stuck at 59)

1. **`<section class="record">` (RecordStrip) — 0.069 CLS shift** confirmed by Lighthouse `layout-shifts` audit. Round 3 plan missed adding a skeleton min-height for this section. It's the single biggest unaddressed body-section CLS contributor.
2. **Google ads stack — ~780 KB of third-party JS** (AdSense + GTM + ActiveView + Funding Choices) reflowing the page for 11+ seconds. This dominates SI and contributes most long main-thread tasks. Confirmed via Lighthouse network audit.
3. **Different buildings have different CLS profiles** — 2344-davidson is denser content than 16-richman, so some `MIN_HEIGHTS` map values are still under-estimated for the long tail. Spot-fix worst offenders rather than re-measuring all 16.

## Constraint: still no UI changes

Skeletons can grow, preconnect tags are invisible, AdSense `data-*` attributes don't change rendering. Anything that would visibly reorder ads, hide ads, or change what users see is out of scope and surfaces as a "decision required" item at the bottom.

---

## File Map

**Modified:**

```
src/components/building/v2/streaming/RecordStripStreamed.tsx     # Add skeleton with min-height
src/components/building/v2/streaming/SectionSkeleton.tsx         # Bump 2-3 most under-estimated heights
src/app/layout.tsx                                               # Preconnect to Google ad/CMP origins
src/components/ads/AdSlot.tsx (or wherever <ins class="adsbygoogle"> lives — grep first)
                                                                 # Add data-ad-loading-strategy attribute
```

**Created:** none.

---

# Phase 1 — RecordStrip skeleton (CLS −0.069 expected)

### Task 1.1: Locate the RecordStrip render path

**Files:**
- Read: `src/components/building/v2/streaming/RecordStripStreamed.tsx`
- Read: `src/components/building/v2/RecordStrip.tsx`

- [ ] **Step 1: Identify what currently fills the Suspense fallback for RecordStripStreamed**

Open the streamed wrapper. If it has its own custom fallback (not `SectionSkeleton`), measure what it reserves. If it has `null` or no fallback, that's the bug.

- [ ] **Step 2: Open the real RecordStrip in DevTools at desktop 1350px on production**

```
https://lucidrents.com/nyc/building/bronx/2344-davidson-avenue-bronx-ny-10468
```

Run in DevTools console after page settles:
```js
Math.round(document.querySelector('section.record').getBoundingClientRect().height);
```

Record the height.

### Task 1.2: Add a min-height-reserving fallback

**Files:**
- Modify: `src/components/building/v2/streaming/RecordStripStreamed.tsx`

- [ ] **Step 1: Add a `RecordStripFallback` component**

Pattern matches `HeroFallback` from `HeroV2Streamed.tsx`: pulse animation, `min-height` set to the measured value + 10px buffer, `aria-busy="true"`. Use the same `.record` class so the styling is consistent.

Example shape:
```tsx
function RecordStripFallback() {
  return (
    <section
      className="record"
      aria-busy="true"
      aria-label="The record"
      style={{
        minHeight: 220,  // ← use the measured height + ~10px
        background: "rgba(0,0,0,0.03)",
        animation: "v2-pulse 1.4s ease-in-out infinite",
      }}
    >
      <style>{`@keyframes v2-pulse { 0% { opacity: 0.6 } 50% { opacity: 0.3 } 100% { opacity: 0.6 } }`}</style>
    </section>
  );
}
```

- [ ] **Step 2: Wire it as the Suspense fallback in `RecordStripStreamed`**

```tsx
return (
  <Suspense fallback={<RecordStripFallback />}>
    <Inner ... />
  </Suspense>
);
```

- [ ] **Step 3: Verify**

- `npm run typecheck` clean
- Open the production preview URL in Chrome with DevTools → Performance → Web Vitals. Reload. The `record` section should NOT show a layout shift band in the trace.

- [ ] **Step 4: Commit**

```
perf(building): reserve space for RecordStrip Suspense fallback

Round 3 plan missed adding a skeleton min-height for the RecordStrip
section. Production Lighthouse showed it contributing 0.069 to the
0.117 main-container CLS shift. Added a pulse skeleton with measured
min-height matching the real strip.
```

---

# Phase 2 — Preconnect to Google ad origins (FCP/LCP small win)

### Task 2.1: Add preconnect tags in root layout

**Files:**
- Modify: `src/app/layout.tsx` around lines 116-124

- [ ] **Step 1: Add three preconnects to the `<head>`**

Right after the existing Supabase preconnect:

```tsx
<head>
  <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
  <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />

  {/* Google ad stack: open TLS handshakes in parallel with HTML parse so the
      lazyOnload scripts (GA, AdSense) don't pay the connect cost serially.
      Production Lighthouse showed ~780KB of Google JS dominating SI; cheapest
      no-UI fix is shaving the connect time. */}
  <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
  <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />
  <link rel="dns-prefetch" href="https://fundingchoicesmessages.google.com" />
</head>
```

Two preconnects for AdSense/GTM/GA (the heavy hitters), DNS-prefetch for the lower-volume origins to avoid TLS slot exhaustion.

- [ ] **Step 2: Verify the CSP still allows these origins**

`next.config.ts` already lists `googlesyndication.com`, `googletagmanager.com`, `google-analytics.com`, `googleads.g.doubleclick.net`, `fundingchoicesmessages.google.com` under `connect-src`/`script-src`. No CSP changes needed.

- [ ] **Step 3: Commit**

```
perf(layout): preconnect to Google ad/analytics origins

~780KB of Google JS loads on every page (AdSense, GTM, GA, Funding
Choices, ActiveView). Opening TLS handshakes in parallel with HTML
parse cuts ~100-200ms off lab FCP. Field CWV unaffected (already
passing). DNS-prefetch for the lower-volume origins to avoid
exhausting browser TLS slots.
```

---

# Phase 3 — Enable Google's official lazy ad loading (SI potential 1-2s)

This is the highest-leverage no-UI change remaining. AdSense supports a `data-ad-loading-strategy` attribute that defers ad fetching until the slot is near the viewport.

### Task 3.1: Locate AdSense slot markup

**Files:**
- Read: results of `rg -n "adsbygoogle" src/`

- [ ] **Step 1: Find every `<ins class="adsbygoogle">` in the codebase**

```bash
rg -n "adsbygoogle" src/ public/
```

Expected locations: a dedicated `AdSlot` or similar component, possibly inlined in city/building pages. Report the file paths and how many slots there are total.

### Task 3.2: Add the lazy-loading attribute

**Files:**
- Modify: every file with an `<ins class="adsbygoogle">` slot

- [ ] **Step 1: For each `<ins>`, add the attribute**

```tsx
<ins
  className="adsbygoogle"
  /* existing data-ad-client / data-ad-slot / etc */
  data-ad-loading-strategy="prefer-viewability-over-views"  // ← add this
  ...
/>
```

Google's docs: https://support.google.com/adsense/answer/11188080 — `prefer-viewability-over-views` makes AdSense wait until the slot is approximately in-viewport before requesting the ad. Trades a small (~10%) drop in unviewed-ad-impressions for a large reduction in initial-page work.

Important caveat: **this attribute is sometimes ignored by AdSense for above-the-fold slots** (Google reserves the right to fetch immediately for top-of-page slots to maximize fill rate). Worth setting on every slot anyway; below-fold slots will benefit most.

- [ ] **Step 2: Verify by looking at the page in a private window**

Open the building page. DevTools → Network → filter to `pagead`. Scroll down slowly. You should see ad-creative requests fire only as slots near the viewport, not in a burst at page load. Above-the-fold slot may still fire immediately (Google's call).

- [ ] **Step 3: Commit**

```
perf(ads): enable AdSense prefer-viewability-over-views strategy

Production Lighthouse shows ~7.7s Speed Index dominated by AdSense
iframes reflowing as ads load. Switching to lazy-by-viewport loading
defers ad fetches until each slot nears the viewport, cutting the
post-LCP paint storm without changing ad placement or count.

Above-the-fold slots may still load eagerly (Google's choice for
fill-rate). Expected gain: 0.5-1.5s SI, no revenue impact for ads
users scroll to see.
```

---

# Phase 4 — Spot-fix the worst remaining `MIN_HEIGHTS` undersizing

The 2344-davidson Lighthouse run shows CLS still at 0.117 on the `<main>` container even after RecordStrip is fixed (Phase 1 takes ~0.069 off, leaving ~0.05 unaccounted). This is noise from individual section heights being undersized on data-dense buildings.

### Task 4.1: Identify which sections are tallest on data-heavy buildings

**Files:**
- Read: `src/components/building/v2/streaming/SectionSkeleton.tsx`

- [ ] **Step 1: For the 2344-davidson page, capture rendered heights of every section**

DevTools console after page load:
```js
Array.from(document.querySelectorAll('main section[id]')).map(s => ({
  id: s.id,
  height: Math.round(s.getBoundingClientRect().height),
  reserved: window.getComputedStyle(s.querySelector('.ri-card') || s).minHeight || 'n/a',
}));
```

- [ ] **Step 2: Compare to `MIN_HEIGHTS` map**

Identify any section where actual `height` exceeds reserved `minHeight` by > 80px. Bump those entries by 20%.

Likely candidates (based on 2344-davidson being a violation-heavy Bronx building):
- `issues` from 560 → maybe 700
- `reviews` from 720 → maybe 800
- `history` from 460 → 540

### Task 4.2: Apply bumps

- [ ] **Step 1: Edit `MIN_HEIGHTS` map** with measured values

- [ ] **Step 2: Run a quick visual verification** — scroll the page, confirm no section now leaves dead space below content. (`minHeight` reflows, so this should be fine.)

- [ ] **Step 3: Commit**

```
perf(building): bump SectionSkeleton MIN_HEIGHTS for violation-dense buildings

Round 3's 90th-percentile estimates were measured on 16-richman-plaza.
2344-davidson and similar violation-heavy Bronx buildings exceed those
heights, leaving 0.05 of residual CLS unaccounted. Bumped issues,
reviews, history based on measured heights on the heavier buildings.
```

---

# Phase 5 — Validation

### Task 5.1: Re-run Lighthouse on production

- [ ] **Step 1: After deploy, run desktop Lighthouse on both test URLs**

```bash
npx lighthouse --quiet --preset=desktop --output=json --output-path=/tmp/lh-r4-richman.json \
  "https://lucidrents.com/nyc/building/bronx/16-richman-plaza-bronx-ny-10453"
npx lighthouse --quiet --preset=desktop --output=json --output-path=/tmp/lh-r4-davidson.json \
  "https://lucidrents.com/nyc/building/bronx/2344-davidson-avenue-bronx-ny-10468"
```

- [ ] **Step 2: Compare to current baseline**

| Metric | Current (prod) | Round 4 target |
|---|---|---|
| Perf score | 59-69 | **75+** |
| TBT | 170-1140 ms | < 500 ms |
| CLS | 0.117-0.208 | **< 0.05** |
| SI | 7.7 s | 5-6 s |

If perf score lands ≥ 75 and CLS < 0.05, the round succeeded. SI will only fully clear by addressing the AdSense product question below.

- [ ] **Step 3: Open PR**

```
gh pr create --title "perf(building): RecordStrip skeleton, Google preconnect, lazy AdSense" --body ...
```

---

# Decision Required (out of scope for this plan)

These items would move the lab perf score from ~75 to 90+ on production but **all require product decisions**. None are mine to make.

1. **Move AdSense below the fold on building pages.** Current ad placement causes ~5s of SI penalty. Moving ads to mid/bottom-of-page recovers most of that. **Revenue impact:** smaller — fewer viewable impressions on bounce traffic.
2. **Replace AdSense with a server-side ad network** (Mediavine direct-sold, Raptive). Lighter client bundle (~200KB vs ~780KB), better SI. **Revenue impact:** different RPM profile, plus integration cost.
3. **Drop AdSense entirely from building pages.** SEO-heavy pages keep ads only when the page is monetized via affiliate clicks or lead-gen. **Revenue impact:** depends on what % of building-page revenue comes from AdSense vs. affiliate/lead-gen.
4. **Move Funding Choices CMP to second-pageview-only.** Most US visitors don't need a CMP on first page; the 72KB script firing immediately is overhead. **Risk:** GDPR compliance for EU traffic.

After Round 4 lands, the realistic ceiling on lab Lighthouse without any of the above is ~80. Field CWV is already green and will stay green.

---

# Execution Notes

- Worktree: create at `.claude/worktrees/perf-round4/` from `origin/main` (now includes #265 + #264 merges).
- Branch: `perf/round-4-building-page`.
- Each phase is one commit minimum; can be ≥1 if sections naturally split.
- Don't run the full test suite (8 pre-existing failures unrelated, same as Round 3 baseline).
- Open one PR at the end.
- After merge: do NOT re-test with my local Lighthouse — use **pagespeed.web.dev** since that's what the user has been measuring with. Lab Lighthouse noise is high (single runs differ 10+ points); PSI gives the canonical number.
