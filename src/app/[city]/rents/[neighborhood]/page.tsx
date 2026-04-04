import { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { TrendingUp, TrendingDown, Building2, CalendarDays, DollarSign, Sparkles, Search } from "lucide-react";
import { parseNeighborhoodSlug } from "@/lib/nyc-neighborhoods";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { NeighborhoodRentChart } from "@/components/neighborhood/NeighborhoodRentChart";
import type { NeighborhoodRentRow } from "@/components/neighborhood/NeighborhoodRentChart";

export const revalidate = 3600;

// ── Data types ────────────────────────────────────────────────────────

interface SeasonalRow {
  month_of_year: number;
  beds: number;
  rent_index: number;
  sample_years: number;
}

interface AmenityRow {
  amenity: string;
  beds: number;
  premium_dollars: number;
  premium_pct: number;
  sample_size: number;
  median_with: number;
  median_without: number;
}

// ── Cached data fetchers ──────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const getNeighborhoodRents = cache(async function getNeighborhoodRents(
  zip: string
): Promise<NeighborhoodRentRow[]> {
  const url = `${SB_URL}/rest/v1/dewey_neighborhood_rents?zip=eq.${zip}&select=month,beds,median_rent,p25_rent,p75_rent,listing_count&order=month.asc`;
  const res = await fetch(url, {
    headers: { apikey: SB_KEY },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
});

const getSeasonalIndex = cache(async function getSeasonalIndex(
  zip: string
): Promise<SeasonalRow[]> {
  const url = `${SB_URL}/rest/v1/dewey_seasonal_index?zip=eq.${zip}&select=month_of_year,beds,rent_index,sample_years&order=month_of_year.asc`;
  const res = await fetch(url, {
    headers: { apikey: SB_KEY },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
});

const getAmenityPremiums = cache(async function getAmenityPremiums(
  zip: string
): Promise<AmenityRow[]> {
  const url = `${SB_URL}/rest/v1/dewey_amenity_premiums?zip=eq.${zip}&period=eq.all_time&select=amenity,beds,premium_dollars,premium_pct,sample_size,median_with,median_without&order=premium_dollars.desc`;
  const res = await fetch(url, {
    headers: { apikey: SB_KEY },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
});

const getBuildingCount = cache(async function getBuildingCount(
  zip: string
): Promise<number> {
  const url = `${SB_URL}/rest/v1/buildings?zip_code=eq.${zip}&select=id&limit=0`;
  const res = await fetch(url, {
    headers: {
      apikey: SB_KEY,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range");
  if (!range) return 0;
  const total = range.split("/")[1];
  return total ? parseInt(total, 10) : 0;
});

// ── Helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pctChange(older: number, newer: number): number {
  if (older === 0) return 0;
  return ((newer - older) / older) * 100;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDollar(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

/**
 * Compute YoY, 5-year, and since-2014 changes from monthly rent data.
 * Uses 1BR data by default; falls back to whichever bed type has the most data.
 */
function computeTrendStats(rents: NeighborhoodRentRow[]) {
  // Pick bed type: prefer 1, then whichever has the most rows
  const bedCounts = new Map<number, number>();
  for (const r of rents) bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + 1);
  let bed = 1;
  if (!bedCounts.has(1) && bedCounts.size > 0) {
    bed = Array.from(bedCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  const filtered = rents
    .filter((r) => r.beds === bed && r.median_rent != null)
    .sort((a, b) => a.month.localeCompare(b.month));

  if (filtered.length === 0) return null;

  const latest = filtered[filtered.length - 1];
  const currentMedian = Number(latest.median_rent);
  const currentMonth = latest.month.slice(0, 7);

  // YoY: find the row closest to 12 months ago
  const oneYearAgo = findClosestMonth(filtered, currentMonth, -12);
  const yoy = oneYearAgo ? pctChange(Number(oneYearAgo.median_rent), currentMedian) : null;

  // 5-year
  const fiveYearsAgo = findClosestMonth(filtered, currentMonth, -60);
  const fiveYear = fiveYearsAgo ? pctChange(Number(fiveYearsAgo.median_rent), currentMedian) : null;

  // Since 2014 (earliest data)
  const earliest = filtered[0];
  const sinceStart = pctChange(Number(earliest.median_rent), currentMedian);
  const startYear = earliest.month.slice(0, 4);

  return { currentMedian, yoy, fiveYear, sinceStart, startYear, bed };
}

function findClosestMonth(
  rows: NeighborhoodRentRow[],
  refMonth: string,
  offsetMonths: number
): NeighborhoodRentRow | null {
  const refDate = new Date(refMonth + "-01T00:00:00");
  refDate.setMonth(refDate.getMonth() + offsetMonths);
  const targetMonth = refDate.toISOString().slice(0, 7);

  // Look for exact match first, then within 2 months
  let best: NeighborhoodRentRow | null = null;
  let bestDist = Infinity;
  for (const r of rows) {
    const m = r.month.slice(0, 7);
    const dist = Math.abs(
      (new Date(m + "-01").getTime() - new Date(targetMonth + "-01").getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    );
    if (dist < bestDist && dist <= 2) {
      best = r;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Deduplicate amenity premiums across bed types by averaging.
 * Returns one row per amenity, sorted by premium descending.
 */
function aggregateAmenities(rows: AmenityRow[]): {
  amenity: string;
  premiumDollars: number;
  premiumPct: number;
  sampleSize: number;
}[] {
  const map = new Map<
    string,
    { totalDollars: number; totalPct: number; totalSample: number; count: number }
  >();
  for (const r of rows) {
    const key = r.amenity;
    const entry = map.get(key) || { totalDollars: 0, totalPct: 0, totalSample: 0, count: 0 };
    entry.totalDollars += Number(r.premium_dollars);
    entry.totalPct += Number(r.premium_pct);
    entry.totalSample += r.sample_size;
    entry.count += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([amenity, v]) => ({
      amenity,
      premiumDollars: Math.round(v.totalDollars / v.count),
      premiumPct: Number((v.totalPct / v.count).toFixed(1)),
      sampleSize: v.totalSample,
    }))
    .sort((a, b) => b.premiumDollars - a.premiumDollars);
}

function amenityLabel(raw: string): string {
  const labels: Record<string, string> = {
    pool: "Pool",
    gym: "Gym / Fitness Center",
    doorman: "Doorman",
    laundry: "In-Unit Laundry",
    garage: "Parking / Garage",
    furnished: "Furnished",
    clubhouse: "Clubhouse / Lounge",
    granite: "Granite Countertops",
    stainless: "Stainless Steel Appliances",
    elevator: "Elevator",
    rooftop: "Rooftop Access",
    concierge: "Concierge",
    balcony: "Balcony / Terrace",
    dishwasher: "Dishwasher",
    central_air: "Central A/C",
    hardwood: "Hardwood Floors",
    washer_dryer: "Washer/Dryer",
    storage: "Storage",
    pet_friendly: "Pet Friendly",
  };
  return labels[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; neighborhood: string }>;
}): Promise<Metadata> {
  const { city: cityParam, neighborhood: slug } = await params;
  const city = cityParam as City;
  const zipCode = parseNeighborhoodSlug(slug);
  const name = getNeighborhoodNameByCity(zipCode, city);
  const displayName = name ? `${name} (${zipCode})` : zipCode;

  const rents = await getNeighborhoodRents(zipCode);
  const trend = computeTrendStats(rents);

  const parts = [`Rent Trends in ${displayName}`];
  if (trend) {
    parts.push(`Median rent ${formatDollar(trend.currentMedian)}`);
    if (trend.yoy != null) parts.push(`${formatPct(trend.yoy)} YoY`);
  }
  const description = `${parts.join(". ")}. Historical rent trends, seasonal patterns, and amenity premiums in ${CITY_META[city].name}.`;

  const url = canonicalUrl(cityPath(`/rents/${slug}`, city));

  return {
    title: `Rent Trends in ${displayName} | LucidRents`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `Rent Trends in ${displayName}`,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function NeighborhoodRentsPage({
  params,
}: {
  params: Promise<{ city: string; neighborhood: string }>;
}) {
  const { city: cityParam, neighborhood: slug } = await params;
  const city = cityParam as City;
  const zipCode = parseNeighborhoodSlug(slug);
  const neighborhoodName = getNeighborhoodNameByCity(zipCode, city);
  const displayName = neighborhoodName || zipCode;

  const [rents, seasonal, amenities, buildingCount] = await Promise.all([
    getNeighborhoodRents(zipCode),
    getSeasonalIndex(zipCode),
    getAmenityPremiums(zipCode),
    getBuildingCount(zipCode),
  ]);

  const trend = computeTrendStats(rents);

  if (rents.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <DollarSign className="w-12 h-12 text-[#A3ACBE] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[#1A1F36] mb-2">
          No Rent Data for {neighborhoodName ? `${neighborhoodName} (${zipCode})` : zipCode}
        </h1>
        <p className="text-[#5E6687]">
          We don&apos;t have rent trend data for this zip code yet.
        </p>
        <Link href={cityPath("/search", city)} className="text-[#6366F1] text-sm mt-4 inline-block">
          Search buildings
        </Link>
      </div>
    );
  }

  // ── Seasonal data (for 1BR or best available) ───────────────────────
  const seasonalBed =
    seasonal.find((s) => s.beds === 1) ? 1
    : seasonal.length > 0 ? seasonal[0].beds
    : 1;
  const seasonalFiltered = seasonal.filter((s) => s.beds === seasonalBed);
  const cheapestMonth = seasonalFiltered.length > 0
    ? seasonalFiltered.reduce((min, s) => (s.rent_index < min.rent_index ? s : min))
    : null;
  const mostExpensiveMonth = seasonalFiltered.length > 0
    ? seasonalFiltered.reduce((max, s) => (s.rent_index > max.rent_index ? s : max))
    : null;

  const peakSavings =
    trend && cheapestMonth && mostExpensiveMonth
      ? Math.round(
          trend.currentMedian * (Number(mostExpensiveMonth.rent_index) - Number(cheapestMonth.rent_index))
        )
      : null;

  // ── Aggregated amenity premiums ─────────────────────────────────────
  const aggregatedAmenities = aggregateAmenities(amenities);

  // ── Breadcrumbs ─────────────────────────────────────────────────────
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: CITY_META[city].name, href: cityPath("", city) },
    { label: "Rents", href: cityPath("/rents", city) },
    { label: displayName, href: cityPath(`/rents/${slug}`, city) },
  ];

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `Rent Trends in ${displayName}`,
            description: `Neighborhood rent intelligence for ${displayName} in ${CITY_META[city].name}.`,
            url: canonicalUrl(cityPath(`/rents/${slug}`, city)),
          }}
        />
        <Breadcrumbs items={breadcrumbs} />

        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="mt-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
            Rent Trends in {displayName}
          </h1>
          <p className="text-[#5E6687] mt-1">
            Median, historical trends, and seasonal patterns for ZIP {zipCode}
          </p>

          {/* Key stat badges */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {trend && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-sm font-semibold">
                <DollarSign className="w-4 h-4" />
                {formatDollar(trend.currentMedian)}/mo
              </span>
            )}
            {trend?.yoy != null && (
              <span
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  trend.yoy > 0
                    ? "bg-[#fee2e2] text-[#dc2626]"
                    : trend.yoy < 0
                      ? "bg-[#dcfce7] text-[#16a34a]"
                      : "bg-[#F5F7FA] text-[#5E6687]"
                }`}
              >
                {trend.yoy > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : trend.yoy < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : null}
                {formatPct(trend.yoy)} YoY
              </span>
            )}
            {buildingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F7FA] text-[#5E6687] text-sm font-semibold">
                <Building2 className="w-4 h-4" />
                {buildingCount.toLocaleString()} buildings
              </span>
            )}
          </div>
        </div>

        {/* ── Rent Trend Chart ─────────────────────────────────────── */}
        <div className="mb-8">
          <NeighborhoodRentChart rents={rents} />
        </div>

        {/* ── Stats Grid ───────────────────────────────────────────── */}
        {trend && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* YoY Change */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <p className="text-xs text-[#A3ACBE] uppercase tracking-wide font-medium mb-1">
                Year-over-Year
              </p>
              {trend.yoy != null ? (
                <div className="flex items-center gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      trend.yoy > 0
                        ? "text-[#dc2626]"
                        : trend.yoy < 0
                          ? "text-[#16a34a]"
                          : "text-[#1A1F36]"
                    }`}
                  >
                    {formatPct(trend.yoy)}
                  </p>
                  {trend.yoy > 0 ? (
                    <TrendingUp className="w-5 h-5 text-[#dc2626]" />
                  ) : trend.yoy < 0 ? (
                    <TrendingDown className="w-5 h-5 text-[#16a34a]" />
                  ) : null}
                </div>
              ) : (
                <p className="text-lg text-[#A3ACBE]">N/A</p>
              )}
            </div>

            {/* 5-Year Change */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <p className="text-xs text-[#A3ACBE] uppercase tracking-wide font-medium mb-1">
                5-Year Change
              </p>
              {trend.fiveYear != null ? (
                <p
                  className={`text-2xl font-bold ${
                    trend.fiveYear > 0
                      ? "text-[#dc2626]"
                      : trend.fiveYear < 0
                        ? "text-[#16a34a]"
                        : "text-[#1A1F36]"
                  }`}
                >
                  {formatPct(trend.fiveYear)}
                </p>
              ) : (
                <p className="text-lg text-[#A3ACBE]">N/A</p>
              )}
            </div>

            {/* Since earliest data */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <p className="text-xs text-[#A3ACBE] uppercase tracking-wide font-medium mb-1">
                Since {trend.startYear}
              </p>
              <p
                className={`text-2xl font-bold ${
                  trend.sinceStart > 0
                    ? "text-[#dc2626]"
                    : trend.sinceStart < 0
                      ? "text-[#16a34a]"
                      : "text-[#1A1F36]"
                }`}
              >
                {formatPct(trend.sinceStart)}
              </p>
            </div>
          </div>
        )}

        {/* ── Seasonal Heatmap ─────────────────────────────────────── */}
        {seasonalFiltered.length === 12 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-[#6366F1]" />
              <h2 className="text-lg font-bold text-[#1A1F36]">
                Best Time to Rent in {displayName}
              </h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {seasonalFiltered.map((s) => {
                const isCheapest = cheapestMonth && s.month_of_year === cheapestMonth.month_of_year;
                const isMostExpensive = mostExpensiveMonth && s.month_of_year === mostExpensiveMonth.month_of_year;
                const idx = Number(s.rent_index);

                let bgColor = "bg-white";
                let textColor = "text-[#1A1F36]";
                let borderColor = "border-[#E2E8F0]";
                if (isCheapest) {
                  bgColor = "bg-[#dcfce7]";
                  textColor = "text-[#16a34a]";
                  borderColor = "border-[#86efac]";
                } else if (isMostExpensive) {
                  bgColor = "bg-[#fee2e2]";
                  textColor = "text-[#dc2626]";
                  borderColor = "border-[#fca5a5]";
                }

                return (
                  <div
                    key={s.month_of_year}
                    className={`rounded-xl border ${borderColor} ${bgColor} p-3 text-center`}
                  >
                    <p className="text-xs font-medium text-[#A3ACBE] mb-1">
                      {MONTH_SHORT[s.month_of_year - 1]}
                    </p>
                    <p className={`text-sm font-bold ${textColor}`}>
                      {idx.toFixed(2)}
                    </p>
                    {isCheapest && (
                      <p className="text-[10px] font-semibold text-[#16a34a] mt-0.5">
                        Cheapest
                      </p>
                    )}
                    {isMostExpensive && (
                      <p className="text-[10px] font-semibold text-[#dc2626] mt-0.5">
                        Priciest
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {peakSavings != null && peakSavings > 0 && cheapestMonth && (
              <p className="text-sm text-[#5E6687] mt-3">
                Sign in{" "}
                <span className="font-semibold text-[#16a34a]">
                  {MONTH_NAMES[cheapestMonth.month_of_year - 1]}
                </span>{" "}
                to save ~<span className="font-semibold">${peakSavings.toLocaleString()}/mo</span> vs peak season.
              </p>
            )}
            <p className="text-[10px] text-[#A3ACBE] mt-1">
              Index of 1.00 = annual average. Below 1.00 = cheaper than average.
            </p>
          </div>
        )}

        <AdBlock adSlot="NEIGHBORHOOD_RENTS_MID" adFormat="horizontal" />

        {/* ── Amenity Premiums ─────────────────────────────────────── */}
        {aggregatedAmenities.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-lg font-bold text-[#1A1F36]">
                What Amenities Cost in {displayName}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aggregatedAmenities.map((a) => (
                <div
                  key={a.amenity}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {amenityLabel(a.amenity)}
                    </p>
                    <p className="text-xs text-[#A3ACBE] mt-0.5">
                      {a.sampleSize.toLocaleString()} listing{a.sampleSize !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#1A1F36]">
                      +${a.premiumDollars.toLocaleString()}
                    </p>
                    <p className="text-xs text-[#5E6687]">
                      +{a.premiumPct}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#A3ACBE] mt-2">
              Premium = median rent with amenity minus median rent without. Averaged across bed types.
            </p>
          </div>
        )}

        {/* ── Price Distribution ───────────────────────────────────── */}
        {trend && (() => {
          // Compute distribution from latest 12 months of data
          const recentRents = rents
            .filter((r) => r.beds === trend.bed && r.median_rent != null)
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 12);

          if (recentRents.length === 0) return null;

          const allMedians = recentRents.map((r) => Number(r.median_rent));
          const avg = allMedians.reduce((s, v) => s + v, 0) / allMedians.length;

          const tiers = [
            { label: "Budget (P25)", value: recentRents[0]?.p25_rent ? Number(recentRents[0].p25_rent) : null },
            { label: "Median", value: Math.round(avg) },
            { label: "Premium (P75)", value: recentRents[0]?.p75_rent ? Number(recentRents[0].p75_rent) : null },
          ].filter((t) => t.value != null);

          if (tiers.length < 2) return null;

          return (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-[#1A1F36] mb-4">
                Price Distribution
              </h2>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {tiers.map((tier, i) => (
                    <div key={tier.label} className="flex-1 text-center">
                      {i > 0 && (
                        <div className="hidden sm:block w-px h-10 bg-[#e2e8f0] mx-auto" />
                      )}
                      <p className="text-xs text-[#A3ACBE] uppercase tracking-wide font-medium mb-1">
                        {tier.label}
                      </p>
                      <p className="text-xl font-bold text-[#1A1F36]">
                        {formatDollar(tier.value!)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#5E6687] mt-4 text-center">
                  Based on recent {BED_LABELS[trend.bed] || `${trend.bed}BR`} listings in {displayName}.
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] rounded-xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Search Buildings in {displayName}
          </h2>
          <p className="text-white/80 text-sm mb-4">
            Browse building grades, violation history, and reviews for {zipCode}.
          </p>
          <Link
            href={cityPath(`/search?zip=${zipCode}`, city)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#1E40AF] rounded-lg font-semibold text-sm hover:bg-[#F5F7FA] transition-colors"
          >
            <Search className="w-4 h-4" />
            Search {displayName}
          </Link>
        </div>

        <AdBlock adSlot="NEIGHBORHOOD_RENTS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1BR",
  2: "2BR",
  3: "3BR",
  4: "4BR+",
};
