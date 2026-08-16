import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { City } from "@/lib/cities";
import { getAllNeighborhoodsByCity } from "@/lib/neighborhoods";

// ── Shared data layer for the monthly rent-report pages ───────────────
//
// Source table: dewey_neighborhood_rents (zip, month, beds, median_rent,
// p25_rent, p75_rent, listing_count). Every query here filters on the
// indexed `zip` column (eq or in-list) and is bounded with an explicit
// limit — the table is ~931K rows and unindexed scans have burned this
// repo before (see PR #330).

export interface RentReportRow {
  month: string; // "YYYY-MM-01"
  beds: number;
  median_rent: string | number | null;
  p25_rent: string | number | null;
  p75_rent: string | number | null;
  listing_count: number;
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function sbFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Month helpers ─────────────────────────────────────────────────────

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-02" + (-1) -> "2026-01". Pure integer math — no Date/TZ pitfalls. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** "2026-02" -> "February 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function currentMonthUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Valid format, not before the dataset starts, not in the future. */
export function isPlausibleReportMonth(month: string): boolean {
  return MONTH_RE.test(month) && month >= "2009-08" && month <= currentMonthUtc();
}

// ── Per-zip fetchers (react cache: deduped between metadata + page) ──

/**
 * Distinct months with listings for a zip, newest first ("YYYY-MM").
 * limit 600 raw rows ≈ 100 months × up to 6 bed types — enough history for
 * prev/next navigation and YoY lookups on any recent report month.
 */
export const getZipReportMonths = cache(async (zip: string): Promise<string[]> => {
  const rows = await sbFetch<{ month: string }[]>(
    `dewey_neighborhood_rents?zip=eq.${zip}&listing_count=gte.1&select=month&order=month.desc&limit=600`,
  );
  if (!rows) return [];
  const seen = new Set<string>();
  const months: string[] = [];
  for (const r of rows) {
    const m = r.month.slice(0, 7);
    if (!seen.has(m)) {
      seen.add(m);
      months.push(m);
    }
  }
  return months;
});

/** monthsCsv is a comma-joined "YYYY-MM-01" list (string arg so cache() dedupes). */
const getZipRowsForMonths = cache(async (zip: string, monthsCsv: string): Promise<RentReportRow[]> => {
  if (!monthsCsv) return [];
  const rows = await sbFetch<RentReportRow[]>(
    `dewey_neighborhood_rents?zip=eq.${zip}&month=in.(${monthsCsv})&select=month,beds,median_rent,p25_rent,p75_rent,listing_count&order=month.desc,beds.asc&limit=100`,
  );
  return rows ?? [];
});

export interface ZipMonthReport {
  month: string;
  /** Previous/next month that actually has data (may skip calendar months). */
  prevMonth: string | null;
  nextMonth: string | null;
  /** Exactly 12 months earlier, only if that month has data. */
  yoyMonth: string | null;
  rows: RentReportRow[];
  prevRows: RentReportRow[];
  yoyRows: RentReportRow[];
  totalListings: number;
}

/**
 * Everything a dated report page needs for one zip+month, in 2 bounded
 * queries (months list + a 3-month row fetch). Returns null when the
 * month has no listings for the zip — callers notFound() on that.
 */
export const getZipMonthReport = cache(async (zip: string, month: string): Promise<ZipMonthReport | null> => {
  const months = await getZipReportMonths(zip);
  const idx = months.indexOf(month);
  if (idx === -1) return null;

  const prevMonth = idx + 1 < months.length ? months[idx + 1] : null;
  const nextMonth = idx > 0 ? months[idx - 1] : null;
  const yoyCandidate = addMonths(month, -12);
  const yoyMonth = months.includes(yoyCandidate) ? yoyCandidate : null;

  const fetchMonths = [month, prevMonth, yoyMonth].filter((m): m is string => m != null);
  const all = await getZipRowsForMonths(zip, fetchMonths.map((m) => `${m}-01`).join(","));

  const forMonth = (m: string | null) =>
    m == null ? [] : all.filter((r) => r.month.slice(0, 7) === m && r.listing_count > 0);

  const rows = forMonth(month);
  if (rows.length === 0) return null;

  return {
    month,
    prevMonth,
    nextMonth,
    yoyMonth,
    rows,
    prevRows: forMonth(prevMonth),
    yoyRows: forMonth(yoyMonth),
    totalListings: rows.reduce((s, r) => s + r.listing_count, 0),
  };
});

// ── City-wide medians (shared across every zip page for a month) ─────

export interface CityMonthMedians {
  /** beds -> median of zip-level medians (unweighted). */
  medianByBed: Record<number, number>;
  zipCount: number;
}

/**
 * City-wide comparison baseline: median of zip-level medians per bed count,
 * across the city's curated zip list. Cached by (city, month) for 24h so
 * ~200 zip pages per city share one bounded query.
 */
export const getCityMonthMedians = unstable_cache(
  async (city: City, month: string): Promise<CityMonthMedians | null> => {
    const zips = getAllNeighborhoodsByCity(city).map((n) => n.zipCode);
    if (zips.length === 0) return null;
    const res = await fetch(
      `${SB_URL}/rest/v1/dewey_neighborhood_rents?zip=in.(${zips.join(",")})&month=eq.${month}-01&listing_count=gte.1&select=zip,beds,median_rent&limit=3000`,
      { headers: { apikey: SB_KEY } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { zip: string; beds: number; median_rent: string | number | null }[];

    const byBed = new Map<number, number[]>();
    const zipSet = new Set<string>();
    for (const r of rows) {
      if (r.median_rent == null) continue;
      zipSet.add(r.zip);
      const vals = byBed.get(r.beds) ?? [];
      vals.push(Number(r.median_rent));
      byBed.set(r.beds, vals);
    }
    if (zipSet.size === 0) return null;

    const medianByBed: Record<number, number> = {};
    for (const [beds, vals] of byBed) {
      vals.sort((a, b) => a - b);
      const mid = Math.floor(vals.length / 2);
      medianByBed[beds] =
        vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    }
    return { medianByBed, zipCount: zipSet.size };
  },
  ["rent-report-city-medians"],
  { revalidate: 86400 },
);

// ── Hub index (which zips have reports, for which recent months) ─────

export interface CityReportIndex {
  /** Latest month with any listing data across the city's zips ("YYYY-MM"). */
  latestMonth: string;
  /** latestMonth plus the 3 calendar months before it. */
  months: string[];
  /** zip -> subset of `months` that zip actually has data for (desc). */
  zipMonths: Record<string, string[]>;
}

/**
 * Hub-page index, cached per city for 24h. Two bounded queries: a 1-row
 * latest-month probe (12-month window keeps the sort small), then one
 * zip×month presence fetch for the latest 4 months (~city zips × 4 × 6
 * bed rows ≈ 5K rows max).
 */
export const getCityReportIndex = unstable_cache(
  async (city: City): Promise<CityReportIndex | null> => {
    const zips = getAllNeighborhoodsByCity(city).map((n) => n.zipCode);
    if (zips.length === 0) return null;
    const zipList = zips.join(",");
    const cutoff = `${addMonths(currentMonthUtc(), -12)}-01`;

    const probe = await sbFetch<{ month: string }[]>(
      `dewey_neighborhood_rents?zip=in.(${zipList})&month=gte.${cutoff}&listing_count=gte.1&select=month&order=month.desc&limit=1`,
    );
    if (!probe || probe.length === 0) return null;
    const latestMonth = probe[0].month.slice(0, 7);
    const months = [0, -1, -2, -3].map((d) => addMonths(latestMonth, d));

    const rows = await sbFetch<{ zip: string; month: string }[]>(
      `dewey_neighborhood_rents?zip=in.(${zipList})&month=in.(${months.map((m) => `${m}-01`).join(",")})&listing_count=gte.1&select=zip,month&limit=20000`,
    );
    if (!rows) return null;

    const zipMonths: Record<string, string[]> = {};
    for (const r of rows) {
      const m = r.month.slice(0, 7);
      const list = (zipMonths[r.zip] ??= []);
      if (!list.includes(m)) list.push(m);
    }
    for (const list of Object.values(zipMonths)) {
      list.sort((a, b) => b.localeCompare(a));
    }
    return { latestMonth, months, zipMonths };
  },
  ["rent-report-city-index"],
  { revalidate: 86400 },
);

// ── Formatting helpers shared by the report pages ─────────────────────

export const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1BR",
  2: "2BR",
  3: "3BR",
  4: "4BR",
};

export function bedLabel(beds: number): string {
  return BED_LABELS[beds] ?? `${beds}BR`;
}

export function formatDollar(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatSignedDollar(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString()}`;
}

/** Pick the headline bed type: 1BR when present, else most-listed. */
export function focusBedRow(rows: RentReportRow[]): RentReportRow | null {
  const usable = rows.filter((r) => r.median_rent != null);
  if (usable.length === 0) return null;
  return (
    usable.find((r) => r.beds === 1) ??
    usable.reduce((best, r) => (r.listing_count > best.listing_count ? r : best))
  );
}
