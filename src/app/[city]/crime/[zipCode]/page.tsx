import { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { Siren, Building2, MapPin } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { buildingUrl, canonicalUrl, neighborhoodUrl, cityPath, breadcrumbJsonLd } from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { CITY_META, isValidCity } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import dynamic from "next/dynamic";

const ChartSkeleton = () => <div className="bg-white rounded-xl border border-[#e2e8f0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" /></div>;
const CrimeTrend = dynamic(() => import("@/components/crime/CrimeTrend").then(m => m.CrimeTrend), { loading: ChartSkeleton });
const CrimeCategoryBreakdown = dynamic(() => import("@/components/crime/CrimeCategoryBreakdown").then(m => m.CrimeCategoryBreakdown), { loading: ChartSkeleton });
import { FAQSection } from "@/components/seo/FAQSection";
import { generateCrimeFAQ } from "@/lib/faq/area-faq";
import { SafetyVerdict } from "@/components/crime/SafetyVerdict";
import { CrimeStatsGrid } from "@/components/crime/CrimeStatsGrid";
import { DailyCrimeFeed } from "@/components/crime/DailyCrimeFeed";
import { safetyGrade, safetyVerdict, rankZips } from "@/lib/crime-stats";

interface CrimeSummary {
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
  felonies: number;
  misdemeanors: number;
  violations: number;
}

interface RecentCrime {
  id: string;
  cmplnt_num: string;
  cmplnt_date: string | null;
  offense_description: string | null;
  law_category: string | null;
  crime_category: string | null;
  pd_description: string | null;
  precinct: number | null;
}

export const revalidate = 3600;


// Enable on-demand ISR for unbounded dynamic params. Without this Next.js 16
// treats the route as fully dynamic and ignores `revalidate`.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
const getPageData = cache(async (city: City, zipCode: string) => {
  const supabase = createCacheClient();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const sinceDate = twoYearsAgo.toISOString().split("T")[0];

  const [summaryRes, recentRes, buildingsRes, cityStatsRes, yoyRes, allZipsRes] = await Promise.all([
    supabase.rpc("crime_zip_summary", {
      target_zip: zipCode,
      since_date: sinceDate,
      metro: city,
    }),
    supabase
      .from("nypd_complaints")
      .select(
        "id, cmplnt_num, cmplnt_date, offense_description, law_category, crime_category, pd_description, precinct"
      )
      .eq("zip_code", zipCode)
      .eq("metro", city)
      .gte("cmplnt_date", sinceDate)
      .order("cmplnt_date", { ascending: false })
      .limit(50),
    supabase
      .from("buildings")
      .select("id, full_address, borough, slug, overall_score, violation_count, crime_count")
      .eq("zip_code", zipCode)
      .order("violation_count", { ascending: false })
      .limit(10),
    supabase.rpc("crime_city_stats", { since_date: sinceDate, metro: city }),
    supabase.rpc("crime_zip_yoy", { metro: city }),
    supabase.rpc("crime_by_zip", { since_date: sinceDate, metro: city }),
  ]);

  const summary: CrimeSummary = summaryRes.data?.[0] || {
    total: 0,
    violent: 0,
    property: 0,
    quality_of_life: 0,
    felonies: 0,
    misdemeanors: 0,
    violations: 0,
  };

  const recentCrimes: RecentCrime[] = recentRes.data || [];
  const buildings = buildingsRes.data || [];
  const cityStats = cityStatsRes.data?.[0] || {
    avg_per_zip: 0,
    avg_violent_per_zip: 0,
    avg_property_per_zip: 0,
    avg_qol_per_zip: 0,
  };

  // Build YoY lookup map
  const yoyMap = new Map<string, {
    current_year_total: number; prior_year_total: number;
    current_violent: number; prior_violent: number;
    current_property: number; prior_property: number;
  }>();
  for (const row of yoyRes.data || []) {
    yoyMap.set(row.zip_code, row);
  }

  // Rank all zips and find this one
  const allZips = allZipsRes.data || [];
  const ranked = rankZips(allZips, yoyMap, (z) => getNeighborhoodNameByCity(z, city));
  const thisZipRanked = ranked.find((r) => r.zip_code === zipCode);

  const zipGrade = thisZipRanked?.grade ?? safetyGrade(50);
  const yoyTotalPct = thisZipRanked?.yoy_total_pct ?? null;
  const yoyViolentPct = thisZipRanked?.yoy_violent_pct ?? null;
  const yoyPropertyPct = thisZipRanked?.yoy_property_pct ?? null;

  const neighborhoodName = getNeighborhoodNameByCity(zipCode, city);
  const displayName = neighborhoodName ? `${neighborhoodName} (${zipCode})` : zipCode;

  const verdictText = safetyVerdict(
    zipGrade,
    neighborhoodName || zipCode,
    thisZipRanked?.yoy_total_pct ?? null,
    summary.total,
    cityStats.avg_per_zip,
    summary.violent - (cityStats.avg_violent_per_zip || 0)
  );

  return {
    summary,
    recentCrimes,
    buildings,
    cityStats,
    zipGrade,
    yoyTotalPct,
    yoyViolentPct,
    yoyPropertyPct,
    verdictText,
    neighborhoodName,
    displayName,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; zipCode: string }>;
}): Promise<Metadata> {
  const { city: cityParam, zipCode } = await params;
  if (!isValidCity(cityParam)) return {};
  const city = cityParam as City;

  const { displayName, zipGrade } = await getPageData(city, zipCode);
  const url = canonicalUrl(cityPath(`/crime/${zipCode}`, city));

  return {
    title: `Crime in ${displayName} — Safety Grade ${zipGrade}`,
    description: `Is ${displayName} safe? See crime trends, recent incidents, and category breakdowns to understand safety before you move.`,
    alternates: { canonical: url },
    openGraph: {
      title: `Crime Data for ${displayName}`,
      description: `Crime trends and recent incidents for ${displayName}, ${CITY_META[city].fullName}.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function CrimeZipPage({
  params,
}: {
  params: Promise<{ city: string; zipCode: string }>;
}) {
  const { city: cityParam, zipCode } = await params;
  const city = cityParam as City;

  const {
    summary,
    recentCrimes,
    buildings,
    cityStats,
    zipGrade,
    yoyTotalPct,
    yoyViolentPct,
    yoyPropertyPct,
    verdictText,
    neighborhoodName,
    displayName,
  } = await getPageData(city, zipCode);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Place",
        name: neighborhoodName
          ? `${neighborhoodName}, ${CITY_META[city].name} (${zipCode})`
          : `${CITY_META[city].name} Zip Code ${zipCode}`,
        address: {
          "@type": "PostalAddress",
          postalCode: zipCode,
          ...(neighborhoodName ? { addressLocality: neighborhoodName } : {}),
          addressRegion: CITY_META[city].stateCode,
          addressCountry: "US",
        },
      }} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Crime", url: cityPath("/crime", city) },
        { name: neighborhoodName || zipCode, url: cityPath(`/crime/${zipCode}`, city) },
      ])} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Crime", href: cityPath("/crime", city) },
        { label: neighborhoodName || zipCode, href: cityPath(`/crime/${zipCode}`, city) },
      ]} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#FEE2E2] rounded-lg">
            <Siren className="w-6 h-6 text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Crime in {displayName}
            </h1>
          </div>
        </div>
        <p className="text-[#64748b] text-sm">
          {CITY_META[city].crimeSource} crime data for the last 2 years
        </p>
      </div>

      {/* Safety Verdict Banner */}
      <SafetyVerdict
        grade={zipGrade}
        displayName={displayName}
        verdictText={verdictText}
      />

      {/* Summary stat cards with YoY deltas */}
      <CrimeStatsGrid stats={[
        { label: "Total", value: summary.total, cityAvg: cityStats.avg_per_zip, yoyPct: yoyTotalPct, color: "#64748b" },
        { label: "Violent", value: summary.violent, cityAvg: cityStats.avg_violent_per_zip, yoyPct: yoyViolentPct, color: "#EF4444" },
        { label: "Property", value: summary.property, cityAvg: cityStats.avg_property_per_zip, yoyPct: yoyPropertyPct, color: "#F59E0B" },
        { label: "Quality of Life", value: summary.quality_of_life, cityAvg: cityStats.avg_qol_per_zip, yoyPct: null, color: "#3B82F6" },
      ]} />

      {/* Charts */}
      <div className="space-y-8 mb-8">
        <CrimeTrend zipCode={zipCode} city={city} />
        <CrimeCategoryBreakdown summary={summary} />
      </div>

      {/* Neighborhood Report Card link */}
      {neighborhoodName && (
        <Link
          href={neighborhoodUrl(zipCode)}
          className="flex items-center gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 mb-8 hover:bg-[#DBEAFE] transition-colors"
        >
          <MapPin className="w-5 h-5 text-[#3B82F6] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              {neighborhoodName} Report Card
            </p>
            <p className="text-xs text-[#64748b]">See building grades, violations, and landlord info for {displayName}</p>
          </div>
        </Link>
      )}

      {/* Two column layout: daily crime feed + buildings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Crime Feed */}
        <div className="lg:col-span-2">
          <DailyCrimeFeed crimes={recentCrimes} crimeSource={CITY_META[city].crimeSource} />
        </div>

        {/* Buildings in this zip */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-[#3B82F6]" />
                <h3 className="text-base font-bold text-[#0F1D2E]">
                  Buildings in {zipCode}
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              {buildings.length === 0 ? (
                <p className="text-sm text-[#64748b] text-center py-4">
                  No buildings tracked in this zip code.
                </p>
              ) : (
                <div className="space-y-2">
                  {buildings.map(
                    (b: {
                      id: string;
                      full_address: string;
                      borough: string;
                      slug: string;
                      overall_score: number | null;
                      violation_count: number;
                    }) => (
                      <Link
                        key={b.id}
                        href={buildingUrl(b, city)}
                        className="block p-3 rounded-lg border border-[#e2e8f0] hover:border-[#3B82F6] hover:bg-[#f8fafc] transition-colors"
                      >
                        <p className="text-sm font-medium text-[#0F1D2E] truncate">
                          {b.full_address}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#64748b]">
                          {b.overall_score !== null && (
                            <span>
                              Score:{" "}
                              <span className="font-semibold">
                                {b.overall_score}
                              </span>
                            </span>
                          )}
                          <span>
                            {b.violation_count} violation
                            {b.violation_count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <FAQSection
        items={generateCrimeFAQ({
          displayName,
          zipCode,
          summary,
          cityName: CITY_META[city].name,
          crimeSource: CITY_META[city].crimeSource,
        })}
        title={`Frequently Asked Questions About Crime in ${displayName}`}
      />
    </div>
  );
}
