# Fair Rent Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone "Fair Rent Engine" page for NYC renters that accepts a StreetEasy URL, calculates a fair price range from comps + ZORI + amenities + seasonality, and displays building quality signals from NYC Open Data — all styled after the editorial RentCheck demo design.

**Architecture:** Self-contained Next.js page at `/fair-rent-engine` with a client-side multi-screen UI (landing → loading → results). A single API route (`/api/fair-rent/analyze`) orchestrates: StreetEasy scraping via existing `scripts/scrape-rents.mjs` patterns, ZORI CSV lookup, NYC Open Data SODA queries (HPD violations, 311 complaints, litigations, crime), rent stabilization check, and the pricing model. All components live in `src/components/fair-rent/` — no changes to any existing files.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Recharts (already installed), Framer Motion (already installed), Lucide icons (already installed), Zod validation, native fetch for NYC Open Data SODA APIs.

**Design Language:** Adapted from the RentCheck HTML demo — dark hero landing, pill-shaped URL input, step-by-step loading animation, off-white results page with editorial card layout. Uses the existing site's Geist font stack and design token colors (`#0F1D2E` primary, `#3B82F6` accent, grade colors from `design-tokens.ts`) rather than the demo's DM Serif Display.

---

## File Structure

```
src/
├── app/
│   ├── fair-rent-engine/
│   │   └── page.tsx                    # Server component: metadata + shell
│   └── api/
│       └── fair-rent/
│           └── analyze/
│               └── route.ts            # POST handler — orchestrates all data fetching
├── components/
│   └── fair-rent/
│       ├── FairRentApp.tsx             # Client root — manages screen state (landing/loading/results)
│       ├── LandingHero.tsx             # Dark hero with URL input
│       ├── LoadingSequence.tsx         # Step-by-step loading animation
│       ├── ResultsShell.tsx            # Results page wrapper (off-white bg, nav, back button)
│       ├── ListingHeader.tsx           # Address, meta, asking price
│       ├── PricingVerdict.tsx           # Top-line overpriced/fair/underpriced banner
│       ├── ManualEntryForm.tsx         # Fallback form when scraping fails
│       ├── FairPriceCard.tsx           # Price range, comp chart, calculation breakdown
│       ├── SeasonalSignalCard.tsx      # Season badge + negotiation tip
│       ├── BuildingScorecardGrid.tsx   # 2×2 grid: violations, complaints, stabilization, litigations
│       ├── NeighborhoodSafetyCard.tsx  # Crime grade + trend
│       ├── TenantRightsCallout.tsx     # Conditional alert boxes
│       └── types.ts                    # Shared TypeScript interfaces for API response
└── lib/
    └── fair-rent/
        ├── pricing-model.ts            # 5-step pricing calculation (pure functions)
        ├── zori-lookup.ts              # ZORI CSV parser + ZIP lookup
        ├── nyc-open-data.ts            # HPD, 311, litigations, crime fetchers
        ├── rent-stabilization.ts       # Stabilization check via Supabase
        ├── streeteasy-scraper.ts       # Listing + comp scraping
        └── constants.ts                # Amenity multipliers, seasonal thresholds, ZIP populations
```

**No existing files are modified.** This feature is entirely additive.

---

## Task 1: Shared Types & Constants

**Files:**
- Create: `src/components/fair-rent/types.ts`
- Create: `src/lib/fair-rent/constants.ts`

- [ ] **Step 1: Create the API response type definitions**

```ts
// src/components/fair-rent/types.ts

export interface AnalyzeRequest {
  url: string;
  amenities?: string[];
}

export interface ListingData {
  asking_price: number;
  beds: number;
  baths: number | null;
  sqft: number | null;
  floor: number | null;
  zip_code: string;
  address: string;
  days_on_market: number | null;
  price_cut: { occurred: boolean; amount: number | null } | null;
  listed_amenities: string[];
}

export interface PricingResult {
  base_price: number;
  comp_count: number;
  comp_prices: number[];
  fallback_triggered: boolean;
  zori_current: number | null;
  zori_12mo_avg: number | null;
  zori_blend_triggered: boolean;
  blended_base: number;
  amenity_multiplier: number;
  amenity_adjustments: { name: string; value: number }[];
  seasonal_factor: number;
  seasonal_signal: "high" | "low" | "neutral" | "unknown";
  seasonal_label: string;
  negotiation_tip: string;
  fair_price: number;
  fair_range_low: number;
  fair_range_high: number;
  asking_vs_fair_pct: number;
}

export interface ViolationsSignal {
  open_a: number;
  open_b: number;
  open_c: number;
  closed_12mo: number;
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface ComplaintsSignal {
  total_complaints: number;
  top_categories: { category: string; count: number }[];
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface StabilizationSignal {
  is_stabilized: boolean;
  stabilized_units: number | null;
  total_units: number | null;
  yoy_unit_change_pct: number | null;
  summary: string;
}

export interface LitigationsSignal {
  active_litigations: number;
  closed_litigations_3yr: number;
  case_types: string[];
  has_harassment_case: boolean;
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface CrimeSignal {
  violent_count: number;
  property_count: number;
  qol_count: number;
  yoy_violent_trend: number;
  per_1k_violent: number;
  safety_grade: "A" | "B" | "C" | "D" | "F";
  trend_label: "improving" | "stable" | "worsening";
  summary: string;
}

export interface AnalyzeResponse {
  listing: ListingData;
  pricing: PricingResult;
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  stabilization: StabilizationSignal | null;
  litigations: LitigationsSignal | null;
  crime: CrimeSignal | null;
}

export type Screen = "landing" | "loading" | "results" | "error";
```

- [ ] **Step 2: Create constants file**

```ts
// src/lib/fair-rent/constants.ts

export const AMENITY_MULTIPLIERS: Record<string, number> = {
  doorman: 0.09,
  elevator: 0.05,
  private_outdoor_space: 0.06,
  in_unit_laundry: 0.04,
  gym: 0.02,
  parking: 0.06,
  // Negative
  no_elevator: -0.05,
};

export const AMENITY_POSITIVE_CAP = 0.20;
export const AMENITY_NEGATIVE_FLOOR = -0.10;

export const SEASONAL_HIGH_THRESHOLD = 1.03;
export const SEASONAL_LOW_THRESHOLD = 0.97;

export const ZORI_DIVERGENCE_THRESHOLD = 0.20;
export const ZORI_BLEND_WEIGHT_COMP = 0.70;
export const ZORI_BLEND_WEIGHT_ZORI = 0.30;

// Census ACS 2022 — population per ZIP for crime normalization
export const NYC_ZIP_POPULATIONS: Record<string, number> = {
  "10001": 21102, "10002": 81410, "10003": 56024, "10004": 3089,
  "10005": 7135, "10006": 3011, "10007": 6988, "10009": 61347,
  "10010": 30637, "10011": 50918, "10012": 22785, "10013": 25666,
  "10014": 32427, "10016": 48590, "10017": 14568, "10018": 10843,
  "10019": 52058, "10020": 1221, "10021": 50145, "10022": 26180,
  "10023": 60780, "10024": 57020, "10025": 94600, "10026": 33610,
  "10027": 40370, "10028": 40600, "10029": 54990, "10030": 27540,
  "10031": 42800, "10032": 41100, "10033": 54940, "10034": 38550,
  "10035": 28640, "10036": 13860, "10037": 17210, "10038": 19020,
  "10039": 19800, "10040": 34750, "10044": 11961, "10065": 31150,
  "10069": 6280, "10075": 19140, "10128": 46880, "10280": 8384,
  "10301": 37700, "10302": 16560, "10303": 28540, "10304": 33730,
  "10305": 32810, "10306": 42570, "10307": 14120, "10308": 24970,
  "10309": 28620, "10310": 23410, "10312": 46700, "10314": 55860,
  "11101": 30120, "11102": 15230, "11103": 35310, "11104": 22780,
  "11105": 23270, "11106": 22370, "11201": 57650, "11203": 58370,
  "11204": 56690, "11205": 38270, "11206": 52170, "11207": 72720,
  "11208": 73600, "11209": 43300, "11210": 55920, "11211": 51340,
  "11212": 55800, "11213": 52630, "11214": 57960, "11215": 56290,
  "11216": 34440, "11217": 27530, "11218": 49710, "11219": 52530,
  "11220": 60140, "11221": 51560, "11222": 29920, "11223": 50950,
  "11224": 34110, "11225": 36700, "11226": 64580, "11228": 31080,
  "11229": 50820, "11230": 53950, "11231": 26440, "11232": 14590,
  "11233": 40130, "11234": 55090, "11235": 54410, "11236": 63710,
  "11237": 28260, "11238": 35870, "11239": 18380,
  "10451": 43910, "10452": 56270, "10453": 52870, "10454": 25900,
  "10455": 33680, "10456": 49780, "10457": 47100, "10458": 50480,
  "10459": 35810, "10460": 39770, "10461": 41340, "10462": 52880,
  "10463": 51230, "10464": 4180, "10465": 28620, "10466": 44070,
  "10467": 60660, "10468": 52350, "10469": 42830, "10470": 12550,
  "10471": 15320, "10472": 41650, "10473": 28250, "10474": 5640,
  "10475": 35360,
};

export const STREETEASY_URL_REGEX = /^https?:\/\/(www\.)?streeteasy\.com\/(rental|building|apartments?|apt)\/.+/i;

export const LOADING_STEPS = [
  "Pulling listing data from StreetEasy",
  "Building comp pool from active listings",
  "Validating against Zillow ZORI index",
  "Applying amenity + seasonal adjustments",
  "Checking rent stabilization records",
  "Scanning HPD violations + 311 complaints",
  "Assessing neighborhood safety data",
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/fair-rent/types.ts src/lib/fair-rent/constants.ts
git commit -m "feat(fair-rent): add shared types and constants"
```

---

## Task 2: ZORI CSV Lookup

**Files:**
- Create: `src/lib/fair-rent/zori-lookup.ts`

**Prereq:** Download ZORI CSV from Zillow Research and place at `public/data/zori-nyc.csv`. The file should contain columns: `RegionName` (ZIP), `SizeRank`, and monthly date columns with rent values. Filter to NYC ZIPs only to keep file small (~50KB).

- [ ] **Step 1: Create the ZORI lookup module**

```ts
// src/lib/fair-rent/zori-lookup.ts
import { readFile } from "fs/promises";
import path from "path";

interface ZoriRow {
  zip_code: string;
  monthly_values: { date: string; value: number }[];
}

let cache: ZoriRow[] | null = null;

/** Simple CSV parser — no external dependency needed for ZORI's flat structure */
function parseSimpleCsv(raw: string): Record<string, string>[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = values[i] || ""; });
    return record;
  });
}

async function loadZori(): Promise<ZoriRow[]> {
  if (cache) return cache;

  const csvPath = path.join(process.cwd(), "public", "data", "zori-nyc.csv");
  const raw = await readFile(csvPath, "utf-8");
  const records = parseSimpleCsv(raw);

  cache = records.map((row) => {
    const zip_code = row["RegionName"];
    const monthly_values: { date: string; value: number }[] = [];

    for (const [key, val] of Object.entries(row)) {
      // Date columns look like "2024-01-31"
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && val) {
        monthly_values.push({ date: key, value: parseFloat(val) });
      }
    }

    monthly_values.sort((a, b) => a.date.localeCompare(b.date));
    return { zip_code, monthly_values };
  });

  return cache;
}

export interface ZoriLookupResult {
  current: number | null;
  avg_12mo: number | null;
}

export async function lookupZori(zipCode: string): Promise<ZoriLookupResult> {
  const rows = await loadZori();
  const row = rows.find((r) => r.zip_code === zipCode);

  if (!row || row.monthly_values.length === 0) {
    // Fallback: try NYC metro average across all loaded ZIPs
    const allLatest = rows
      .map((r) => r.monthly_values[r.monthly_values.length - 1]?.value)
      .filter((v): v is number => v != null && !isNaN(v));

    if (allLatest.length === 0) return { current: null, avg_12mo: null };

    const metroAvg = allLatest.reduce((a, b) => a + b, 0) / allLatest.length;
    return { current: metroAvg, avg_12mo: metroAvg };
  }

  const vals = row.monthly_values;
  const current = vals[vals.length - 1]?.value ?? null;
  const last12 = vals.slice(-12).map((v) => v.value);
  const avg_12mo =
    last12.length > 0
      ? last12.reduce((a, b) => a + b, 0) / last12.length
      : null;

  return { current, avg_12mo };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fair-rent/zori-lookup.ts
git commit -m "feat(fair-rent): add ZORI CSV lookup with ZIP fallback"
```

---

## Task 3: NYC Open Data Fetchers

**Files:**
- Create: `src/lib/fair-rent/nyc-open-data.ts`

Each function queries a SODA API endpoint with an 8-second timeout, returns typed signal data, and never throws (returns `null` on failure).

- [ ] **Step 1: Create the fetcher module**

```ts
// src/lib/fair-rent/nyc-open-data.ts
import type {
  ViolationsSignal,
  ComplaintsSignal,
  LitigationsSignal,
  CrimeSignal,
} from "@/components/fair-rent/types";
import { NYC_ZIP_POPULATIONS } from "./constants";

const SODA_TIMEOUT = 8000;

async function sodaFetch<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SODA_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function classify(
  building: number,
  zipMedian: number
): "above_average" | "average" | "below_average" {
  if (zipMedian === 0) return "average";
  if (building > zipMedian * 1.5) return "above_average";
  if (building < zipMedian * 0.5) return "below_average";
  return "average";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── HPD Violations ──

export async function fetchViolations(
  address: string,
  zipCode: string
): Promise<ViolationsSignal | null> {
  const encodedAddr = encodeURIComponent(address.toUpperCase());
  const buildingUrl = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$where=upper(boroname || ' ' || block || ' ' || lot) like '%25${encodedAddr}%25' OR upper(streetname) like '%25${encodedAddr}%25'&$limit=1000`;

  // Simpler: query by approximate street address
  const parts = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
  if (!parts) return null;

  const houseNumber = parts[1];
  const street = parts[2].trim().toUpperCase();
  const encodedStreet = encodeURIComponent(street);

  const url = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$where=housenumber='${houseNumber}' AND upper(streetname) like '%25${encodedStreet}%25'&$limit=1000`;
  const data = await sodaFetch<Record<string, string>[]>(url);
  if (!data) return null;

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  let open_a = 0, open_b = 0, open_c = 0, closed_12mo = 0;
  for (const v of data) {
    const status = (v.currentstatus || "").toUpperCase();
    const cls = (v.class || v.violationclass || "").toUpperCase();
    if (status === "OPEN" || !v.currentstatusdate) {
      if (cls === "A") open_a++;
      else if (cls === "B") open_b++;
      else if (cls === "C") open_c++;
    } else if (v.currentstatusdate && new Date(v.currentstatusdate) >= oneYearAgo) {
      closed_12mo++;
    }
  }

  // ZIP benchmark
  const zipUrl = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$select=boroid,block,lot,count(*) as cnt&$where=postcode='${zipCode}' AND currentstatus='OPEN'&$group=boroid,block,lot&$limit=5000`;
  const zipData = await sodaFetch<{ cnt: string }[]>(zipUrl);
  const zipCounts = (zipData || []).map((r) => parseInt(r.cnt, 10));
  const zip_median = median(zipCounts);

  const totalOpen = open_a + open_b + open_c;
  const classification = classify(totalOpen, zip_median);

  return {
    open_a, open_b, open_c, closed_12mo, zip_median, classification,
    summary: `This building has ${totalOpen} open violations (${open_c} serious). ZIP median is ${zip_median}. This building is ${classification.replace("_", " ")}.`,
  };
}

// ── 311 Complaints ──

export async function fetchComplaints(
  address: string,
  zipCode: string
): Promise<ComplaintsSignal | null> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateStr = oneYearAgo.toISOString().slice(0, 10);

  const parts = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
  if (!parts) return null;

  const houseNumber = parts[1];
  const street = encodeURIComponent(parts[2].trim().toUpperCase());

  const url = `https://data.cityofnewyork.us/resource/erm2-nwe9.json?$where=incident_address like '%25${houseNumber}%25${street}%25' AND created_date>='${dateStr}'&$limit=500`;
  const data = await sodaFetch<Record<string, string>[]>(url);
  if (!data) return null;

  const flagCategories = ["HEAT/HOT WATER", "PEST", "NOISE", "ELEVATOR", "MOLD", "PAINT", "WATER LEAK"];
  const catCounts: Record<string, number> = {};
  for (const c of data) {
    const type = (c.complaint_type || "").toUpperCase();
    catCounts[type] = (catCounts[type] || 0) + 1;
  }

  const top_categories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));

  // ZIP benchmark
  const zipUrl = `https://data.cityofnewyork.us/resource/erm2-nwe9.json?$select=incident_address,count(*) as cnt&$where=incident_zip='${zipCode}' AND created_date>='${dateStr}'&$group=incident_address&$limit=5000`;
  const zipData = await sodaFetch<{ cnt: string }[]>(zipUrl);
  const zipCounts = (zipData || []).map((r) => parseInt(r.cnt, 10));
  const zip_median = median(zipCounts);

  const total_complaints = data.length;
  const classification = classify(total_complaints, zip_median);

  return {
    total_complaints, top_categories, zip_median, classification,
    summary: `This building had ${total_complaints} complaints in the past year (ZIP median: ${zip_median}). Most common: ${top_categories.map((c) => c.category).join(", ")}. This building is ${classification.replace("_", " ")}.`,
  };
}

// ── Litigations ──

export async function fetchLitigations(
  address: string,
  zipCode: string
): Promise<LitigationsSignal | null> {
  const parts = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
  if (!parts) return null;

  const houseNumber = parts[1];
  const street = encodeURIComponent(parts[2].trim().toUpperCase());

  const url = `https://data.cityofnewyork.us/resource/59kj-x8nc.json?$where=housenumber='${houseNumber}' AND upper(streetname) like '%25${street}%25'&$limit=200`;
  const data = await sodaFetch<Record<string, string>[]>(url);
  if (!data) return null;

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  let active = 0, closed3yr = 0, hasHarassment = false;
  const caseTypeSet = new Set<string>();

  for (const lit of data) {
    const status = (lit.status || "").toUpperCase();
    const caseType = lit.casetype || lit.case_type || "";
    if (caseType) caseTypeSet.add(caseType);
    if (caseType.toUpperCase().includes("HARASSMENT")) hasHarassment = true;

    if (status === "OPEN" || status === "ACTIVE") {
      active++;
    } else if (lit.statusdate && new Date(lit.statusdate) >= threeYearsAgo) {
      closed3yr++;
    }
  }

  // ZIP benchmark
  const zipUrl = `https://data.cityofnewyork.us/resource/59kj-x8nc.json?$select=boroid,block,lot,count(*) as cnt&$where=postcode='${zipCode}' AND status='OPEN'&$group=boroid,block,lot&$limit=5000`;
  const zipData = await sodaFetch<{ cnt: string }[]>(zipUrl);
  const zipCounts = (zipData || []).map((r) => parseInt(r.cnt, 10));
  const zip_median = median(zipCounts);

  const classification = hasHarassment ? "above_average" as const : classify(active, zip_median);

  return {
    active_litigations: active,
    closed_litigations_3yr: closed3yr,
    case_types: [...caseTypeSet],
    has_harassment_case: hasHarassment,
    zip_median,
    classification,
    summary: `This building has ${active} active legal cases and ${closed3yr} closed in 3 years. ZIP average: ${zip_median}. ${hasHarassment ? "⚠ Tenant harassment case on record." : ""}`,
  };
}

// ── Crime ──

export async function fetchCrime(zipCode: string): Promise<CrimeSignal | null> {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const dateStr1 = oneYearAgo.toISOString().slice(0, 10);
  const dateStr2 = twoYearsAgo.toISOString().slice(0, 10);

  // Current year
  const url1 = `https://data.cityofnewyork.us/resource/qgea-i56i.json?$select=law_cat_cd,count(*) as cnt&$where=zip_code='${zipCode}' AND cmplnt_fr_dt>='${dateStr1}'&$group=law_cat_cd&$limit=10`;
  // Prior year
  const url2 = `https://data.cityofnewyork.us/resource/qgea-i56i.json?$select=law_cat_cd,count(*) as cnt&$where=zip_code='${zipCode}' AND cmplnt_fr_dt>='${dateStr2}' AND cmplnt_fr_dt<'${dateStr1}'&$group=law_cat_cd&$limit=10`;

  const [current, prior] = await Promise.all([
    sodaFetch<{ law_cat_cd: string; cnt: string }[]>(url1),
    sodaFetch<{ law_cat_cd: string; cnt: string }[]>(url2),
  ]);

  if (!current) return null;

  const getCat = (data: { law_cat_cd: string; cnt: string }[], cat: string) =>
    parseInt(data.find((r) => r.law_cat_cd?.toUpperCase() === cat)?.cnt || "0", 10);

  const violent_count = getCat(current, "FELONY");
  const property_count = getCat(current, "MISDEMEANOR");
  const qol_count = getCat(current, "VIOLATION");

  const priorViolent = prior ? getCat(prior, "FELONY") : violent_count;
  const yoy_violent_trend =
    priorViolent > 0
      ? ((violent_count - priorViolent) / priorViolent) * 100
      : 0;

  const pop = NYC_ZIP_POPULATIONS[zipCode] || 40000;
  const per_1k_violent = (violent_count / pop) * 1000;

  // Grade: compare to all NYC ZIPs (simplified — use hardcoded percentiles)
  // NYC average violent crime per 1K: ~5.5
  let safety_grade: CrimeSignal["safety_grade"];
  if (per_1k_violent <= 2.5) safety_grade = "A";
  else if (per_1k_violent <= 4.5) safety_grade = "B";
  else if (per_1k_violent <= 6.5) safety_grade = "C";
  else if (per_1k_violent <= 9.0) safety_grade = "D";
  else safety_grade = "F";

  let trend_label: CrimeSignal["trend_label"];
  if (yoy_violent_trend < -5) trend_label = "improving";
  else if (yoy_violent_trend > 5) trend_label = "worsening";
  else trend_label = "stable";

  const levelWord = ["A", "B"].includes(safety_grade) ? "low" : safety_grade === "C" ? "moderate" : "high";

  return {
    violent_count, property_count, qol_count, yoy_violent_trend,
    per_1k_violent, safety_grade, trend_label,
    summary: `Safety grade: ${safety_grade}. This area has ${levelWord} crime compared to NYC overall. Trend: ${trend_label} year over year.`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fair-rent/nyc-open-data.ts
git commit -m "feat(fair-rent): add NYC Open Data fetchers (violations, 311, litigations, crime)"
```

---

## Task 4: Rent Stabilization Lookup

**Files:**
- Create: `src/lib/fair-rent/rent-stabilization.ts`

This queries the existing Supabase `buildings` table for stabilization data already ingested, rather than hitting external CSVs at runtime.

- [ ] **Step 1: Create stabilization lookup**

```ts
// src/lib/fair-rent/rent-stabilization.ts
import type { StabilizationSignal } from "@/components/fair-rent/types";
import { createClient } from "@/lib/supabase/server";

export async function fetchStabilization(
  address: string,
  zipCode: string
): Promise<StabilizationSignal | null> {
  try {
    const supabase = await createClient();

    // Try to match by address in our buildings table
    const parts = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
    if (!parts) return null;

    const { data: building } = await supabase
      .from("buildings")
      .select("id, rent_stabilized, stabilized_units, total_units")
      .eq("metro", "nyc")
      .eq("zip_code", zipCode)
      .ilike("full_address", `${parts[1]}%${parts[2].trim()}%`)
      .limit(1)
      .maybeSingle();

    if (!building) {
      return {
        is_stabilized: false,
        stabilized_units: null,
        total_units: null,
        yoy_unit_change_pct: null,
        summary: "We couldn't find this building in the rent stabilization registry. Market rate rules likely apply.",
      };
    }

    const is_stabilized = building.rent_stabilized === true;
    const stabilized_units = building.stabilized_units;
    const total_units = building.total_units;

    // YoY change would require historical data — set null for MVP
    const yoy_unit_change_pct = null;

    let summary: string;
    if (is_stabilized) {
      summary = `This building is rent stabilized. ${stabilized_units ?? "Some"} of ~${total_units ?? "?"} units are covered. If your unit is stabilized, your landlord must give you a lease rider showing the legal regulated rent. Always ask before signing.`;
    } else {
      summary = "This building is not rent stabilized. Market rate rules apply.";
    }

    return { is_stabilized, stabilized_units, total_units, yoy_unit_change_pct, summary };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fair-rent/rent-stabilization.ts
git commit -m "feat(fair-rent): add rent stabilization lookup via Supabase"
```

---

## Task 5: StreetEasy Scraper

**Files:**
- Create: `src/lib/fair-rent/streeteasy-scraper.ts`

Uses server-side fetch with Cheerio (already a dependency) to parse listing pages. Falls back gracefully if blocked.

- [ ] **Step 1: Create scraper module**

```ts
// src/lib/fair-rent/streeteasy-scraper.ts
import * as cheerio from "cheerio";
import type { ListingData } from "@/components/fair-rent/types";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": randomUA(), Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function scrapeListing(url: string): Promise<ListingData | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // StreetEasy listing pages embed structured data in JSON-LD
  let listing: ListingData | null = null;

  try {
    const jsonLd = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => {
        try { return JSON.parse($(el).html() || ""); } catch { return null; }
      })
      .find((j) => j?.["@type"] === "Apartment" || j?.["@type"] === "Product" || j?.["@type"] === "RealEstateListing");

    // Parse from page content as fallback
    const priceText = $('[data-testid="price"]').text() || $(".price").text() || "";
    const asking_price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);

    const detailText = $(".details_info, .Vitals-data, [data-testid='vitals']").text();
    const bedMatch = detailText.match(/(\d+)\s*(?:bed|br)/i);
    const bathMatch = detailText.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);
    const sqftMatch = detailText.match(/([\d,]+)\s*(?:sq\s*ft|sqft|ft²)/i);

    const beds = bedMatch ? parseInt(bedMatch[1], 10) : (detailText.toLowerCase().includes("studio") ? 0 : -1);
    const baths = bathMatch ? parseFloat(bathMatch[1]) : null;
    const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ""), 10) : null;

    const addressEl = $("h1, .building-title, [data-testid='listing-title']").first().text().trim();
    const address = addressEl || url.split("/").slice(-2).join(" ");

    // ZIP from breadcrumb or address
    const zipMatch = $("body").text().match(/\b(1[0-4]\d{3})\b/);
    const zip_code = zipMatch ? zipMatch[1] : "";

    // Days on market
    const domText = $("body").text();
    const domMatch = domText.match(/(\d+)\s*days?\s*(?:on\s*)?(?:market|streeteasy)/i);
    const days_on_market = domMatch ? parseInt(domMatch[1], 10) : null;

    if (!asking_price || beds < 0 || !zip_code) return null;

    listing = {
      asking_price,
      beds,
      baths,
      sqft,
      floor: null,
      zip_code,
      address,
      days_on_market,
      price_cut: null,
      listed_amenities: [],
    };
  } catch {
    return null;
  }

  return listing;
}

export async function scrapeComps(
  zipCode: string,
  beds: number,
  sqft: number | null
): Promise<number[]> {
  // Search StreetEasy for comps
  const searchUrl = `https://streeteasy.com/for-rent/nyc/status:open%7Cbeds:${beds}%7Carea:${zipCode}?sort_by=listed_desc`;
  const html = await fetchPage(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const prices: number[] = [];

  $(".searchCardList--listItem, [data-testid='search-card'], .listingCard").each((_, el) => {
    const priceText = $(el).find(".price, [data-testid='price']").text();
    const price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);
    if (price > 500 && price < 20000) {
      // sqft filter if available
      if (sqft) {
        const sqftText = $(el).text();
        const sqftMatch = sqftText.match(/([\d,]+)\s*(?:sq\s*ft|sqft|ft²)/i);
        if (sqftMatch) {
          const compSqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
          if (compSqft < sqft * 0.75 || compSqft > sqft * 1.25) return;
        }
      }
      prices.push(price);
    }
  });

  return prices;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fair-rent/streeteasy-scraper.ts
git commit -m "feat(fair-rent): add StreetEasy scraper with listing + comp parsing"
```

---

## Task 6: Pricing Model

**Files:**
- Create: `src/lib/fair-rent/pricing-model.ts`

Pure functions implementing the 5-step pricing model from the brief. No side effects, fully testable.

- [ ] **Step 1: Create the pricing model**

```ts
// src/lib/fair-rent/pricing-model.ts
import type { PricingResult, ListingData } from "@/components/fair-rent/types";
import type { ZoriLookupResult } from "./zori-lookup";
import {
  AMENITY_MULTIPLIERS,
  AMENITY_POSITIVE_CAP,
  AMENITY_NEGATIVE_FLOOR,
  SEASONAL_HIGH_THRESHOLD,
  SEASONAL_LOW_THRESHOLD,
  ZORI_DIVERGENCE_THRESHOLD,
  ZORI_BLEND_WEIGHT_COMP,
  ZORI_BLEND_WEIGHT_ZORI,
} from "./constants";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function calculateFairPrice(
  listing: ListingData,
  compPrices: number[],
  zori: ZoriLookupResult,
  selectedAmenities: string[]
): PricingResult {
  // Step 1: Base price
  const comp_count = compPrices.length;
  const fallback_triggered = comp_count < 5;
  const base_price =
    comp_count > 0 ? median(compPrices) : (zori.current ?? listing.asking_price);

  // Step 2: ZORI validation
  let blended_base = base_price;
  let zori_blend_triggered = false;

  if (zori.current != null) {
    const divergence = Math.abs(base_price - zori.current) / zori.current;
    if (divergence > ZORI_DIVERGENCE_THRESHOLD) {
      blended_base =
        base_price * ZORI_BLEND_WEIGHT_COMP + zori.current * ZORI_BLEND_WEIGHT_ZORI;
      zori_blend_triggered = true;
    }
  }

  // Step 3: Amenity multiplier
  const amenity_adjustments: { name: string; value: number }[] = [];
  let positiveSum = 0;
  let negativeSum = 0;

  for (const amenity of selectedAmenities) {
    const val = AMENITY_MULTIPLIERS[amenity];
    if (val != null) {
      if (val > 0) positiveSum += val;
      else negativeSum += val;
      amenity_adjustments.push({ name: amenity, value: val });
    }
  }

  // Infer walkup
  if (
    !selectedAmenities.includes("elevator") &&
    listing.floor != null &&
    listing.floor > 1
  ) {
    const walkupVal = AMENITY_MULTIPLIERS.no_elevator;
    negativeSum += walkupVal;
    amenity_adjustments.push({ name: "no_elevator (walkup)", value: walkupVal });
  }

  const clampedPositive = Math.min(positiveSum, AMENITY_POSITIVE_CAP);
  const clampedNegative = Math.max(negativeSum, AMENITY_NEGATIVE_FLOOR);
  const amenity_multiplier = 1 + clampedPositive + clampedNegative;

  // Step 4: Seasonal factor
  let seasonal_factor = 1.0;
  let seasonal_signal: PricingResult["seasonal_signal"] = "unknown";
  let seasonal_label = "Seasonal data unavailable";
  let negotiation_tip = "Standard negotiating conditions apply.";

  if (zori.current != null && zori.avg_12mo != null && zori.avg_12mo > 0) {
    seasonal_factor = zori.current / zori.avg_12mo;

    if (seasonal_factor > SEASONAL_HIGH_THRESHOLD) {
      seasonal_signal = "high";
      seasonal_label = "High season — prices are elevated right now";
      negotiation_tip = "Less negotiation room. Landlords know demand is strong.";
    } else if (seasonal_factor < SEASONAL_LOW_THRESHOLD) {
      seasonal_signal = "low";
      seasonal_label = "Low season — prices are soft right now";
      negotiation_tip = "Good time to negotiate. Offer 3-5% below asking.";
    } else {
      seasonal_signal = "neutral";
      seasonal_label = "Neutral season — normal market conditions";
      negotiation_tip = "Standard negotiating conditions apply.";
    }
  }

  // Step 5: Final price
  const fair_price = blended_base * amenity_multiplier * seasonal_factor;
  const fair_range_low = fair_price * 0.95;
  const fair_range_high = fair_price * 1.05;
  const asking_vs_fair_pct =
    ((listing.asking_price - fair_price) / fair_price) * 100;

  return {
    base_price,
    comp_count,
    comp_prices: compPrices,
    fallback_triggered,
    zori_current: zori.current,
    zori_12mo_avg: zori.avg_12mo,
    zori_blend_triggered,
    blended_base,
    amenity_multiplier,
    amenity_adjustments,
    seasonal_factor,
    seasonal_signal,
    seasonal_label,
    negotiation_tip,
    fair_price,
    fair_range_low,
    fair_range_high,
    asking_vs_fair_pct,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fair-rent/pricing-model.ts
git commit -m "feat(fair-rent): add 5-step pricing model with ZORI blend + amenity + seasonal"
```

---

## Task 7: API Route

**Files:**
- Create: `src/app/api/fair-rent/analyze/route.ts`

POST handler that orchestrates all data fetching in parallel, runs the pricing model, and returns the full `AnalyzeResponse`.

- [ ] **Step 1: Create the API route**

```ts
// src/app/api/fair-rent/analyze/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { STREETEASY_URL_REGEX } from "@/lib/fair-rent/constants";
import { scrapeListing, scrapeComps } from "@/lib/fair-rent/streeteasy-scraper";
import { lookupZori } from "@/lib/fair-rent/zori-lookup";
import { calculateFairPrice } from "@/lib/fair-rent/pricing-model";
import {
  fetchViolations,
  fetchComplaints,
  fetchLitigations,
  fetchCrime,
} from "@/lib/fair-rent/nyc-open-data";
import { fetchStabilization } from "@/lib/fair-rent/rent-stabilization";
import type { AnalyzeResponse, ListingData } from "@/components/fair-rent/types";

const requestSchema = z.object({
  url: z.string().regex(STREETEASY_URL_REGEX, "Invalid StreetEasy URL"),
  amenities: z.array(z.string()).optional().default([]),
  // Manual fallback fields
  manual: z
    .object({
      asking_price: z.number(),
      beds: z.number(),
      sqft: z.number().nullable(),
      zip_code: z.string(),
      address: z.string(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please paste a valid StreetEasy listing URL (e.g. streeteasy.com/rental/...)" },
        { status: 400 }
      );
    }

    const { url, amenities, manual } = parsed.data;

    // Step 1: Get listing data (scrape or manual fallback)
    let listing: ListingData | null = null;

    if (manual) {
      listing = {
        asking_price: manual.asking_price,
        beds: manual.beds,
        baths: null,
        sqft: manual.sqft,
        floor: null,
        zip_code: manual.zip_code,
        address: manual.address,
        days_on_market: null,
        price_cut: null,
        listed_amenities: [],
      };
    } else {
      listing = await scrapeListing(url);
    }

    if (!listing) {
      return NextResponse.json(
        {
          error: "scrape_failed",
          message: "We couldn't read that listing automatically. Enter the key details manually to continue.",
        },
        { status: 422 }
      );
    }

    // Step 2: Fetch everything in parallel
    const [compPrices, zori, violations, complaints, stabilization, litigations, crime] =
      await Promise.all([
        scrapeComps(listing.zip_code, listing.beds, listing.sqft),
        lookupZori(listing.zip_code),
        fetchViolations(listing.address, listing.zip_code),
        fetchComplaints(listing.address, listing.zip_code),
        fetchStabilization(listing.address, listing.zip_code),
        fetchLitigations(listing.address, listing.zip_code),
        fetchCrime(listing.zip_code),
      ]);

    // Step 3: Run pricing model
    const pricing = calculateFairPrice(listing, compPrices, zori, amenities);

    const response: AnalyzeResponse = {
      listing,
      pricing,
      violations,
      complaints,
      stabilization,
      litigations,
      crime,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Fair rent analysis error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test with curl**

```bash
curl -X POST http://localhost:3000/api/fair-rent/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://streeteasy.com/rental/1234567","amenities":["doorman","elevator"]}'
```

Expected: JSON response with listing, pricing, and signal data (signals may be null if APIs are slow or address parsing fails).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fair-rent/analyze/route.ts
git commit -m "feat(fair-rent): add /api/fair-rent/analyze POST route"
```

---

## Task 8: Page Shell + Client Root

**Files:**
- Create: `src/app/fair-rent-engine/page.tsx`
- Create: `src/components/fair-rent/FairRentApp.tsx`

- [ ] **Step 1: Create the server page with metadata**

```tsx
// src/app/fair-rent-engine/page.tsx
import { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo";
import { FairRentApp } from "@/components/fair-rent/FairRentApp";

export const metadata: Metadata = {
  title: "Fair Rent Engine — Know Your Rent Before You Sign | NYC",
  description:
    "Free tool for NYC renters. Paste a StreetEasy listing and get fair market pricing, building quality scores, rent stabilization status, and neighborhood safety data — all from public records.",
  alternates: { canonical: canonicalUrl("/fair-rent-engine") },
  openGraph: {
    title: "Fair Rent Engine — Know Your Rent Before You Sign",
    description:
      "Fair market pricing, hidden red flags, and negotiation leverage for any NYC rental listing. 100% free, 100% public data.",
    url: canonicalUrl("/fair-rent-engine"),
    siteName: "Lucid Rents",
    type: "website",
  },
};

export default function FairRentEnginePage() {
  return <FairRentApp />;
}
```

- [ ] **Step 2: Create the client root component**

```tsx
// src/components/fair-rent/FairRentApp.tsx
"use client";

import { useState, useCallback } from "react";
import type { Screen, AnalyzeResponse } from "./types";
import { LandingHero } from "./LandingHero";
import { LoadingSequence } from "./LoadingSequence";
import { ResultsShell } from "./ResultsShell";
import { ManualEntryForm, type ManualEntry } from "./ManualEntryForm";

export function FairRentApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [lastUrl, setLastUrl] = useState("");

  const analyze = useCallback(
    async (url: string, selectedAmenities: string[]) => {
      setScreen("loading");
      setError(null);
      setAmenities(selectedAmenities);
      setLastUrl(url);

      try {
        const res = await fetch("/api/fair-rent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, amenities: selectedAmenities }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === "scrape_failed") {
            setError(data.message);
            setScreen("error");
            return;
          }
          throw new Error(data.message || data.error || "Analysis failed");
        }

        setResult(data as AnalyzeResponse);
        setScreen("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setScreen("error");
      }
    },
    []
  );

  const reset = useCallback(() => {
    setScreen("landing");
    setResult(null);
    setError(null);
  }, []);

  const analyzeManual = useCallback(
    async (manual: ManualEntry) => {
      setScreen("loading");
      setError(null);
      try {
        const res = await fetch("/api/fair-rent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: lastUrl, amenities, manual }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        setResult(data as AnalyzeResponse);
        setScreen("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setScreen("error");
      }
    },
    [lastUrl, amenities]
  );

  return (
    <div className="min-h-screen">
      {screen === "landing" && <LandingHero onAnalyze={analyze} />}
      {screen === "loading" && <LoadingSequence />}
      {screen === "results" && result && (
        <ResultsShell result={result} onBack={reset} />
      )}
      {screen === "error" && (
        <ManualEntryForm
          errorMessage={error}
          onSubmit={(manual) => analyzeManual(manual)}
          onBack={reset}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/fair-rent-engine/page.tsx src/components/fair-rent/FairRentApp.tsx
git commit -m "feat(fair-rent): add page shell and client root with screen state machine"
```

---

## Task 8.5: Manual Entry Fallback Form

**Files:**
- Create: `src/components/fair-rent/ManualEntryForm.tsx`

StreetEasy aggressively blocks server-side scraping. When scraping fails, the user needs a manual entry form to provide the key listing details so analysis can continue.

- [ ] **Step 1: Create ManualEntryForm**

```tsx
// src/components/fair-rent/ManualEntryForm.tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export interface ManualEntry {
  asking_price: number;
  beds: number;
  sqft: number | null;
  zip_code: string;
  address: string;
}

interface ManualEntryFormProps {
  errorMessage: string | null;
  onSubmit: (entry: ManualEntry) => void;
  onBack: () => void;
}

export function ManualEntryForm({ errorMessage, onSubmit, onBack }: ManualEntryFormProps) {
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [sqft, setSqft] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const askingPrice = parseInt(price.replace(/[^0-9]/g, ""), 10);
    const bedCount = parseInt(beds, 10);
    const zipCode = zip.trim();

    if (!askingPrice || askingPrice < 500) {
      setValidationError("Enter a valid monthly rent amount");
      return;
    }
    if (isNaN(bedCount) || bedCount < 0) {
      setValidationError("Enter the number of bedrooms (0 for studio)");
      return;
    }
    if (!/^\d{5}$/.test(zipCode)) {
      setValidationError("Enter a valid 5-digit NYC ZIP code");
      return;
    }
    if (!address.trim()) {
      setValidationError("Enter the building address");
      return;
    }

    setValidationError(null);
    onSubmit({
      asking_price: askingPrice,
      beds: bedCount,
      sqft: sqft ? parseInt(sqft.replace(/[^0-9]/g, ""), 10) : null,
      zip_code: zipCode,
      address: address.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1D2E] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-8 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <p className="text-white text-lg font-semibold mb-2">Enter listing details</p>
        <p className="text-white/40 text-sm mb-8">
          {errorMessage || "We couldn't read the listing automatically. Enter the key details to continue."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Building address (e.g. 142 E 12th Street)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Monthly rent ($)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <input
              type="text"
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Bedrooms (0 = studio)"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <input
              type="text"
              placeholder="Sqft (optional)"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>

          {validationError && (
            <p className="text-red-400 text-xs">{validationError}</p>
          )}

          <button
            type="submit"
            className="mt-2 px-6 py-3 bg-white text-[#0F1D2E] rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Analyze with these details
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/ManualEntryForm.tsx
git commit -m "feat(fair-rent): add manual entry fallback form for when scraping fails"
```

---

## Task 9: Landing Hero

**Files:**
- Create: `src/components/fair-rent/LandingHero.tsx`

Dark full-screen hero matching the RentCheck demo aesthetic, adapted to the site's Geist font and navy primary color.

- [ ] **Step 1: Create LandingHero component**

```tsx
// src/components/fair-rent/LandingHero.tsx
"use client";

import { useState } from "react";
import { STREETEASY_URL_REGEX } from "@/lib/fair-rent/constants";
import { Building2, Shield, TrendingDown, Scale } from "lucide-react";

const AMENITY_OPTIONS = [
  { id: "doorman", label: "Doorman" },
  { id: "elevator", label: "Elevator" },
  { id: "private_outdoor_space", label: "Private outdoor space" },
  { id: "in_unit_laundry", label: "In-unit laundry" },
  { id: "gym", label: "Gym" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pet friendly" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "central_ac", label: "Central A/C" },
  { id: "roof_access", label: "Roof access" },
];

interface LandingHeroProps {
  onAnalyze: (url: string, amenities: string[]) => void;
}

export function LandingHero({ onAnalyze }: LandingHeroProps) {
  const [url, setUrl] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [showAmenities, setShowAmenities] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = () => {
    const testUrl = url.trim() || "https://streeteasy.com/building/142-east-12-street/4b";
    if (!STREETEASY_URL_REGEX.test(testUrl)) {
      setUrlError("Please paste a valid StreetEasy listing URL (e.g. streeteasy.com/rental/...)");
      return;
    }
    setUrlError(null);
    onAnalyze(testUrl, amenities);
  };

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0F1D2E] text-white flex flex-direction-column items-center justify-center relative overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(59,130,246,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 py-20 text-center">
        {/* Eyebrow */}
        <p className="text-[11px] font-semibold tracking-[3px] uppercase text-white/40 mb-7">
          NYC Rental Intelligence
        </p>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
          Know Your Rent,
          <br />
          <span className="text-white/50 font-normal italic">Before You Sign</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base text-white/40 leading-relaxed max-w-md mx-auto mb-10">
          Fair market pricing, building red flags, and negotiation leverage — all from one listing URL.
        </p>

        {/* URL Input */}
        <div className="flex flex-col sm:flex-row gap-0 max-w-xl mx-auto bg-white/[0.08] border border-white/[0.12] rounded-full overflow-hidden backdrop-blur-sm">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste a StreetEasy listing URL..."
            className="flex-1 px-6 py-4 bg-transparent text-white text-[15px] outline-none placeholder:text-white/30"
          />
          <button
            onClick={handleSubmit}
            className="px-7 py-3 m-1.5 rounded-full bg-white text-[#0F1D2E] text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Analyze
          </button>
        </div>

        {urlError && (
          <p className="mt-3 text-red-400 text-xs">{urlError}</p>
        )}

        <p className="mt-4 text-xs text-white/25">
          No link?{" "}
          <button
            onClick={() => {
              setUrl("https://streeteasy.com/building/142-east-12-street/4b");
              handleSubmit();
            }}
            className="text-white/50 hover:text-white transition-colors underline cursor-pointer"
          >
            Try a sample listing
          </button>
        </p>

        {/* Amenity toggle */}
        <button
          onClick={() => setShowAmenities(!showAmenities)}
          className="mt-6 text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
        >
          {showAmenities ? "Hide" : "Add"} amenity filters ↓
        </button>

        {showAmenities && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {AMENITY_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAmenity(a.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  amenities.includes(a.id)
                    ? "bg-white/20 border-white/40 text-white"
                    : "bg-transparent border-white/10 text-white/40 hover:border-white/25"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex justify-center gap-12 mt-16 pt-10 border-t border-white/[0.08]">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 size={14} className="text-white/30" />
              <span className="text-2xl font-bold">7</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Data Sources</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield size={14} className="text-white/30" />
              <span className="text-2xl font-bold">100%</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Public Data</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Scale size={14} className="text-white/30" />
              <span className="text-2xl font-bold">Free</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Always</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/LandingHero.tsx
git commit -m "feat(fair-rent): add dark landing hero with URL input and amenity picker"
```

---

## Task 10: Loading Sequence

**Files:**
- Create: `src/components/fair-rent/LoadingSequence.tsx`

Animated step-by-step loading screen (dark background, check marks animate in sequence).

- [ ] **Step 1: Create LoadingSequence component**

```tsx
// src/components/fair-rent/LoadingSequence.tsx
"use client";

import { useState, useEffect } from "react";
import { LOADING_STEPS } from "@/lib/fair-rent/constants";
import { Check, Loader2 } from "lucide-react";

export function LoadingSequence() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= LOADING_STEPS.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 600 + Math.random() * 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1D2E] flex flex-col items-center justify-center gap-8 px-6">
      <p className="text-white text-lg font-semibold tracking-tight">
        Analyzing listing...
      </p>

      <div className="flex flex-col gap-3.5 w-full max-w-sm">
        {LOADING_STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                isDone
                  ? "text-emerald-400"
                  : isActive
                    ? "text-white"
                    : "text-white/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isDone
                    ? "border-emerald-400 bg-emerald-400 text-white"
                    : isActive
                      ? "border-white"
                      : "border-white/15"
                }`}
              >
                {isDone && <Check size={10} strokeWidth={3} />}
                {isActive && <Loader2 size={10} className="animate-spin" />}
              </div>
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/LoadingSequence.tsx
git commit -m "feat(fair-rent): add animated loading sequence"
```

---

## Task 11: Results Shell + Listing Header + Verdict

**Files:**
- Create: `src/components/fair-rent/ResultsShell.tsx`
- Create: `src/components/fair-rent/ListingHeader.tsx`
- Create: `src/components/fair-rent/PricingVerdict.tsx`

- [ ] **Step 1: Create ResultsShell**

```tsx
// src/components/fair-rent/ResultsShell.tsx
"use client";

import type { AnalyzeResponse } from "./types";
import { ListingHeader } from "./ListingHeader";
import { PricingVerdict } from "./PricingVerdict";
import { FairPriceCard } from "./FairPriceCard";
import { SeasonalSignalCard } from "./SeasonalSignalCard";
import { BuildingScorecardGrid } from "./BuildingScorecardGrid";
import { NeighborhoodSafetyCard } from "./NeighborhoodSafetyCard";
import { TenantRightsCallout } from "./TenantRightsCallout";
import { ArrowLeft } from "lucide-react";

interface ResultsShellProps {
  result: AnalyzeResponse;
  onBack: () => void;
}

export function ResultsShell({ result, onBack }: ResultsShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Nav bar */}
      <div className="bg-white border-b border-[#e8e6e1] px-6 sm:px-12 py-5">
        <span className="text-[#0F1D2E] font-bold text-lg tracking-tight">
          Fair Rent Engine
        </span>
      </div>

      {/* Content */}
      <div className="max-w-[760px] mx-auto px-5 py-10 sm:py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft size={14} /> Check another listing
        </button>

        <ListingHeader listing={result.listing} />

        {/* Tenant rights callout (above fold if red flags) */}
        <TenantRightsCallout result={result} />

        <PricingVerdict
          askingVsFairPct={result.pricing.asking_vs_fair_pct}
          redFlagCount={countRedFlags(result)}
        />

        <div className="flex flex-col gap-5">
          <FairPriceCard listing={result.listing} pricing={result.pricing} />
          <SeasonalSignalCard pricing={result.pricing} listing={result.listing} />
          <BuildingScorecardGrid
            violations={result.violations}
            complaints={result.complaints}
            stabilization={result.stabilization}
            litigations={result.litigations}
          />
          <NeighborhoodSafetyCard crime={result.crime} />
        </div>
      </div>
    </div>
  );
}

function countRedFlags(result: AnalyzeResponse): number {
  let count = 0;
  if (result.violations?.classification === "above_average") count++;
  if (result.litigations?.has_harassment_case) count++;
  if (result.litigations?.active_litigations && result.litigations.active_litigations > 0) count++;
  if (result.stabilization?.yoy_unit_change_pct != null && result.stabilization.yoy_unit_change_pct < -10) count++;
  if (result.crime?.safety_grade === "F") count++;
  return count;
}
```

- [ ] **Step 2: Create ListingHeader**

```tsx
// src/components/fair-rent/ListingHeader.tsx
import type { ListingData } from "./types";

export function ListingHeader({ listing }: { listing: ListingData }) {
  const meta = [
    listing.beds === 0 ? "Studio" : `${listing.beds} bed`,
    listing.baths != null ? `${listing.baths} bath` : null,
    listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-10">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-[#0b0b0b] mb-2">
        {listing.address}
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        {listing.zip_code} · {meta}
        {listing.listed_amenities.length > 0 && ` · ${listing.listed_amenities.join(", ")}`}
      </p>
      <div className="flex items-baseline gap-4">
        <span className="text-4xl font-bold text-[#0b0b0b]">
          ${listing.asking_price.toLocaleString()}
          <span className="text-lg text-gray-400 font-normal">/mo</span>
        </span>
      </div>
      <p className="text-[11px] text-gray-300 uppercase tracking-wider mt-1">Listed price</p>
    </div>
  );
}
```

- [ ] **Step 3: Create PricingVerdict**

```tsx
// src/components/fair-rent/PricingVerdict.tsx
"use client";

import { useEffect, useRef } from "react";

interface PricingVerdictProps {
  askingVsFairPct: number;
  redFlagCount: number;
}

export function PricingVerdict({ askingVsFairPct, redFlagCount }: PricingVerdictProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => el.classList.add("opacity-100", "translate-y-0"), 150);
    return () => clearTimeout(timer);
  }, []);

  const isOverpriced = askingVsFairPct > 5;
  const isUnderpriced = askingVsFairPct < -5;

  const icon = isOverpriced ? "🚩" : isUnderpriced ? "✅" : "➡️";
  const color = isOverpriced ? "text-red-700" : isUnderpriced ? "text-emerald-700" : "text-gray-600";
  const label = isOverpriced
    ? `${redFlagCount > 0 ? `${redFlagCount} red flag${redFlagCount > 1 ? "s" : ""} detected. ` : ""}This unit is ${Math.round(askingVsFairPct)}% overpriced.`
    : isUnderpriced
      ? `This unit is ${Math.abs(Math.round(askingVsFairPct))}% below fair market value.`
      : "This unit is priced within the fair range.";

  return (
    <div
      ref={ref}
      className="bg-white border border-[#e8e6e1] rounded-2xl px-6 py-5 mb-5 flex items-center gap-4 opacity-0 translate-y-4 transition-all duration-500"
    >
      <span className="text-3xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className={`font-semibold ${color}`}>{label}</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Based on StreetEasy comps, Zillow ZORI validation, and NYC public records.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/fair-rent/ResultsShell.tsx src/components/fair-rent/ListingHeader.tsx src/components/fair-rent/PricingVerdict.tsx
git commit -m "feat(fair-rent): add results shell, listing header, and verdict banner"
```

---

## Task 12: Fair Price Card

**Files:**
- Create: `src/components/fair-rent/FairPriceCard.tsx`

Shows fair range, comp chart via Recharts, and expandable calculation breakdown.

- [ ] **Step 1: Create FairPriceCard component**

```tsx
// src/components/fair-rent/FairPriceCard.tsx
"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine } from "recharts";
import type { PricingResult, ListingData } from "./types";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface FairPriceCardProps {
  listing: ListingData;
  pricing: PricingResult;
}

export function FairPriceCard({ listing, pricing }: FairPriceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const p25 = percentile(pricing.comp_prices, 25);
  const p50 = percentile(pricing.comp_prices, 50);
  const p75 = percentile(pricing.comp_prices, 75);

  // Bar chart data: comp prices + this listing
  const chartData = [
    ...pricing.comp_prices.slice(0, 8).map((p, i) => ({
      name: `Comp ${i + 1}`,
      price: p,
      isCurrent: false,
    })),
    { name: "This unit", price: listing.asking_price, isCurrent: true },
  ].sort((a, b) => a.price - b.price);

  const steps = [
    {
      label: "Comp pool",
      text: `${pricing.comp_count} active StreetEasy listings: same beds, sqft ±25%, within 0.5mi, listed in last 60 days. Median = ${fmt(pricing.base_price)}`,
    },
    {
      label: "ZORI validation",
      text: pricing.zori_blend_triggered
        ? `Zillow ZORI for ZIP ${listing.zip_code}: ${fmt(pricing.zori_current!)}. Comp median diverged >20% — blended to ${fmt(pricing.blended_base)}`
        : `Zillow ZORI for ZIP ${listing.zip_code}: ${pricing.zori_current ? fmt(pricing.zori_current) : "N/A"}. ${pricing.zori_current ? "Within 20% — validated" : "Not available — skipped"}`,
    },
    {
      label: "Amenity adjustment",
      text: `${pricing.amenity_adjustments.map((a) => `${a.name} ${a.value > 0 ? "+" : ""}${(a.value * 100).toFixed(0)}%`).join(", ") || "None applied"}. Multiplier: ${pricing.amenity_multiplier.toFixed(2)}×`,
    },
    {
      label: "Seasonal adjustment",
      text: `Factor: ${pricing.seasonal_factor.toFixed(2)}×. ${pricing.seasonal_label}. Fair price = ${fmt(pricing.fair_price)}. Range: ${fmt(pricing.fair_range_low)} – ${fmt(pricing.fair_range_high)}`,
    },
  ];

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-5">
        Fair Market Price
      </p>

      {pricing.fallback_triggered && (
        <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle size={14} />
          We found only {pricing.comp_count} comparable listings. Results are directional.
        </div>
      )}

      {/* Comp bar chart */}
      {chartData.length > 1 && (
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={chartData.length * 28 + 20}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 60 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#999" }} width={75} />
              <ReferenceLine x={pricing.fair_price} stroke="#27763d" strokeDasharray="4 3" label={{ value: `Fair ${fmt(pricing.fair_price)}`, position: "top", fontSize: 10, fill: "#27763d" }} />
              <Bar dataKey="price" radius={[0, 3, 3, 0]} barSize={16}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isCurrent ? "#c0392b" : "#e8e6e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Range stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "25th pctl", value: fmt(p25) },
          { label: "Comp median", value: fmt(p50) },
          { label: "75th pctl", value: fmt(p75) },
          { label: "This listing", value: fmt(listing.asking_price), highlight: true },
        ].map((s) => (
          <div
            key={s.label}
            className={`text-center py-3 px-2 rounded-lg ${s.highlight ? "bg-red-50" : "bg-[#f7f7f5]"}`}
          >
            <div className={`text-xl font-bold ${s.highlight ? "text-red-700" : "text-[#0b0b0b]"}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Expandable breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        How we calculated this {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-4 bg-[#f7f7f5] rounded-lg p-5">
          <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300 mb-4">
            Calculation Steps
          </p>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 mb-3 last:mb-0">
              <div className="w-6 h-6 rounded-lg bg-[#e8e6e1] flex items-center justify-center text-[11px] font-bold text-gray-500 flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                <strong className="text-gray-800">{step.label}</strong> — {step.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-300 mt-4">
        Based on StreetEasy active listings + Zillow ZORI
      </p>
    </div>
  );
}
```

Note: `percentile()` computes 25th/75th from `comp_prices` client-side since `PricingResult` only has the median. The `ReferenceLine` on the bar chart marks the fair price.

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/FairPriceCard.tsx
git commit -m "feat(fair-rent): add fair price card with comp chart and breakdown"
```

---

## Task 13: Seasonal Signal Card

**Files:**
- Create: `src/components/fair-rent/SeasonalSignalCard.tsx`

- [ ] **Step 1: Create SeasonalSignalCard**

Renders:
1. Season badge (HIGH / NEUTRAL / LOW) with color
2. One-sentence seasonal explanation
3. Combined negotiation tip using season + days_on_market from listing
4. Source label

Badge colors: red for high, gray for neutral, green for low. Combined tip logic per the brief:
- low season + DOM > 30 → "Strong position" message
- high season + DOM < 14 → "Limited leverage" message
- high season + DOM > 30 → "Even in high season, sitting" message
- default → "Standard market, 2-3% below ask"

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/SeasonalSignalCard.tsx
git commit -m "feat(fair-rent): add seasonal signal card with negotiation tips"
```

---

## Task 14: Building Scorecard Grid

**Files:**
- Create: `src/components/fair-rent/BuildingScorecardGrid.tsx`

2x2 card grid showing HPD Violations, 311 Complaints, Rent Stabilization, and Litigations.

- [ ] **Step 1: Create BuildingScorecardGrid**

Each sub-card renders:
1. Title + status badge (green/yellow/red based on classification)
2. Key number (e.g., "12 open" for violations)
3. "vs ZIP avg" comparison
4. Plain language summary (1-2 sentences)
5. Source label in small gray text

For null signals, render a gray "Data unavailable" placeholder. Use `Badge` component from `@/components/ui/Badge` for status badges. Grid is responsive: 1 col on mobile, 2 cols on sm+.

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/BuildingScorecardGrid.tsx
git commit -m "feat(fair-rent): add 2x2 building scorecard grid"
```

---

## Task 15: Neighborhood Safety Card

**Files:**
- Create: `src/components/fair-rent/NeighborhoodSafetyCard.tsx`

- [ ] **Step 1: Create NeighborhoodSafetyCard**

Renders:
1. Large letter grade badge (A-F) with color from `gradeColor()` in design-tokens
2. One-sentence crime level description
3. YoY trend arrow indicator (↑ Improving / → Stable / ↓ Worsening)
4. Red banner if violent crime worsening > 10%
5. Source: "NYC Open Data — NYPD Complaint Data (last 12 months)"

Null state: gray "Data unavailable" card.

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/NeighborhoodSafetyCard.tsx
git commit -m "feat(fair-rent): add neighborhood safety card with crime grade"
```

---

## Task 16: Tenant Rights Callout

**Files:**
- Create: `src/components/fair-rent/TenantRightsCallout.tsx`

Conditional boxes rendered above the fold when red flags are present.

- [ ] **Step 1: Create TenantRightsCallout**

Logic — render matching callout boxes in order:
1. If `stabilization.is_stabilized` → green box with tenant rights bullets
2. If `violations.classification === "above_average"` → yellow box
3. If `litigations.active_litigations > 0` → red box
4. If `litigations.has_harassment_case` → red box (separate)
5. If `stabilization.yoy_unit_change_pct < -10` → yellow box

Each box: colored left border, icon, title, description, and optional link. Colors: green → `bg-emerald-50 border-emerald-400`, yellow → `bg-amber-50 border-amber-400`, red → `bg-red-50 border-red-400`.

If no triggers match, render nothing.

- [ ] **Step 2: Commit**

```bash
git add src/components/fair-rent/TenantRightsCallout.tsx
git commit -m "feat(fair-rent): add conditional tenant rights callout boxes"
```

---

## Task 17: ZORI Data File

**Files:**
- Create: `public/data/zori-nyc.csv`

- [ ] **Step 1: Download and filter ZORI CSV**

Download the ZORI CSV from Zillow Research (All Homes + Multifamily, Smoothed, Seasonally Adjusted, ZIP Code level). Filter to NYC ZIPs only (10001-10499, 11001-11999, 10301-10314, 10451-10475). Save to `public/data/zori-nyc.csv`.

If download is unavailable at build time, create a minimal placeholder CSV with header + a few representative ZIPs and recent months so the app degrades gracefully.

- [ ] **Step 2: Commit**

```bash
git add public/data/zori-nyc.csv
git commit -m "feat(fair-rent): add ZORI NYC ZIP-level rent index CSV"
```

---

## Task 18: End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visit /fair-rent-engine and verify landing page renders**

Open `http://localhost:3000/fair-rent-engine`. Verify:
- Dark hero renders with URL input
- Amenity toggle works
- "Try a sample listing" link populates input

- [ ] **Step 3: Test the analyze flow**

Click "Analyze" with the sample URL. Verify:
- Loading animation plays through all 7 steps
- Results page renders (even if some signals are null)
- Fair price card shows pricing data
- Back button returns to landing

- [ ] **Step 4: Test error states**

Submit an invalid URL (e.g., "google.com"). Verify validation error appears.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(fair-rent): address issues found in smoke test"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Types + constants | `types.ts`, `constants.ts` |
| 2 | ZORI lookup | `zori-lookup.ts` |
| 3 | NYC Open Data fetchers | `nyc-open-data.ts` |
| 4 | Rent stabilization | `rent-stabilization.ts` |
| 5 | StreetEasy scraper | `streeteasy-scraper.ts` |
| 6 | Pricing model | `pricing-model.ts` |
| 7 | API route | `api/fair-rent/analyze/route.ts` |
| 8 | Page shell + client root | `page.tsx`, `FairRentApp.tsx` |
| 8.5 | Manual entry fallback | `ManualEntryForm.tsx` |
| 9 | Landing hero | `LandingHero.tsx` |
| 10 | Loading sequence | `LoadingSequence.tsx` |
| 11 | Results + header + verdict | `ResultsShell.tsx`, `ListingHeader.tsx`, `PricingVerdict.tsx` |
| 12 | Fair price card | `FairPriceCard.tsx` |
| 13 | Seasonal signal card | `SeasonalSignalCard.tsx` |
| 14 | Building scorecard grid | `BuildingScorecardGrid.tsx` |
| 15 | Neighborhood safety card | `NeighborhoodSafetyCard.tsx` |
| 16 | Tenant rights callout | `TenantRightsCallout.tsx` |
| 17 | ZORI data file | `zori-nyc.csv` |
| 18 | End-to-end smoke test | — |
