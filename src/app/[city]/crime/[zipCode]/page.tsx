import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Siren, ArrowLeft, Building2, MapPin } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { buildingUrl, canonicalUrl, neighborhoodUrl, cityPath, breadcrumbJsonLd } from "@/lib/seo";
import { getNeighborhoodName } from "@/lib/nyc-neighborhoods";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import dynamic from "next/dynamic";

const ChartSkeleton = () => <div className="bg-white rounded-xl border border-[#e2e8f0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" /></div>;
const CrimeTrend = dynamic(() => import("@/components/crime/CrimeTrend").then(m => m.CrimeTrend), { loading: ChartSkeleton });
const CrimeCategoryBreakdown = dynamic(() => import("@/components/crime/CrimeCategoryBreakdown").then(m => m.CrimeCategoryBreakdown), { loading: ChartSkeleton });
import { FAQSection } from "@/components/seo/FAQSection";
import { generateCrimeFAQ } from "@/lib/faq/area-faq";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import {
  CRIME_CATEGORY_LABELS,
  CRIME_CATEGORY_COLORS,
} from "@/lib/crime-categories";
import type { CrimeCategory } from "@/lib/crime-categories";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; zipCode: string }>;
}): Promise<Metadata> {
  const { zipCode } = await params;
  const name = getNeighborhoodName(zipCode);
  const displayName = name ? `${name} (${zipCode})` : zipCode;
  const { city } = await params;
  const url = canonicalUrl(cityPath(`/crime/${zipCode}`, city as import("@/lib/cities").City));
  return {
    title: `Crime in ${displayName} | Lucid Rents`,
    description: `Is ${displayName} safe? See crime trends, recent incidents, and category breakdowns to understand safety before you move.`,
    alternates: { canonical: url },
    openGraph: {
      title: `Crime Data for ${displayName}`,
      description: `Crime trends and recent incidents for ${displayName}, ${CITY_META[city as City].fullName}.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CrimeZipPage({
  params,
}: {
  params: Promise<{ city: string; zipCode: string }>;
}) {
  const { city: cityParam, zipCode } = await params;
  const city = cityParam as City;
  const neighborhoodName = getNeighborhoodName(zipCode);
  const displayName = neighborhoodName ? `${neighborhoodName} (${zipCode})` : zipCode;
  const supabase = await createClient();

  // Fetch summary, recent crimes, and buildings in this zip in parallel
  // Use 2-year lookback to capture all available data (LAPD data may lag)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const sinceDate = twoYearsAgo.toISOString().split("T")[0];

  const [summaryRes, recentRes, buildingsRes] = await Promise.all([
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
      .limit(25),
    supabase
      .from("buildings")
      .select("id, full_address, borough, slug, overall_score, violation_count, crime_count")
      .eq("zip_code", zipCode)
      .order("violation_count", { ascending: false })
      .limit(10),
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

  return (
    <AdSidebar>
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

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
            Total
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {Number(summary.total).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
            Violent
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {Number(summary.violent).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide">
            Property
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {Number(summary.property).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#3B82F6] font-medium uppercase tracking-wide">
            Quality of Life
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {Number(summary.quality_of_life).toLocaleString()}
          </p>
        </div>
      </div>

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

      {/* Two column layout: recent crimes + buildings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent crimes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold text-[#0F1D2E]">
                Recent Crimes
              </h2>
              <p className="text-sm text-[#64748b]">
                Most recent incidents reported by {CITY_META[city].crimeSource}
              </p>
            </CardHeader>
            <CardContent>
              {recentCrimes.length === 0 ? (
                <p className="text-center text-[#64748b] py-8">
                  No recent crimes recorded in this zip code.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentCrimes.map((crime) => (
                    <div
                      key={crime.id}
                      className="flex items-start gap-3 py-3 border-b border-[#f1f5f9] last:border-0"
                    >
                      <span
                        className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CRIME_CATEGORY_COLORS[
                              (crime.crime_category as CrimeCategory) ||
                                "quality_of_life"
                            ],
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F1D2E] truncate">
                          {crime.offense_description || "Unknown Offense"}
                        </p>
                        {crime.pd_description && (
                          <p className="text-xs text-[#64748b] mt-0.5 truncate">
                            {crime.pd_description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#94a3b8]">
                          <span>{formatDate(crime.cmplnt_date)}</span>
                          {crime.law_category && (
                            <span className="px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                              {crime.law_category}
                            </span>
                          )}
                          {crime.crime_category && (
                            <span
                              className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium"
                              style={{
                                backgroundColor:
                                  CRIME_CATEGORY_COLORS[
                                    crime.crime_category as CrimeCategory
                                  ] || "#94a3b8",
                              }}
                            >
                              {CRIME_CATEGORY_LABELS[
                                crime.crime_category as CrimeCategory
                              ] || crime.crime_category}
                            </span>
                          )}
                          {crime.precinct && (
                            <span>Precinct {crime.precinct}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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

      <AdBlock adSlot="CRIME_ZIP_BOTTOM" adFormat="horizontal" />

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
    </AdSidebar>
  );
}
