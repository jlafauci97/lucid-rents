# LucidRents SEO & Feature Batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 13 features to differentiate LucidRents and improve SEO, building on tenant tools work already completed in a prior session.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS, Lucide icons

---

## Prior Work — Verify First

The following files were created in a prior session (Sonnet). Verify they compile before proceeding:
- `src/lib/tenant-templates-data.ts`
- `src/components/tenant-tools/TemplateCard.tsx`
- `src/components/tenant-tools/TemplateViewer.tsx`
- `src/app/[city]/tenant-tools/page.tsx`
- `src/app/[city]/tenant-tools/templates/page.tsx`
- `src/app/[city]/tenant-tools/templates/[slug]/page.tsx`
- `src/components/layout/NavDropdown.tsx` (tenant tools links added)
- `src/components/layout/MobileMenu.tsx` (tenant tools links added)
- `src/lib/tenant-rights-data.ts` (`faq?` field added to `TopicData` interface at line 47)

- [ ] **Step 0: Verify prior work compiles**

Run: `npm run build 2>&1 | tail -30`

Expected: Clean build with no TypeScript errors. Fix any issues before proceeding.

---

## Key Existing Infrastructure (reuse, don't recreate)

| Asset | File | Usage |
|-------|------|-------|
| `Breadcrumbs` component | `src/components/ui/Breadcrumbs.tsx` | Takes `items: {label, href}[]`, emits JSON-LD BreadcrumbList |
| `FAQSection` component | `src/components/seo/FAQSection.tsx` | Takes `FAQItem[]`, emits FAQPage JSON-LD + accordion |
| `JsonLd` wrapper | `src/components/seo/JsonLd.tsx` | `<script type="application/ld+json">` |
| `breadcrumbJsonLd()` | `src/lib/seo.ts:169` | Generates BreadcrumbList schema object |
| `canonicalUrl()`, `cityPath()` | `src/lib/seo.ts:37,71` | URL helpers |
| `isValidCity()`, `CITY_META` | `src/lib/cities.ts` | City validation and metadata |
| `/api/buildings/nearby` | `src/app/api/buildings/nearby/route.ts` | Haversine nearby buildings query |
| `/api/search` | `src/app/api/search/route.ts` | Full-text building search |
| `AdSidebar` | `src/components/ui/AdSidebar.tsx` | Wraps all city page content |

---

## Task 1 — FAQ Schema on Tenant Rights Topic Pages (Feature #20)

**Files:**
- Modify: `src/lib/tenant-rights-data.ts` — populate `faq` data per topic
- Modify: `src/app/[city]/tenant-rights/[topic]/page.tsx:186` — render `<FAQSection>`

### Step 1.1: Add FAQ data to NYC tenant rights topics

The `faq?` field already exists on `TopicData` (added by prior session). Add `faq` arrays to each topic in `TENANT_RIGHTS_BY_CITY.nyc.topics`. Each topic needs 3-5 Q&A pairs. Example for `rent-stabilization-rights`:

```typescript
faq: [
  {
    question: "How do I know if my NYC apartment is rent stabilized?",
    answer: "Check the NYC Rent Guidelines Board website or request your apartment's rent history from DHCR using their online lookup tool. Your lease should also state whether your unit is rent stabilized.",
  },
  {
    question: "Can my landlord raise my rent more than the stabilization guidelines?",
    answer: "No — for rent stabilized units, landlords can only raise rent by the percentages set annually by the NYC Rent Guidelines Board. Individual Apartment Improvements (IAIs) may allow limited additional increases.",
  },
  {
    question: "What happens if my landlord tries to illegally deregulate my unit?",
    answer: "File a complaint with DHCR. You may be entitled to a rent overcharge refund going back up to 6 years, plus treble damages if the overcharge was willful.",
  },
],
```

- [ ] Add `faq` arrays to all NYC topics: `rent-stabilization-rights`, `repairs-and-maintenance`, `illegal-eviction`, `security-deposits`, `harassment`, `roommates-subletting`, `lead-paint-mold`, `lease-renewals`
- [ ] Add `faq` arrays to all LA topics in `TENANT_RIGHTS_BY_CITY["los-angeles"].topics`
- [ ] Add `faq` arrays to all Chicago topics
- [ ] Add `faq` arrays to Miami and Houston topics

### Step 1.2: Render FAQSection on the topic page

In `src/app/[city]/tenant-rights/[topic]/page.tsx`, add the import and render the FAQ section. Current file ends at line 190. Add after the disclaimer section (line 186):

Add import at top of file (after existing imports, line 10):
```typescript
import { FAQSection } from "@/components/seo/FAQSection";
```

Add before the closing `</div>` of the content area (before line 187):
```tsx
        {/* FAQ */}
        {topic.faq && topic.faq.length > 0 && (
          <section className="mt-8">
            <FAQSection items={topic.faq} />
          </section>
        )}
```

- [ ] Add `FAQSection` import to `src/app/[city]/tenant-rights/[topic]/page.tsx`
- [ ] Add FAQ section render between helpline and disclaimer sections
- [ ] Run `npx tsc --noEmit 2>&1 | head -20` — expect no errors
- [ ] Verify page source at `/nyc/tenant-rights/rent-stabilization-rights` contains `"@type":"FAQPage"`

---

## Task 2 — WebSite Schema Enhancement (Feature #21)

**Files:**
- Modify: `src/app/page.tsx:84` — fix `urlTemplate` to be generic, add `sameAs`

The WebSite + Organization schemas already exist (`src/app/page.tsx` lines 72-100). The SearchAction `urlTemplate` currently hardcodes `/nyc/search`. Google's Sitelinks Search Box works best with a generic URL.

### Step 2.1: Fix the SearchAction urlTemplate

In `src/app/page.tsx`, change line 85 from:
```typescript
                "https://lucidrents.com/nyc/search?q={search_term_string}",
```
to:
```typescript
                "https://lucidrents.com/nyc/search?q={search_term_string}",
```
*(Keep as `/nyc/search` — Google requires a concrete URL pattern, not a variable. This is correct.)*

### Step 2.2: Add `sameAs` social links to Organization schema

In `src/app/page.tsx`, change line 100 from:
```typescript
          sameAs: [],
```
to:
```typescript
          sameAs: [
            "https://www.reddit.com/r/LucidRents/",
            "https://twitter.com/lucidrents",
          ],
```

- [ ] Update `sameAs` in Organization schema in `src/app/page.tsx:100`
- [ ] Verify page source contains `"@type":"WebSite"` and `"@type":"Organization"` with logo

---

## Task 3 — Breadcrumbs on All Pages (Feature #23)

**Files:**
- Modify: `src/lib/seo.ts:181` — add `cityBreadcrumbs()` helper
- Modify: ~14 page files — add `<Breadcrumbs>` component

### Step 3.1: Add `cityBreadcrumbs()` helper to seo.ts

In `src/lib/seo.ts`, append after `breadcrumbJsonLd()` (after line 180):

```typescript
/** Build a standard [Home, {City}, ...trail] breadcrumb array for city pages */
export function cityBreadcrumbs(
  city: City,
  ...trail: { label: string; href: string }[]
): { label: string; href: string }[] {
  return [
    { label: "Home", href: "/" },
    { label: CITY_META[city].name, href: cityPath("", city) },
    ...trail,
  ];
}
```

- [ ] Add `cityBreadcrumbs()` to `src/lib/seo.ts` after line 180

### Step 3.2: Add breadcrumbs to each page

For each page below, add these two things:
1. Import: `import { Breadcrumbs } from "@/components/ui/Breadcrumbs";` and `import { cityBreadcrumbs } from "@/lib/seo";`
2. Render `<Breadcrumbs items={cityBreadcrumbs(city, { label: "...", href: cityPath("/...", city) })} />` as the first element inside the page's content `<div>`, after any hero/header section.

**Pattern for each page:**
```tsx
<Breadcrumbs
  items={cityBreadcrumbs(city as City, { label: "Page Name", href: cityPath("/path", city as City) })}
/>
```

- [ ] `src/app/[city]/tenant-rights/page.tsx` → `...cityBreadcrumbs(city, { label: "Tenant Rights", href: cityPath("/tenant-rights", city) })`
- [ ] `src/app/[city]/tenant-rights/[topic]/page.tsx` → `...cityBreadcrumbs(city, { label: "Tenant Rights", href: cityPath("/tenant-rights", city) }, { label: topic.title, href: cityPath(\`/tenant-rights/${slug}\`, city) })`
- [ ] `src/app/[city]/crime/page.tsx` → `{ label: "Crime Data", href: cityPath("/crime", city) }`
- [ ] `src/app/[city]/compare/page.tsx` → `{ label: "Rental Comparison", href: cityPath("/compare", city) }`
- [ ] `src/app/[city]/transit/page.tsx` → `{ label: "Transit", href: cityPath("/transit", city) }`
- [ ] `src/app/[city]/apartments-near/[line]/page.tsx` → Transit > {Line Name}
- [ ] `src/app/[city]/rent-data/page.tsx` → `{ label: "Rent Data", href: cityPath("/rent-data", city) }`
- [ ] `src/app/[city]/news/page.tsx` → `{ label: "News", href: cityPath("/news", city) }`
- [ ] `src/app/[city]/permits/page.tsx` → `{ label: "Permits", href: cityPath("/permits", city) }`
- [ ] `src/app/[city]/scaffolding/page.tsx` → `{ label: "Scaffolding", href: cityPath("/scaffolding", city) }`
- [ ] `src/app/[city]/energy/page.tsx` → `{ label: "Energy", href: cityPath("/energy", city) }`
- [ ] `src/app/[city]/affordable-housing/page.tsx` → `{ label: "Affordable Housing", href: cityPath("/affordable-housing", city) }`
- [ ] `src/app/[city]/tenant-tools/templates/page.tsx` → Tenant Tools > Templates
- [ ] `src/app/[city]/tenant-tools/templates/[slug]/page.tsx` → Tenant Tools > Templates > {Template Name}
- [ ] Run `npx tsc --noEmit 2>&1 | head -30` — expect no errors

---

## Task 4 — Image Optimization Audit (Feature #19)

**Files:**
- `src/components/layout/Navbar.tsx` — check logo `<img>` vs `<Image>`
- `src/app/page.tsx` — check hero images
- `public/` — verify logo size

### Step 4.1: Audit logo usage in Navbar

- [ ] Read `src/components/layout/Navbar.tsx` — confirm logo uses `<Image>` from `next/image` (not `<img>`)
- [ ] If using `<img>`, replace with `<Image>` and add `priority` prop (it's above the fold)
- [ ] Verify `public/lucid-rents-logo.png` is ≤100KB. If larger, compress with `npx sharp-cli` or replace

### Step 4.2: Audit hero/above-fold images

- [ ] Check `src/app/page.tsx` and city landing pages for `<img>` tags that should be `<Image>`
- [ ] Add `priority` prop to the first `<Image>` on each page (above the fold)
- [ ] Verify skyline WebP variants exist in `public/` alongside JPGs (they should — already present)

---

## Task 5 — Building Timeline View (Feature #10)

**Files:**
- Create: `src/lib/timeline.ts`
- Create: `src/app/[city]/building/[borough]/[slug]/timeline/page.tsx`
- Create: `src/components/building/TimelineView.tsx`
- Create: `src/components/building/TimelineEventCard.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx` — add "View Full Timeline" link

### Step 5.1: Create timeline event normalizer

Create `src/lib/timeline.ts`:

```typescript
export type TimelineEventType =
  | "hpd_violation"
  | "dob_violation"
  | "complaint_311"
  | "litigation"
  | "bedbug"
  | "eviction"
  | "permit";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string; // ISO date string
  title: string;
  description: string;
  severity?: string;
  color: string;
  bgColor: string;
}

export const EVENT_COLORS: Record<TimelineEventType, { color: string; bgColor: string }> = {
  hpd_violation:  { color: "#EF4444", bgColor: "#FEF2F2" },
  dob_violation:  { color: "#F97316", bgColor: "#FFF7ED" },
  complaint_311:  { color: "#EAB308", bgColor: "#FEFCE8" },
  litigation:     { color: "#8B5CF6", bgColor: "#F5F3FF" },
  bedbug:         { color: "#92400E", bgColor: "#FEF3C7" },
  eviction:       { color: "#991B1B", bgColor: "#FEF2F2" },
  permit:         { color: "#3B82F6", bgColor: "#EFF6FF" },
};

export const EVENT_LABELS: Record<TimelineEventType, string> = {
  hpd_violation:  "HPD Violation",
  dob_violation:  "DOB Violation",
  complaint_311:  "311 Complaint",
  litigation:     "Litigation",
  bedbug:         "Bedbug Report",
  eviction:       "Eviction Filing",
  permit:         "Permit",
};

export function normalizeTimelineEvents(data: {
  hpdViolations?: { id: number; novdescription: string; novissueddate: string | null; class_: string | null }[];
  dobViolations?: { id: number; description: string | null; issue_date: string | null; violation_type_code: string | null }[];
  complaints?: { id: number; descriptor: string | null; created_date: string | null; complaint_type: string | null }[];
  litigations?: { id: number; casetype: string | null; openfrom: string | null; penalty: number | null }[];
  bedbugs?: { id: number; filing_date: string | null; infested_dwelling_unit_count: number | null }[];
  evictions?: { id: number; docket_number: string | null; execution_date: string | null }[];
  permits?: { id: number; jobdesc: string | null; issuancedate: string | null; jobtype: string | null }[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  data.hpdViolations?.forEach((v) => {
    if (!v.novissueddate) return;
    const { color, bgColor } = EVENT_COLORS.hpd_violation;
    events.push({
      id: `hpd-${v.id}`,
      type: "hpd_violation",
      date: v.novissueddate,
      title: `HPD Violation — Class ${v.class_ ?? "?"}`,
      description: v.novdescription,
      severity: v.class_ ?? undefined,
      color, bgColor,
    });
  });

  data.dobViolations?.forEach((v) => {
    if (!v.issue_date) return;
    const { color, bgColor } = EVENT_COLORS.dob_violation;
    events.push({
      id: `dob-${v.id}`,
      type: "dob_violation",
      date: v.issue_date,
      title: `DOB Violation${v.violation_type_code ? ` — ${v.violation_type_code}` : ""}`,
      description: v.description ?? "Building code violation issued by DOB.",
      color, bgColor,
    });
  });

  data.complaints?.forEach((c) => {
    if (!c.created_date) return;
    const { color, bgColor } = EVENT_COLORS.complaint_311;
    events.push({
      id: `311-${c.id}`,
      type: "complaint_311",
      date: c.created_date,
      title: c.complaint_type ?? "311 Complaint",
      description: c.descriptor ?? "Resident complaint filed via 311.",
      color, bgColor,
    });
  });

  data.litigations?.forEach((l) => {
    if (!l.openfrom) return;
    const { color, bgColor } = EVENT_COLORS.litigation;
    events.push({
      id: `lit-${l.id}`,
      type: "litigation",
      date: l.openfrom,
      title: l.casetype ?? "Litigation Case",
      description: l.penalty ? `Penalty: $${l.penalty.toLocaleString()}` : "Active litigation case.",
      color, bgColor,
    });
  });

  data.bedbugs?.forEach((b) => {
    if (!b.filing_date) return;
    const { color, bgColor } = EVENT_COLORS.bedbug;
    events.push({
      id: `bb-${b.id}`,
      type: "bedbug",
      date: b.filing_date,
      title: "Bedbug Report",
      description: b.infested_dwelling_unit_count
        ? `${b.infested_dwelling_unit_count} infested unit(s) reported.`
        : "Bedbug infestation reported.",
      color, bgColor,
    });
  });

  data.evictions?.forEach((e) => {
    if (!e.execution_date) return;
    const { color, bgColor } = EVENT_COLORS.eviction;
    events.push({
      id: `evict-${e.id}`,
      type: "eviction",
      date: e.execution_date,
      title: "Eviction Filing",
      description: e.docket_number ? `Docket: ${e.docket_number}` : "Eviction proceeding filed.",
      color, bgColor,
    });
  });

  data.permits?.forEach((p) => {
    if (!p.issuancedate) return;
    const { color, bgColor } = EVENT_COLORS.permit;
    events.push({
      id: `permit-${p.id}`,
      type: "permit",
      date: p.issuancedate,
      title: p.jobtype ? `${p.jobtype} Permit` : "Construction Permit",
      description: p.jobdesc ?? "Construction permit issued.",
      color, bgColor,
    });
  });

  return events.sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] Create `src/lib/timeline.ts` with the above content

### Step 5.2: Create TimelineEventCard component

Create `src/components/building/TimelineEventCard.tsx`:

```tsx
import { type TimelineEvent, EVENT_LABELS } from "@/lib/timeline";

export function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const dateStr = new Date(event.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: event.color }}
        />
        <div className="w-px flex-1 bg-[#e2e8f0] mt-1" />
      </div>
      <div
        className="mb-4 flex-1 rounded-lg border p-4"
        style={{ backgroundColor: event.bgColor, borderColor: event.color + "33" }}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: event.color }}
          >
            {EVENT_LABELS[event.type]}
          </span>
          <span className="text-xs text-[#94a3b8] whitespace-nowrap">{dateStr}</span>
        </div>
        <p className="text-sm font-medium text-[#0F1D2E]">{event.title}</p>
        {event.description && (
          <p className="text-xs text-[#64748b] mt-1 line-clamp-2">{event.description}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/building/TimelineEventCard.tsx`

### Step 5.3: Create TimelineView client component

Create `src/components/building/TimelineView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { type TimelineEvent, type TimelineEventType, EVENT_LABELS } from "@/lib/timeline";
import { TimelineEventCard } from "./TimelineEventCard";

const ALL_TYPES: TimelineEventType[] = [
  "hpd_violation", "dob_violation", "complaint_311",
  "litigation", "bedbug", "eviction", "permit",
];

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEventType>>(
    new Set(ALL_TYPES)
  );

  function toggleType(type: TimelineEventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const filtered = events.filter((e) => activeTypes.has(e.type));

  // Group by year for dividers
  const byYear = filtered.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const year = e.date.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(e);
    return acc;
  }, {});

  const sortedYears = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {ALL_TYPES.map((type) => {
          const active = activeTypes.has(type);
          const count = events.filter((e) => e.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#0F1D2E] text-white border-[#0F1D2E]"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {EVENT_LABELS[type]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[#94a3b8] py-12">No events match the selected filters.</p>
      )}

      {/* Timeline grouped by year */}
      {sortedYears.map((year) => (
        <div key={year}>
          <div className="sticky top-20 z-10 bg-[#f1f5f9] rounded-full px-4 py-1 text-sm font-bold text-[#0F1D2E] inline-block mb-4">
            {year}
          </div>
          {byYear[year].map((event) => (
            <TimelineEventCard key={event.id} event={event} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] Create `src/components/building/TimelineView.tsx`

### Step 5.4: Create the timeline page

Create `src/app/[city]/building/[borough]/[slug]/timeline/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { Metadata } from "next";
import { CITY_META, type City } from "@/lib/cities";
import { regionFromSlug, buildingUrl, canonicalUrl, breadcrumbJsonLd, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { TimelineView } from "@/components/building/TimelineView";
import { normalizeTimelineEvents } from "@/lib/timeline";

export const revalidate = 86400;

const getBuilding = cache(async (boroughSlug: string, slug: string, metro: string) => {
  const city = metro as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, metro")
    .eq("slug", slug)
    .eq("borough", borough)
    .eq("metro", metro)
    .limit(1);
  return data?.[0] ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}): Promise<Metadata> {
  const { city, borough, slug } = await params;
  const building = await getBuilding(borough, slug, city);
  if (!building) return { title: "Not Found" };
  return {
    title: `Full Timeline — ${building.full_address} | Lucid Rents`,
    description: `Complete chronological history of violations, complaints, permits, and legal actions at ${building.full_address}.`,
    alternates: { canonical: canonicalUrl(`${buildingUrl(building, city as City)}/timeline`) },
  };
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}) {
  const { city, borough, slug } = await params;
  const building = await getBuilding(borough, slug, city);
  if (!building) notFound();

  const supabase = await createClient();
  const buildingId = building.id;

  // Fetch all event data in parallel (no limit — full history)
  const [hpdRes, dobRes, complaintsRes, litigationRes, bedbugsRes, evictionsRes, permitsRes] =
    await Promise.all([
      supabase.from("hpd_violations").select("id, novdescription, novissueddate, class_").eq("building_id", buildingId).order("novissueddate", { ascending: false }),
      supabase.from("dob_violations").select("id, description, issue_date, violation_type_code").eq("building_id", buildingId).order("issue_date", { ascending: false }),
      supabase.from("complaints_311").select("id, descriptor, created_date, complaint_type").eq("building_id", buildingId).order("created_date", { ascending: false }),
      supabase.from("hpd_litigations").select("id, casetype, openfrom, penalty").eq("building_id", buildingId).order("openfrom", { ascending: false }),
      supabase.from("bedbug_reports").select("id, filing_date, infested_dwelling_unit_count").eq("building_id", buildingId).order("filing_date", { ascending: false }),
      supabase.from("marshal_evictions").select("id, docket_number, execution_date").eq("building_id", buildingId).order("execution_date", { ascending: false }),
      supabase.from("dob_permits").select("id, jobdesc, issuancedate, jobtype").eq("building_id", buildingId).order("issuancedate", { ascending: false }),
    ]);

  const events = normalizeTimelineEvents({
    hpdViolations: hpdRes.data ?? [],
    dobViolations: dobRes.data ?? [],
    complaints: complaintsRes.data ?? [],
    litigations: litigationRes.data ?? [],
    bedbugs: bedbugsRes.data ?? [],
    evictions: evictionsRes.data ?? [],
    permits: permitsRes.data ?? [],
  });

  const meta = CITY_META[city as City];
  const buildingPath = buildingUrl(building, city as City);
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta.name, href: cityPath("", city as City) },
    { label: building.full_address, href: buildingPath },
    { label: "Timeline", href: `${buildingPath}/timeline` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={breadcrumbJsonLd(breadcrumbs.map((b) => ({ name: b.label, url: b.href })))} />

      {/* Header */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Breadcrumbs items={breadcrumbs} variant="dark" />
          <div className="flex items-center gap-3 mt-6 mb-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Full Building Timeline</h1>
          </div>
          <p className="text-gray-300 text-sm">{building.full_address}</p>
          <p className="text-gray-400 text-sm mt-1">{events.length} total events</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href={buildingPath}
          className="inline-flex items-center gap-2 text-sm text-[#64748b] hover:text-[#0F1D2E] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to building
        </Link>

        <TimelineView events={events} />
      </div>
    </div>
  );
}
```

- [ ] Create `src/app/[city]/building/[borough]/[slug]/timeline/page.tsx`

### Step 5.5: Add "View Full Timeline" link to building page

In `src/app/[city]/building/[borough]/[slug]/page.tsx`, find the section that renders `<SectionNav />` (around lines 7-10 imports). After the `<QuickSummary>` component render, add a timeline link button. Look for the JSX render area and add:

```tsx
{/* Full Timeline link */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
  <Link
    href={`${buildingUrl(building, city as City)}/timeline`}
    className="inline-flex items-center gap-2 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
  >
    <Clock className="w-4 h-4" />
    View full timeline ({/* total event count */})
  </Link>
</div>
```

Add `Clock` to the lucide-react imports at the top of the building page.

- [ ] Add timeline link to building page after QuickSummary section
- [ ] Run `npx tsc --noEmit 2>&1 | head -20` — expect no errors

---

## Task 6 — Pre-Move-In Checklist Tool (Feature #11)

**Files:**
- Create: `src/app/api/checklist/route.ts`
- Create: `src/app/[city]/tenant-tools/checklist/page.tsx`
- Create: `src/components/tenant-tools/ChecklistSearch.tsx`
- Create: `src/components/tenant-tools/ChecklistResults.tsx`
- Modify: `src/app/[city]/tenant-tools/page.tsx` — add checklist card

### Step 6.1: Create the checklist API route

Create `src/app/api/checklist/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
  category: "score" | "violations" | "complaints" | "reviews" | "city_specific";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get("buildingId");
  const city = searchParams.get("city") ?? "nyc";

  if (!buildingId) return NextResponse.json({ error: "buildingId required" }, { status: 400 });

  const supabase = await createClient();

  const [buildingRes, violationsRes, complaintsRes, reviewsRes] = await Promise.all([
    supabase.from("buildings").select("overall_score, open_violations, total_units, rent_stabilized").eq("id", buildingId).single(),
    supabase.from("hpd_violations").select("class_").eq("building_id", buildingId).eq("status", "Open"),
    supabase.from("complaints_311").select("complaint_type, created_date").eq("building_id", buildingId).gte("created_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("reviews").select("overall_score").eq("building_id", buildingId),
  ]);

  const building = buildingRes.data;
  const openViolations = violationsRes.data ?? [];
  const recentComplaints = complaintsRes.data ?? [];
  const reviews = reviewsRes.data ?? [];

  const items: ChecklistItem[] = [];

  // 1. Building score
  const score = building?.overall_score ?? null;
  items.push({
    id: "score",
    label: "Building Score",
    status: score == null ? "info" : score >= 7 ? "pass" : score >= 5 ? "warn" : "fail",
    detail: score != null ? `Score: ${score.toFixed(1)}/10` : "No score data available yet.",
    category: "score",
  });

  // 2. Open violations
  const openCount = openViolations.length;
  const classC = openViolations.filter((v) => v.class_ === "C").length;
  items.push({
    id: "open_violations",
    label: "Open Violations",
    status: openCount === 0 ? "pass" : openCount <= 5 ? "warn" : "fail",
    detail: openCount === 0 ? "No open violations." : `${openCount} open violations${classC > 0 ? ` (${classC} Class C/emergency)` : ""}.`,
    category: "violations",
  });

  // 3. Pest complaints
  const pestComplaints = recentComplaints.filter((c) =>
    ["MICE", "ROACHES", "RATS", "PEST"].some((k) => c.complaint_type?.toUpperCase().includes(k))
  );
  items.push({
    id: "pest",
    label: "Pest Complaints (Last 12 Months)",
    status: pestComplaints.length === 0 ? "pass" : pestComplaints.length <= 2 ? "warn" : "fail",
    detail: pestComplaints.length === 0 ? "No recent pest complaints." : `${pestComplaints.length} pest-related complaint(s) in the last year.`,
    category: "complaints",
  });

  // 4. Heat complaints
  const heatComplaints = recentComplaints.filter((c) =>
    ["HEAT", "HOT WATER"].some((k) => c.complaint_type?.toUpperCase().includes(k))
  );
  items.push({
    id: "heat",
    label: "Heat/Hot Water Complaints (Last 12 Months)",
    status: heatComplaints.length === 0 ? "pass" : heatComplaints.length <= 2 ? "warn" : "fail",
    detail: heatComplaints.length === 0 ? "No recent heat complaints." : `${heatComplaints.length} heat/hot water complaint(s) in the last year.`,
    category: "complaints",
  });

  // 5. Reviews
  const avgReview = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.overall_score ?? 0), 0) / reviews.length
    : null;
  items.push({
    id: "reviews",
    label: "Tenant Reviews",
    status: reviews.length === 0 ? "info" : avgReview! >= 7 ? "pass" : avgReview! >= 4 ? "warn" : "fail",
    detail: reviews.length === 0 ? "No tenant reviews yet." : `${reviews.length} review(s) — avg ${avgReview!.toFixed(1)}/10.`,
    category: "reviews",
  });

  // NYC-specific
  if (city === "nyc") {
    items.push({
      id: "rent_stabilized",
      label: "Rent Stabilized",
      status: building?.rent_stabilized ? "pass" : "info",
      detail: building?.rent_stabilized
        ? "Building has rent-stabilized units — you may have additional protections."
        : "No rent stabilization data on file.",
      category: "city_specific",
    });
  }

  return NextResponse.json({ items });
}
```

- [ ] Create `src/app/api/checklist/route.ts`

### Step 6.2: Create ChecklistSearch client component

Create `src/components/tenant-tools/ChecklistSearch.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import type { ChecklistItem } from "@/app/api/checklist/route";

interface Building {
  id: string;
  full_address: string;
  borough: string;
}

export function ChecklistSearch({ city }: { city: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&city=${city}`);
      const data = await res.json();
      setResults(data.buildings ?? []);
    } finally {
      setLoading(false);
    }
  }, [city]);

  // Trigger search when debounced query changes
  useState(() => { search(debouncedQuery); });

  async function runChecklist(building: Building) {
    setResults([]);
    setQuery(building.full_address);
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/checklist?buildingId=${building.id}&city=${city}`);
      const data = await res.json();
      setChecklist(data.items);
    } finally {
      setChecklistLoading(false);
    }
  }

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
        <input
          type="text"
          placeholder="Search by address or zip code..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e2e8f0] bg-white text-[#0F1D2E] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-sm"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#94a3b8]" />}
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] divide-y divide-[#e2e8f0] mb-6">
          {results.map((b) => (
            <button
              key={b.id}
              onClick={() => runChecklist(b)}
              className="w-full text-left px-4 py-3 hover:bg-[#f8fafc] transition-colors"
            >
              <p className="text-sm font-medium text-[#0F1D2E]">{b.full_address}</p>
              <p className="text-xs text-[#94a3b8]">{b.borough}</p>
            </button>
          ))}
        </div>
      )}

      {checklistLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
        </div>
      )}

      {checklist && !checklistLoading && (
        <ChecklistResultsInline items={checklist} />
      )}
    </div>
  );
}

function ChecklistResultsInline({ items }: { items: ChecklistItem[] }) {
  const statusConfig = {
    pass:  { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D", label: "Pass" },
    warn:  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", label: "Warn" },
    fail:  { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", label: "Fail" },
    info:  { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", label: "Info" },
  };

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cfg = statusConfig[item.status];
        return (
          <div
            key={item.id}
            className="flex items-start gap-4 rounded-xl border p-4"
            style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
          >
            <span
              className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase"
              style={{ color: cfg.text, backgroundColor: cfg.border }}
            >
              {cfg.label}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E]">{item.label}</p>
              <p className="text-xs text-[#64748b] mt-0.5">{item.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] Create `src/components/tenant-tools/ChecklistSearch.tsx`

### Step 6.3: Create the checklist page

Create `src/app/[city]/tenant-tools/checklist/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ChecklistSearch } from "@/components/tenant-tools/ChecklistSearch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const canonical = canonicalUrl(cityPath("/tenant-tools/checklist", city as City));
  return {
    title: `Pre-Move-In Checklist | ${meta.fullName} | Lucid Rents`,
    description: `Before signing a lease, run any ${meta.fullName} apartment through our pre-move-in checklist — violations, complaints, reviews, and city-specific warnings.`,
    alternates: { canonical },
  };
}

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const meta = CITY_META[city as City];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Breadcrumbs
            items={cityBreadcrumbs(
              city as City,
              { label: "Tenant Tools", href: cityPath("/tenant-tools", city as City) },
              { label: "Move-In Checklist", href: cityPath("/tenant-tools/checklist", city as City) }
            )}
            variant="dark"
          />
          <div className="flex items-center gap-3 mt-6 mb-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Pre-Move-In Checklist</h1>
          </div>
          <p className="text-gray-300 max-w-2xl">
            Search any {meta.fullName} building and get a real-time pass/warn/fail checklist before you sign a lease.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ChecklistSearch city={city} />
      </div>
    </div>
  );
}
```

- [ ] Create `src/app/[city]/tenant-tools/checklist/page.tsx`
- [ ] Add checklist card to `src/app/[city]/tenant-tools/page.tsx` (add a card linking to `/tenant-tools/checklist`)
- [ ] Run `npx tsc --noEmit 2>&1 | head -20` — expect no errors

---

## Task 7 — Vibe Check Sections on Area Pages (Feature #12)

**Files:**
- Create: `src/lib/neighborhood-vibes.ts`
- Create: `src/components/neighborhood/VibeCheck.tsx`
- Modify: `src/app/[city]/neighborhood/[slug]/page.tsx`
- Modify: `src/app/[city]/buildings/[borough]/page.tsx`

### Step 7.1: Research and write vibe data

Use WebSearch to research each area. For each, gather: culture/lifestyle, food/nightlife, housing stock character, typical residents, pros/cons, notable landmarks.

Create `src/lib/neighborhood-vibes.ts`:

```typescript
export interface AreaVibe {
  description: string;
  vibeTags: string[];
  pros: string[];
  cons: string[];
}

// Keyed by city → borough/area slug (matching regionSlug output)
export const AREA_VIBES: Record<string, Record<string, AreaVibe>> = {
  nyc: {
    manhattan: {
      description: "...", vibeTags: ["Walkable", "Urban", "Expensive"], pros: [], cons: [],
    },
    brooklyn: { ... },
    queens: { ... },
    bronx: { ... },
    "staten-island": { ... },
  },
  "los-angeles": {
    // Top 15 LA areas
  },
  chicago: {},
  miami: {},
  houston: {},
};
```

- [ ] Research NYC 5 boroughs via WebSearch
- [ ] Research top 15 LA areas via WebSearch
- [ ] Research top 10 Chicago neighborhoods
- [ ] Research top 10 Miami neighborhoods
- [ ] Research top 10 Houston areas
- [ ] Create `src/lib/neighborhood-vibes.ts` with all data

### Step 7.2: Create VibeCheck component

Create `src/components/neighborhood/VibeCheck.tsx`:

```tsx
import type { AreaVibe } from "@/lib/neighborhood-vibes";

export function VibeCheck({ vibe, areaName }: { vibe: AreaVibe; areaName: string }) {
  return (
    <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8">
      <h2 className="text-xl font-bold text-[#0F1D2E] mb-3">
        What&apos;s it like to live in {areaName}?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-5">{vibe.description}</p>

      {/* Vibe tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {vibe.vibeTags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Pros/Cons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">Pros</h3>
          <ul className="space-y-1">
            {vibe.pros.map((p) => (
              <li key={p} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">+</span> {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-2">Cons</h3>
          <ul className="space-y-1">
            {vibe.cons.map((c) => (
              <li key={c} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">–</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] Create `src/components/neighborhood/VibeCheck.tsx`

### Step 7.3: Add VibeCheck to area pages

In `src/app/[city]/neighborhood/[slug]/page.tsx`, import `AREA_VIBES` and `VibeCheck`, look up vibe by `city` + `regionSlug(neighborhoodName)`, render at bottom of page before closing `</AdSidebar>`.

In `src/app/[city]/buildings/[borough]/page.tsx`, same pattern using the borough slug.

- [ ] Add VibeCheck to `src/app/[city]/neighborhood/[slug]/page.tsx`
- [ ] Add VibeCheck to `src/app/[city]/buildings/[borough]/page.tsx`

---

## Task 8 — Rental Comparison Rebrand + Neighborhood Compare (Feature #2)

**Files:**
- Modify: `src/app/[city]/compare/page.tsx` — rebrand metadata, add neighborhood mode
- Modify: `src/components/compare/CompareGrid.tsx` — update copy

### Step 8.1: Rebrand metadata

In `src/app/[city]/compare/page.tsx`, change `generateMetadata` (line 19-31):
- Title: `Rental Comparison — ${cityName} | Lucid Rents`
- Description: `Compare ${cityName} apartments and neighborhoods side by side — violations, scores, reviews, rent data, and more.`

- [ ] Update title and description in `src/app/[city]/compare/page.tsx:22-26`

### Step 8.2: Add neighborhood comparison tab

Add a tab toggle above the existing `<CompareSearch>` with two modes: "Buildings" and "Neighborhoods". When "Neighborhoods" is selected, show two neighborhood slug inputs and fetch stats from the `neighborhood_stats` RPC for each. Render a side-by-side table showing: median rent, crime rate, violation density, avg building score, transit access.

- [ ] Add mode toggle to `src/app/[city]/compare/page.tsx`
- [ ] Create `src/components/compare/NeighborhoodCompare.tsx` — takes 2 neighborhood slugs, fetches and displays stats
- [ ] Update heading copy in `src/components/compare/CompareGrid.tsx`

---

## Task 9 — Apartments Near Landmarks (Feature #1)

**Files:**
- Create: `src/lib/landmarks.ts`
- Modify: `src/app/[city]/transit/page.tsx` — add Landmarks section
- Create: `src/app/[city]/apartments-near/[landmark-slug]/page.tsx`

### Step 9.1: Create landmarks data file

Create `src/lib/landmarks.ts`:

```typescript
export interface Landmark {
  name: string;
  slug: string;
  category: "employer" | "university" | "hospital" | "landmark";
  lat: number;
  lng: number;
  city: string;
}

export const LANDMARKS: Landmark[] = [
  // NYC
  { name: "NYU", slug: "nyu", category: "university", lat: 40.7295, lng: -73.9965, city: "nyc" },
  { name: "Columbia University", slug: "columbia-university", category: "university", lat: 40.8075, lng: -73.9626, city: "nyc" },
  { name: "Cornell Tech", slug: "cornell-tech", category: "university", lat: 40.7569, lng: -73.9548, city: "nyc" },
  { name: "NYP/Weill Cornell", slug: "nypweill-cornell", category: "hospital", lat: 40.7655, lng: -73.9547, city: "nyc" },
  { name: "Mount Sinai", slug: "mount-sinai", category: "hospital", lat: 40.7900, lng: -73.9527, city: "nyc" },
  { name: "Midtown Manhattan", slug: "midtown-manhattan", category: "employer", lat: 40.7549, lng: -73.9840, city: "nyc" },
  { name: "Financial District", slug: "financial-district", category: "employer", lat: 40.7074, lng: -74.0113, city: "nyc" },
  { name: "Brooklyn Navy Yard", slug: "brooklyn-navy-yard", category: "employer", lat: 40.7003, lng: -73.9701, city: "nyc" },
  // LA
  { name: "UCLA", slug: "ucla", category: "university", lat: 34.0689, lng: -118.4452, city: "los-angeles" },
  { name: "USC", slug: "usc", category: "university", lat: 34.0224, lng: -118.2851, city: "los-angeles" },
  { name: "Cedars-Sinai", slug: "cedars-sinai", category: "hospital", lat: 34.0761, lng: -118.3800, city: "los-angeles" },
  { name: "Downtown LA", slug: "downtown-la", category: "employer", lat: 34.0522, lng: -118.2437, city: "los-angeles" },
  { name: "Santa Monica", slug: "santa-monica", category: "landmark", lat: 34.0195, lng: -118.4912, city: "los-angeles" },
  // Chicago
  { name: "University of Chicago", slug: "university-of-chicago", category: "university", lat: 41.7886, lng: -87.5987, city: "chicago" },
  { name: "Northwestern Memorial Hospital", slug: "northwestern-memorial", category: "hospital", lat: 41.8953, lng: -87.6220, city: "chicago" },
  { name: "The Loop", slug: "the-loop", category: "employer", lat: 41.8827, lng: -87.6233, city: "chicago" },
  // Miami
  { name: "University of Miami", slug: "university-of-miami", category: "university", lat: 25.7156, lng: -80.2789, city: "miami" },
  { name: "Brickell", slug: "brickell", category: "employer", lat: 25.7617, lng: -80.1918, city: "miami" },
  // Houston
  { name: "Rice University", slug: "rice-university", category: "university", lat: 29.7174, lng: -95.4018, city: "houston" },
  { name: "Texas Medical Center", slug: "texas-medical-center", category: "hospital", lat: 29.7085, lng: -95.3997, city: "houston" },
  { name: "Downtown Houston", slug: "downtown-houston", category: "employer", lat: 29.7589, lng: -95.3677, city: "houston" },
];
```

- [ ] Create `src/lib/landmarks.ts` with landmark data for all 5 cities

### Step 9.2: Add Landmarks section to transit page

In `src/app/[city]/transit/page.tsx`, after the existing transit sections, add a "Apartments Near Landmarks" section that:
- Filters `LANDMARKS` by `city`
- Groups by category
- Links each landmark to `/[city]/apartments-near/[slug]`

- [ ] Add "Apartments Near Landmarks" section to `src/app/[city]/transit/page.tsx`

### Step 9.3: Create landmark apartment pages

Create `src/app/[city]/apartments-near/[landmark-slug]/page.tsx` — follows same pattern as `apartments-near/[line]/page.tsx`. Fetch the landmark from `LANDMARKS`, call `/api/buildings/nearby` with `lat`, `lng`, `radius=0.5`, render building cards.

- [ ] Create `src/app/[city]/apartments-near/[landmark-slug]/page.tsx`

---

## Task 10 — Best Apartments Under $X (Feature #3)

**Files:**
- Create: `src/components/neighborhood/BestApartments.tsx`
- Modify: `src/app/[city]/neighborhood/[slug]/page.tsx`
- Modify: `src/app/[city]/buildings/[borough]/page.tsx`

### Step 10.1: Create BestApartments component

Create `src/components/neighborhood/BestApartments.tsx` — client component with price tier tabs ($1,500 / $2,000 / $2,500 / $3,000+). Accepts `city`, `zipCode`/`borough`, fetches top 5 buildings per tier from Supabase joining `buildings` + `building_rents`, sorted by `overall_score` desc.

- [ ] Create `src/components/neighborhood/BestApartments.tsx`
- [ ] Add to `src/app/[city]/neighborhood/[slug]/page.tsx`
- [ ] Add to `src/app/[city]/buildings/[borough]/page.tsx`

---

## Task 11 — Rent Stabilization Enhancement (Feature #4)

**Files:**
- Modify: `src/app/[city]/rent-stabilization/page.tsx` — better metadata, add FAQ, improve UX

### Step 11.1: Improve rent stabilization page

- [ ] Update page title to be more tenant-facing: "Is My Apartment Rent Stabilized? — {City}"
- [ ] Add FAQ section explaining what stabilization means (what protections you get, how to find out)
- [ ] Add breadcrumbs
- [ ] Run `npx tsc --noEmit 2>&1 | head -20`

---

## Task 12 — Embeddable Building Widgets (Feature #14)

**Files:**
- Create: `src/app/embed/layout.tsx`
- Create: `src/app/embed/building/[id]/page.tsx`
- Create: `src/components/building/EmbedBadge.tsx`
- Create: `src/components/building/EmbedCodeModal.tsx`
- Modify: `src/components/building/ShareButton.tsx`
- Modify: `next.config.ts`

### Step 12.1: Override X-Frame-Options for embed routes

In `next.config.ts`, add a new header rule *before* the global `"/(.*)"` rule (more specific rules take precedence in Next.js — actually they need to come after since last-write wins for the same header, so add a second entry):

```typescript
// Allow embedding for /embed/* routes only
{
  source: "/embed/:path*",
  headers: [
    { key: "X-Frame-Options", value: "ALLOWALL" },
    { key: "Content-Security-Policy", value: "frame-ancestors *" },
  ],
},
```

Add this to the `headers` array in `next.config.ts` after the global rule.

- [ ] Add embed frame-allow headers to `next.config.ts`

### Step 12.2: Create embed layout

Create `src/app/embed/layout.tsx`:

```tsx
import "@/app/globals.css";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white m-0 p-0">{children}</body>
    </html>
  );
}
```

- [ ] Create `src/app/embed/layout.tsx`

### Step 12.3: Create EmbedBadge component

Create `src/components/building/EmbedBadge.tsx`:

```tsx
import Link from "next/link";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { getLetterGrade, getGradeColor } from "@/lib/constants";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface EmbedBadgeProps {
  building: {
    id: string;
    full_address: string;
    borough: string;
    slug: string;
    overall_score: number | null;
    open_violations: number;
    review_count: number;
    metro: string;
  };
  theme?: "light" | "dark";
}

export function EmbedBadge({ building, theme = "light" }: EmbedBadgeProps) {
  const dark = theme === "dark";
  const grade = building.overall_score != null ? getLetterGrade(building.overall_score) : "N/A";
  const gradeColor = building.overall_score != null ? getGradeColor(building.overall_score) : "#94a3b8";
  const buildingLink = `https://lucidrents.com${buildingUrl(building, building.metro as City)}`;

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 font-sans ${dark ? "bg-[#0F1D2E] border-white/10 text-white" : "bg-white border-[#e2e8f0] text-[#0F1D2E]"}`}
      style={{ width: 400, height: 180 }}
    >
      {/* Grade circle */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
        style={{ backgroundColor: gradeColor }}
      >
        {grade}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${dark ? "text-white" : "text-[#0F1D2E]"}`}>
          {building.full_address}
        </p>
        <p className={`text-xs mt-0.5 ${dark ? "text-white/60" : "text-[#64748b]"}`}>
          {building.borough}
        </p>
        <div className="flex gap-4 mt-3 text-xs">
          <span>
            <span className={dark ? "text-white/50" : "text-[#94a3b8]"}>Score: </span>
            <span className="font-semibold">{building.overall_score?.toFixed(1) ?? "—"}/10</span>
          </span>
          <span>
            <span className={dark ? "text-white/50" : "text-[#94a3b8]"}>Open violations: </span>
            <span className={`font-semibold ${building.open_violations > 0 ? "text-red-500" : ""}`}>{building.open_violations}</span>
          </span>
        </div>

        {/* Score bar */}
        {building.overall_score != null && (
          <div className={`mt-3 h-1.5 rounded-full ${dark ? "bg-white/10" : "bg-[#f1f5f9]"}`}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${(building.overall_score / 10) * 100}%`, backgroundColor: gradeColor }}
            />
          </div>
        )}
      </div>

      {/* Powered by */}
      <div className="self-end shrink-0">
        <a
          href={buildingLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[10px] ${dark ? "text-white/30 hover:text-white/60" : "text-[#94a3b8] hover:text-[#64748b]"} transition-colors`}
        >
          Lucid Rents
        </a>
      </div>
    </div>
  );
}
```

- [ ] Create `src/components/building/EmbedBadge.tsx`

### Step 12.4: Create embed building page

Create `src/app/embed/building/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmbedBadge } from "@/components/building/EmbedBadge";

export const revalidate = 3600;

export default async function EmbedBuildingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { id } = await params;
  const { theme } = await searchParams;

  const supabase = await createClient();
  const { data: building } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, overall_score, open_violations, review_count, metro")
    .eq("id", id)
    .single();

  if (!building) notFound();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <EmbedBadge building={building} theme={theme === "dark" ? "dark" : "light"} />
    </div>
  );
}
```

- [ ] Create `src/app/embed/building/[id]/page.tsx`

### Step 12.5: Create EmbedCodeModal component

Create `src/components/building/EmbedCodeModal.tsx` — client component that shows a modal with:
- Live `<iframe>` preview of the embed
- Generated code: `<iframe src="https://lucidrents.com/embed/building/[id]" width="400" height="180" frameborder="0"></iframe>`
- Copy to clipboard button

Add an "Embed" option to `src/components/building/ShareButton.tsx` that opens this modal.

- [ ] Create `src/components/building/EmbedCodeModal.tsx`
- [ ] Add "Embed" option to `src/components/building/ShareButton.tsx`
- [ ] Run `npx tsc --noEmit 2>&1 | head -20` — expect no errors

---

## Final Verification

- [ ] Run `npm run build` — expect clean build, no TypeScript errors
- [ ] Visit `/nyc/tenant-rights/rent-stabilization-rights` — confirm FAQ accordion renders + view source for `"@type":"FAQPage"`
- [ ] Visit `/nyc/crime` — confirm breadcrumbs render with JSON-LD
- [ ] Visit any building page → click "View Full Timeline" — confirm timeline loads with colored events and filter chips
- [ ] Visit `/nyc/tenant-tools/checklist` — search a building, confirm pass/warn/fail results render
- [ ] Visit `/embed/building/[any-id]` — confirm minimal layout (no navbar) renders the badge
- [ ] View source on homepage — confirm `"@type":"WebSite"` and `"@type":"Organization"` present
- [ ] Run `npm run build` one final time
