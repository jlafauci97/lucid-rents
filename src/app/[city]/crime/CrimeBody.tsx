import Link from "next/link";
import { Siren, ShieldCheck, ShieldAlert, BarChart3 } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { CrimeRankingTable } from "@/components/crime/CrimeRankingTable";
import { CITY_META, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { rankZips, type CityStats, type SafetyGrade } from "@/lib/crime-stats";
import { createCacheClient } from "@/lib/supabase/cache-client";

const GRADE_SCORES: Record<SafetyGrade, number> = {
  A: 4.5,
  B: 3.5,
  C: 2.5,
  D: 1.5,
  F: 0.5,
};

interface YoyRow {
  zip_code: string;
  current_year_total: number;
  prior_year_total: number;
  current_violent: number;
  prior_violent: number;
  current_property: number;
  prior_property: number;
}

export async function CrimeBody({ city }: { city: City }) {
  const meta = CITY_META[city];

  const supabase = createCacheClient();
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

  return (
    <>
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
          cityPathPrefix={cityPath("", city)}
          regionLabel={meta.regionLabel}
          areas={[...meta.crimeAreas]}
        />
      )}
    </>
  );
}
