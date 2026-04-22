import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQSection } from "@/components/seo/FAQSection";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { rankZips, type SafetyGrade } from "@/lib/crime-stats";

export const revalidate = 3600;

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
  const url = canonicalUrl(cityPath("/crime/safest", city));
  return {
    title: `Safest Neighborhoods in ${meta.fullName} (2026)`,
    description: `Ranked list of the safest neighborhoods and zip codes in ${meta.fullName} based on crime data. See safety grades, crime trends, and detailed breakdowns.`,
    alternates: { canonical: url },
    openGraph: {
      title: `Safest Neighborhoods in ${meta.fullName} — Ranked by Safety Grade`,
      description: `Find the safest zip codes in ${meta.fullName}. Data-driven safety rankings updated monthly.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

interface YoyRow {
  zip_code: string;
  current_year_total: number;
  prior_year_total: number;
  current_violent: number;
  prior_violent: number;
  current_property: number;
  prior_property: number;
}

export default async function SafestNeighborhoodsPage({
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

  const [zipRes, yoyRes] = await Promise.all([
    supabase.rpc("crime_by_zip", { since_date: sinceDateStr, metro: city }),
    supabase.rpc("crime_zip_yoy", { metro: city }),
  ]);

  const zipData = zipRes.data || [];

  // Build YoY map
  const yoyMap = new Map<string, YoyRow>();
  for (const row of (yoyRes.data || []) as YoyRow[]) {
    yoyMap.set(row.zip_code, row);
  }

  // Rank all zips (sorted safest first)
  const rankedZips = rankZips(zipData, yoyMap, (zip) =>
    getNeighborhoodNameByCity(zip, city)
  );

  // Breadcrumbs
  const bcItems = cityBreadcrumbs(
    city,
    { label: "Crime Data", href: cityPath("/crime", city) },
    { label: "Safest Neighborhoods", href: cityPath("/crime/safest", city) }
  );

  // Top 10 safest & bottom 10 highest crime
  const top10 = rankedZips.slice(0, 10);
  const bottom10 = [...rankedZips].reverse().slice(0, 10);

  // FAQ
  const faqItems = [
    {
      question: `What are the safest neighborhoods in ${meta.fullName}?`,
      answer: `The safest neighborhoods in ${meta.fullName} are ranked by total crime count per zip code. Zip codes with the fewest reported incidents receive an A safety grade. Check the ranking above for the latest top-ranked areas.`,
    },
    {
      question: "How are safety grades calculated?",
      answer: `Safety grades are based on percentile ranking of total crime incidents across all zip codes. Zip codes in the lowest 20% of crime receive an A grade, 20-40% get a B, 40-60% a C, 60-80% a D, and the highest 20% receive an F grade.`,
    },
    {
      question: `Is ${meta.fullName} safe to live in?`,
      answer: `Safety varies widely across ${meta.fullName}. Many neighborhoods have very low crime rates and receive A or B safety grades. Use the rankings above to compare specific zip codes and find the safest areas for your needs.`,
    },
    {
      question: "How often is crime data updated?",
      answer: `Crime data is sourced from ${meta.crimeSource} and refreshed hourly. Year-over-year trends compare the most recent 12-month period to the same period one year prior.`,
    },
  ];

  // ItemList JSON-LD for rich results
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Safest Neighborhoods in ${meta.fullName}`,
    numberOfItems: rankedZips.length,
    itemListElement: rankedZips.slice(0, 20).map((z, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: z.neighborhood || z.zip_code,
      url: canonicalUrl(cityPath(`/crime/${z.zip_code}`, city)),
    })),
  };

  // Empty state
  if (rankedZips.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={bcItems} />
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl mt-6">
          <Shield className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">
            Crime data is not yet available for {meta.fullName}. Check back
            soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Structured data */}
      <JsonLd data={itemListJsonLd} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={bcItems} />

      {/* Header */}
      <div className="mb-8 mt-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Safest Neighborhoods in {meta.fullName}
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          {rankedZips.length} zip codes ranked by safety grade &bull;{" "}
          {meta.crimeSource} data &bull; Updated hourly
        </p>
      </div>

      {/* Top 10 Safest */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">
            Top 10 Safest Zip Codes
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {top10.map((z) => (
            <Link
              key={z.zip_code}
              href={cityPath(`/crime/${z.zip_code}`, city)}
              className="block bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F1D2E]">
                      {z.neighborhood || z.zip_code}
                    </p>
                    <p className="text-xs text-[#64748b]">
                      {z.zip_code}
                      {z.borough ? ` \u2022 ${z.borough}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#64748b]">
                  #{z.rank}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#64748b]">
                  {z.total.toLocaleString()} total incidents
                </span>
                {z.yoy_total_pct !== null && (
                  <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Full Ranking Table */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
          Full Safety Ranking
        </h2>
        <div className="overflow-x-auto bg-white border border-[#e2e8f0] rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-left text-xs text-[#64748b] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Neighborhood / Zip</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">
                  {meta.regionLabel}
                </th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
                  Violent
                </th>
                <th className="px-4 py-3 font-medium text-right">YoY</th>
              </tr>
            </thead>
            <tbody>
              {rankedZips.map((z) => (
                <tr
                  key={z.zip_code}
                  className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[#64748b] text-xs">
                    {z.rank}
                  </td>
                  <td className="px-4 py-3">
                    <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={cityPath(`/crime/${z.zip_code}`, city)}
                      className="text-[#2563EB] hover:underline font-medium"
                    >
                      {z.neighborhood || z.zip_code}
                    </Link>
                    <span className="text-xs text-[#64748b] ml-1.5">
                      {z.zip_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748b] hidden sm:table-cell">
                    {z.borough || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#0F1D2E]">
                    {z.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-[#64748b] hidden md:table-cell">
                    {z.violent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {z.yoy_total_pct !== null ? (
                      <TrendBadge value={z.yoy_total_pct} suffix="%" />
                    ) : (
                      <span className="text-[#94a3b8]">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Highest Crime Areas */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
          Highest Crime Areas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bottom10.map((z) => (
            <Link
              key={z.zip_code}
              href={cityPath(`/crime/${z.zip_code}`, city)}
              className="block bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F1D2E]">
                      {z.neighborhood || z.zip_code}
                    </p>
                    <p className="text-xs text-[#64748b]">
                      {z.zip_code}
                      {z.borough ? ` \u2022 ${z.borough}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#64748b]">
                  #{z.rank}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#64748b]">
                  {z.total.toLocaleString()} total incidents
                </span>
                {z.yoy_total_pct !== null && (
                  <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQSection items={faqItems} />
    </div>
  );
}
