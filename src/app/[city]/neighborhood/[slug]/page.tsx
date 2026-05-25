import { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";
import { MapPin, Building2, AlertTriangle, MessageSquare, Users, Siren } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { getLetterGrade, getGradeColor, normalizeScore } from "@/lib/constants";
import { buildingUrl, landlordUrl, canonicalUrl, cityPath, neighborhoodUrl, neighborhoodsUrl, breadcrumbJsonLd } from "@/lib/seo";
import { parseNeighborhoodSlug } from "@/lib/nyc-neighborhoods";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { NeighborhoodRankCard } from "@/components/neighborhood/NeighborhoodRankCard";
import { NeighborhoodRentChart, type NeighborhoodRentRow } from "@/components/neighborhood/NeighborhoodRentChart";
import { BestApartments } from "@/components/neighborhood/BestApartments";
import { NeighborhoodPulse } from "@/components/neighborhood/NeighborhoodPulse";
import { CompareButton } from "@/components/neighborhood/CompareButton";
import { WalkabilitySection } from "@/components/neighborhood/WalkabilitySection";
import { DemographicSnapshot } from "@/components/neighborhood/DemographicSnapshot";
import { RelatedNeighborhoods } from "@/components/neighborhood/RelatedNeighborhoods";
import { FAQSection } from "@/components/seo/FAQSection";
import { generateNeighborhoodFAQ } from "@/lib/faq/area-faq";
import { VibeCheck } from "@/components/neighborhood/VibeCheck";
import { NeighborhoodSectionNav } from "@/components/neighborhood/NeighborhoodSectionNav";
import { getNeighborhoodVibe } from "@/lib/neighborhood-vibes";
import { NeighborhoodTopLandlords } from "@/components/neighborhood/NeighborhoodTopLandlords";

export const revalidate = 3600;


// Enable on-demand ISR for unbounded dynamic params. Without this Next.js 16
// treats the route as fully dynamic and ignores `revalidate`.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}): Promise<Metadata> {
  const { city: cityParam, slug } = await params;
  const city = cityParam as City;
  const zipCode = parseNeighborhoodSlug(slug);
  const name = getNeighborhoodNameByCity(zipCode, city);
  const displayName = name ? `${name} (${zipCode})` : zipCode;
  const url = canonicalUrl(neighborhoodUrl(zipCode));
  return {
    title: name ? `${name} Report Card (${zipCode}) — Building Grades & Crime Data` : `Neighborhood Report Card: ${zipCode} — Building Grades & Crime Data`,
    description: `Should you move to ${displayName}? See building grades, crime stats, top landlords, and violation density in one report card.`,
    alternates: { canonical: url },
    openGraph: {
      title: name ? `${name} Report Card (${zipCode}) — Building Grades & Crime Data` : `Neighborhood Report Card: ${zipCode} — Building Grades & Crime Data`,
      description: `Should you move to ${displayName}? Building grades, crime stats, and landlord data in one report card.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

interface NeighborhoodStats {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  buildings_with_reviews: number;
  total_reviews: number;
  top_landlord: string | null;
  top_landlord_buildings: number;
}

interface CrimeZipRow {
  zip_code: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

// cache() deduplicates calls between generateMetadata and page render
const getNeighborhoodStats = cache(async function getNeighborhoodStats(zipCode: string): Promise<NeighborhoodStats | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/neighborhood_stats`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_zip: zipCode }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
});

const getCrimeData = cache(async function getCrimeData(zipCode: string): Promise<CrimeZipRow | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip_single`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_zip: zipCode }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] || null : data;
});

async function getTopBuildings(zipCode: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?zip_code=eq.${zipCode}&select=id,full_address,borough,slug,overall_score,violation_count,complaint_count,review_count,owner_name&order=violation_count.desc&limit=5`;
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

const getNeighborhoodRents = cache(async function getNeighborhoodRents(
  zip: string
): Promise<NeighborhoodRentRow[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dewey_neighborhood_rents?zip=eq.${zip}&select=month,beds,median_rent,p25_rent,p75_rent,listing_count&order=month.asc`;
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
});

async function getBestApartments(zipCode: string, city: City) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?zip_code=eq.${zipCode}&metro=eq.${city}&select=id,full_address,borough,slug,overall_score,median_rent&not.median_rent=is.null&order=overall_score.desc.nullslast&limit=20`;
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function getTopLandlords(zipCode: string, city: City): Promise<Array<{ slug: string; name: string; violationCount: number; buildingCount: number }>> {
  // Fetch owner_name + violation_count per building in this ZIP so we can
  // rank by aggregate violations (was previously ranked by building count).
  const buildingsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?zip_code=eq.${zipCode}&metro=eq.${city}&select=owner_name,violation_count&not.owner_name=is.null`;
  const buildingsRes = await fetch(buildingsUrl, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!buildingsRes.ok) return [];
  const buildingRows: Array<{ owner_name: string; violation_count: number | null }> = await buildingsRes.json();

  // Aggregate violations + building count per owner
  const agg = new Map<string, { violations: number; buildings: number }>();
  for (const r of buildingRows) {
    const name = r.owner_name;
    const v = r.violation_count ?? 0;
    const prev = agg.get(name) ?? { violations: 0, buildings: 0 };
    agg.set(name, { violations: prev.violations + v, buildings: prev.buildings + 1 });
  }

  const topOwnerNames = Array.from(agg.entries())
    .filter(([, stats]) => stats.violations > 0)
    .sort((a, b) => b[1].violations - a[1].violations)
    .slice(0, 10)
    .map(([name]) => name);

  if (topOwnerNames.length === 0) return [];

  // Look up slugs from landlord_stats
  const inFilter = topOwnerNames.map((n) => `"${n}"`).join(",");
  const statsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/landlord_stats?select=name,slug&metro=eq.${city}&name=in.(${encodeURIComponent(inFilter)})`;
  const statsRes = await fetch(statsUrl, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!statsRes.ok) return [];
  const statsRows: Array<{ name: string; slug: string | null }> = await statsRes.json();

  return statsRows
    .filter((l) => l.slug)
    .map((l) => {
      const stats = agg.get(l.name) ?? { violations: 0, buildings: 0 };
      return {
        name: l.name,
        slug: l.slug as string,
        violationCount: stats.violations,
        buildingCount: stats.buildings,
      };
    })
    .sort((a, b) => b.violationCount - a.violationCount)
    .slice(0, 10);
}

function getSubGrade(value: number, thresholds: [number, number, number, number]): number {
  if (value <= thresholds[0]) return 4.5;
  if (value <= thresholds[1]) return 3.5;
  if (value <= thresholds[2]) return 2.5;
  if (value <= thresholds[3]) return 1.5;
  return 0.5;
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  const { city: cityParam, slug } = await params;
  const city = cityParam as City;
  const zipCode = parseNeighborhoodSlug(slug);
  const neighborhoodName = getNeighborhoodNameByCity(zipCode, city);

  const [stats, crime, buildings, rents, bestBuildings, topLandlords] = await Promise.all([
    getNeighborhoodStats(zipCode),
    getCrimeData(zipCode),
    getTopBuildings(zipCode),
    getNeighborhoodRents(zipCode),
    getBestApartments(zipCode, city),
    getTopLandlords(zipCode, city),
  ]);

  if (!stats || stats.building_count === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <MapPin className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[#0F1D2E] mb-2">
          No Data for {neighborhoodName ? `${neighborhoodName} (${zipCode})` : zipCode}
        </h1>
        <p className="text-[#64748b]">We don&apos;t have building data for this zip code yet.</p>
        <Link href={cityPath("/crime", city)} className="text-[#3B82F6] text-sm mt-4 inline-block">
          Browse all neighborhoods
        </Link>
      </div>
    );
  }

  const buildingCount = Number(stats.building_count);
  const avgScore = stats.avg_score ? normalizeScore(Number(stats.avg_score)) : null;
  const totalViolations = Number(stats.total_violations);
  const totalComplaints = Number(stats.total_complaints);
  const violationsPerBuilding = buildingCount > 0 ? totalViolations / buildingCount : 0;
  const complaintsPerBuilding = buildingCount > 0 ? totalComplaints / buildingCount : 0;

  const safetyScore = crime
    ? getSubGrade(crime.violent / Math.max(buildingCount, 1), [0.5, 2, 5, 10])
    : 2.5;
  const maintenanceScore = getSubGrade(violationsPerBuilding, [1, 3, 8, 20]);
  const responsivenessScore = getSubGrade(complaintsPerBuilding, [0.5, 2, 5, 15]);

  const overallScore = avgScore !== null
    ? avgScore
    : (safetyScore + maintenanceScore + responsivenessScore) / 3;

  const borough = crime?.borough || "";

  const subGrades = [
    { label: "Building Quality", score: avgScore || 2.5, description: "Average building score" },
    { label: "Safety", score: safetyScore, description: "Based on violent crime rate" },
    { label: "Maintenance", score: maintenanceScore, description: "Violations per building" },
    { label: "Responsiveness", score: responsivenessScore, description: "Complaints per building" },
  ];

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Place",
        name: neighborhoodName
          ? `${neighborhoodName}, ${CITY_META[city].name} (${zipCode})`
          : `${CITY_META[city].name} Neighborhood ${zipCode}`,
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
        { name: "Neighborhoods", url: neighborhoodsUrl(city) },
        { name: neighborhoodName || zipCode, url: neighborhoodUrl(zipCode) },
      ])} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Neighborhoods", href: cityPath("/neighborhoods", city) },
        { label: neighborhoodName || zipCode, href: neighborhoodUrl(zipCode) },
      ]} />

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <LetterGrade score={overallScore} size="lg" showScore />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            {neighborhoodName
              ? `${neighborhoodName} Report Card`
              : `Neighborhood Report Card: ${zipCode}`}
          </h1>
          <p className="text-[#64748b] mt-1">
            {neighborhoodName && `${zipCode} · `}{borough && `${borough} · `}{buildingCount.toLocaleString()} buildings tracked
          </p>
        </div>
      </div>

      {/* Sub-Grades */}
      <div id="grades" className="scroll-mt-28 grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {subGrades.map((g) => {
          const grade = getLetterGrade(g.score);
          const color = getGradeColor(grade);
          return (
            <div key={g.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold text-white mx-auto mb-2"
                style={{ backgroundColor: color }}
              >
                {grade}
              </div>
              <p className="text-sm font-semibold text-[#0F1D2E]">{g.label}</p>
              <p className="text-xs text-[#94a3b8] mt-0.5">{g.description}</p>
            </div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div id="stats" className="scroll-mt-28 grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-[#3B82F6]" />
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Buildings</p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{buildingCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Violations</p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{totalViolations.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Complaints</p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{totalComplaints.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#3B82F6]" />
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Reviews</p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{Number(stats.total_reviews).toLocaleString()}</p>
        </div>
      </div>

    </div>
    {/* Full-bleed section nav */}
    <NeighborhoodSectionNav />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* Percentile Rankings */}
      <div id="rankings" className="scroll-mt-28">
        <NeighborhoodRankCard zipCode={zipCode} stats={stats} crimeData={crime} />
      </div>

      {/* Crime Summary */}
      {crime && crime.total > 0 && (
        <div id="crime" className="scroll-mt-28 bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Siren className="w-5 h-5 text-[#DC2626]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">Crime Summary (12 Months)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-[#0F1D2E]">{crime.total.toLocaleString()}</p>
              <p className="text-xs text-[#94a3b8]">Total Incidents</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#EF4444]">{crime.violent.toLocaleString()}</p>
              <p className="text-xs text-[#94a3b8]">Violent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#F59E0B]">{crime.property.toLocaleString()}</p>
              <p className="text-xs text-[#94a3b8]">Property</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#3B82F6]">{crime.quality_of_life.toLocaleString()}</p>
              <p className="text-xs text-[#94a3b8]">Quality of Life</p>
            </div>
          </div>
          <Link
            href={cityPath(`/crime/${zipCode}`, city)}
            className="inline-flex items-center gap-1 text-sm text-[#3B82F6] font-medium mt-4"
          >
            View detailed crime data
          </Link>
        </div>
      )}

      {/* Neighborhood Pulse */}
      <div id="pulse" className="scroll-mt-28">
        <NeighborhoodPulse
          zipCode={zipCode}
          crimeTotal={crime?.total ?? null}
          violationCount={totalViolations}
          complaintCount={totalComplaints}
          reviewCount={Number(stats.total_reviews)}
          buildingCount={buildingCount}
        />
      </div>

      {/* Rent Trends */}
      {rents.length > 0 && (
        <div id="rent-trends" className="scroll-mt-28 mb-8">
          <NeighborhoodRentChart rents={rents} />
        </div>
      )}

      {/* Top Landlords */}
      <NeighborhoodTopLandlords
        city={city}
        landlords={topLandlords}
        neighborhoodName={neighborhoodName || zipCode}
      />

      {/* Best Apartments by Price Tier */}
      {(() => {
        const tiers = [
          { label: "$2,000", max: 2000, buildings: [] as typeof bestBuildings },
          { label: "$3,000", max: 3000, buildings: [] as typeof bestBuildings },
          { label: "$4,000", max: 4000, buildings: [] as typeof bestBuildings },
          { label: "$5,000", max: 5000, buildings: [] as typeof bestBuildings },
        ];
        for (const b of bestBuildings) {
          const rent = Number(b.median_rent);
          for (const tier of tiers) {
            if (rent <= tier.max) {
              if (tier.buildings.length < 5) {
                tier.buildings.push({
                  ...b,
                  buildingUrl: buildingUrl(b, city),
                });
              }
              break;
            }
          }
        }
        return (
          <div id="best-apartments" className="scroll-mt-28 mb-8">
            <BestApartments
              tiers={tiers}
              areaName={neighborhoodName || zipCode}
            />
          </div>
        );
      })()}

      <div id="flagged-buildings" className="scroll-mt-28 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Buildings */}
        {buildings.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">Most Flagged Buildings</h2>
            <div className="space-y-2">
              {buildings.map((b: { id: string; full_address: string; borough: string; slug: string; overall_score: number | null; violation_count: number; complaint_count: number; review_count: number }) => (
                <Link key={b.id} href={buildingUrl(b, city)}>
                  <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:border-[#3B82F6] transition-colors flex items-center gap-3">
                    <LetterGrade score={b.overall_score} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F1D2E] truncate">{b.full_address}</p>
                      <div className="flex items-center gap-3 text-xs text-[#94a3b8] mt-0.5">
                        <span className="text-[#EF4444] font-medium">{(b.violation_count || 0).toLocaleString()} violations</span>
                        <span>{(b.complaint_count || 0).toLocaleString()} complaints</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Top Landlord */}
        {stats.top_landlord && (
          <div>
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">Largest Landlord</h2>
            <Link href={landlordUrl(stats.top_landlord)}>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 hover:border-[#3B82F6] transition-colors">
                <p className="text-lg font-semibold text-[#0F1D2E]">{stats.top_landlord}</p>
                <p className="text-sm text-[#64748b] mt-1">
                  {Number(stats.top_landlord_buildings)} buildings in this zip code
                </p>
                <p className="text-sm text-[#3B82F6] font-medium mt-3">View landlord portfolio</p>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Walkability & Transit */}
      <div id="walkability" className="scroll-mt-28">
        <Suspense fallback={<div className="h-48 bg-white rounded-xl border border-[#e2e8f0] animate-pulse mb-8 mt-8" />}>
          <WalkabilitySection zipCode={zipCode} city={city} />
        </Suspense>
      </div>

      {/* Demographics */}
      <div id="demographics" className="scroll-mt-28">
        <Suspense fallback={null}>
          <DemographicSnapshot zipCode={zipCode} />
        </Suspense>
      </div>

      {/* Vibe Check */}
      {(() => {
        const vibe = getNeighborhoodVibe(city, zipCode);
        return vibe ? (
          <div id="vibe-check" className="scroll-mt-28">
            <VibeCheck vibe={vibe} neighborhoodName={neighborhoodName || zipCode} />
          </div>
        ) : null;
      })()}

      {/* Compare */}
      <div id="compare" className="scroll-mt-28 mb-8">
        <CompareButton
          neighborhoodName={neighborhoodName || zipCode}
          zipCode={zipCode}
          compareUrl={cityPath("/neighborhoods/compare", city)}
        />
      </div>

      <div id="faq" className="scroll-mt-28">
        <FAQSection
          items={generateNeighborhoodFAQ({
            displayName: neighborhoodName ? `${neighborhoodName} (${zipCode})` : zipCode,
            zipCode,
            stats,
            crime,
            subGrades,
            cityName: CITY_META[city].name,
          })}
          title={`Frequently Asked Questions About ${neighborhoodName || zipCode}`}
        />
      </div>

      {/* Related Neighborhoods */}
      <div id="related" className="scroll-mt-28">
        <Suspense fallback={<div className="h-32 bg-white rounded-xl border border-[#e2e8f0] animate-pulse mt-8" />}>
          <RelatedNeighborhoods
            currentZip={zipCode}
            currentRegion={borough}
            currentScore={avgScore}
            city={city}
          />
        </Suspense>
      </div>
    </div>
    </AdSidebar>
  );
}
