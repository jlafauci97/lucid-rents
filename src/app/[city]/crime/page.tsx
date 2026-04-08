import type { Metadata } from "next";
import Link from "next/link";
import { Siren, ShieldCheck, ShieldAlert, BarChart3 } from "lucide-react";
import {
  canonicalUrl,
  cityPath,
  cityBreadcrumbs,
  breadcrumbJsonLd,
} from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { FAQSection } from "@/components/seo/FAQSection";
import { CrimeRankingTable } from "@/components/crime/CrimeRankingTable";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { rankZips, type CityStats, type SafetyGrade } from "@/lib/crime-stats";
import { createClient } from "@/lib/supabase/server";

const GRADE_SCORES: Record<SafetyGrade, number> = {
  A: 4.5,
  B: 3.5,
  C: 2.5,
  D: 1.5,
  F: 0.5,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Crime Data & Safety Grades by Zip Code | ${meta.fullName} | Lucid Rents`,
    description: `Is ${meta.fullName} safe? See safety grades, crime rankings, and trends for every zip code. ${meta.crimeSource} data updated hourly with violent, property, and quality-of-life breakdowns.`,
    alternates: { canonical: canonicalUrl(cityPath("/crime", city)) },
    openGraph: {
      title: `Crime Data & Safety Grades | ${meta.fullName}`,
      description: `Is ${meta.fullName} safe? Safety grades and crime rankings for every zip code, powered by ${meta.crimeSource} data.`,
      url: canonicalUrl(cityPath("/crime", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

interface YoyRow {
  zip_code: string;
  current_year_total: number;
  prior_year_total: number;
  current_violent: number;
  prior_violent: number;
  current_property: number;
  prior_property: number;
}

interface TrendRow {
  zip_code: string;
  month: string;
  total: number;
}

export default async function CrimePage({
  params: routeParams,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await routeParams;
  if (!isValidCity(cityParam)) return null;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - 2);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  // Core data (from cache table — fast)
  const [zipRes, cityStatsRes, yoyRes] = await Promise.all([
    supabase.rpc("crime_by_zip", { since_date: sinceDateStr, metro: city }),
    supabase.rpc("crime_city_stats", { since_date: sinceDateStr, metro: city }),
    supabase.rpc("crime_zip_yoy", { metro: city }),
  ]);

  // Sparkline data disabled — crime_all_zip_trends scans raw table and
  // exceeds Vercel function timeout. TODO: add monthly trends to cache table.

  const zipData = zipRes.data || [];
  const cityStats: CityStats | null = cityStatsRes.data?.[0] ?? null;

  // Build YoY map
  const yoyMap = new Map<string, YoyRow>();
  for (const row of (yoyRes.data || []) as YoyRow[]) {
    yoyMap.set(row.zip_code, row);
  }

  // Sparklines disabled for now (empty object = no sparklines shown)
  const trendsByZip: Record<string, number[]> = {};

  // Rank all zips
  const rankedZips = rankZips(zipData, yoyMap, (zip) =>
    getNeighborhoodNameByCity(zip, city)
  );

  // Grade distribution
  const gradeCounts: Record<SafetyGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const z of rankedZips) gradeCounts[z.grade]++;

  // Top 5 safest / most dangerous
  const safest = rankedZips.slice(0, 5);
  const mostDangerous = [...rankedZips].reverse().slice(0, 5);

  // Stats
  const totalCrimes = cityStats?.total_crimes ?? rankedZips.reduce((s, r) => s + r.total, 0);
  const totalViolent = cityStats?.total_violent ?? rankedZips.reduce((s, r) => s + r.violent, 0);
  const violentPct = totalCrimes > 0 ? ((totalViolent / totalCrimes) * 100).toFixed(1) : "0";
  const zipCount = cityStats?.zip_count ?? rankedZips.length;

  // Breadcrumbs
  const bcItems = cityBreadcrumbs(city, {
    label: "Crime Data",
    href: cityPath("/crime", city),
  });

  // FAQ
  const faqItems = [
    {
      question: `How are safety grades calculated for ${meta.fullName}?`,
      answer: `Safety grades are based on percentile ranking of total crime incidents across all zip codes. Zip codes in the lowest 20% of crime receive an A grade, 20-40% get a B, and so on. This provides a relative comparison across ${meta.fullName} neighborhoods.`,
    },
    {
      question: "How often is crime data updated?",
      answer: `Crime data is sourced from ${meta.crimeSource} and refreshed hourly. Year-over-year trends compare the most recent 12-month period to the same period one year prior.`,
    },
    {
      question: "What does the year-over-year trend show?",
      answer:
        "The YoY trend compares total reported crimes in the current year to the same period in the prior year. A negative percentage means crime is declining in that zip code.",
    },
    {
      question: `Which ${meta.fullName} zip codes are the safest?`,
      answer: `The safest zip codes are ranked by lowest total crime count and receive an A safety grade. Check the ranking table above for the current top-ranked neighborhoods.`,
    },
    {
      question: "What crime categories are tracked?",
      answer:
        "Crimes are categorized into three groups: violent crimes (assault, robbery, murder), property crimes (burglary, theft, auto theft), and quality-of-life offenses (noise, graffiti, public disturbance).",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Structured data */}
      <JsonLd data={breadcrumbJsonLd(bcItems.map(b => ({ name: b.label, url: b.href })))} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={bcItems} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#FEE2E2] rounded-lg">
            <Siren className="w-6 h-6 text-[#DC2626]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Crime Data &amp; Safety Grades
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          {meta.crimeSource} data &bull; {rankedZips.length} zip codes &bull;
          Updated hourly
        </p>
      </div>

      {/* City-wide hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Total Incidents
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalCrimes.toLocaleString()}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">Last 2 years</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
              Violent Crime Rate
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{violentPct}%</p>
          <p className="text-xs text-[#94a3b8] mt-1">Of total incidents</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Siren className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Zip Codes Tracked
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{zipCount}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Across {meta.fullName}</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Grade Distribution
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {(["A", "B", "C", "D", "F"] as SafetyGrade[]).map((g) => (
              <div key={g} className="text-center">
                <LetterGrade score={GRADE_SCORES[g]} size="sm" />
                <p className="text-[10px] text-[#64748b] mt-0.5 font-medium">
                  {gradeCounts[g]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Safest Neighborhoods */}
      {safest.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              Safest Neighborhoods
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {safest.map((z) => (
              <Link
                key={z.zip_code}
                href={cityPath(`/crime/${z.zip_code}`, city)}
                className="block bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <span className="text-xs font-mono text-[#64748b]">
                    #{z.rank}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#0F1D2E] truncate">
                  {z.neighborhood || z.zip_code}
                </p>
                <p className="text-xs text-[#64748b]">{z.zip_code}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#64748b]">
                    {z.total.toLocaleString()} incidents
                  </span>
                  {z.yoy_total_pct !== null && (
                    <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Highest Crime Areas */}
      {mostDangerous.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              Highest Crime Areas
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {mostDangerous.map((z) => (
              <Link
                key={z.zip_code}
                href={cityPath(`/crime/${z.zip_code}`, city)}
                className="block bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <span className="text-xs font-mono text-[#64748b]">
                    #{z.rank}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#0F1D2E] truncate">
                  {z.neighborhood || z.zip_code}
                </p>
                <p className="text-xs text-[#64748b]">{z.zip_code}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#64748b]">
                    {z.total.toLocaleString()} incidents
                  </span>
                  {z.yoy_total_pct !== null && (
                    <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main ranking table */}
      {rankedZips.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl">
          <Siren className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">No crime data available yet.</p>
        </div>
      ) : (
        <CrimeRankingTable
          rows={rankedZips}
          trendData={trendsByZip}
          cityPath={(path) => cityPath(path, city)}
          regionLabel={meta.regionLabel}
          areas={[...meta.crimeAreas]}
        />
      )}

      {/* FAQ */}
      <FAQSection items={faqItems} />
    </div>
  );
}
