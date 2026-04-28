import { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQSection } from "@/components/seo/FAQSection";
import { NeighborhoodSearch, type NeighborhoodIndexEntry } from "@/components/neighborhood/NeighborhoodSearch";
import { getAllNeighborhoodsByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { neighborhoodUrl, canonicalUrl, cityPath, neighborhoodsUrl, breadcrumbJsonLd } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { getLetterGrade } from "@/lib/constants";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  if (!meta) return {};
  const url = canonicalUrl(neighborhoodsUrl(city as City));
  return {
    title: `${meta.name} Neighborhoods — Grades, Safety & Rent Data`,
    description: `Explore every ${meta.name} neighborhood with building grades, safety scores, and rent data. Compare neighborhoods side by side to find your ideal area.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.name} Neighborhoods — Grades, Safety & Rent Data`,
      description: `Explore every ${meta.name} neighborhood with building grades, safety scores, and rent data.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

interface NeighborhoodStatRow {
  zip_code: string;
  building_count: number;
  avg_score: number;
  total_violations: number;
}

interface CrimeZipRow {
  zip_code: string;
  total: number;
  violent: number;
}

async function fetchNeighborhoodStats(city: City): Promise<NeighborhoodStatRow[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/neighborhood_index`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_city: city }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchAllCrimeByZip(city: City): Promise<CrimeZipRow[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ metro: city }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

function computeSafetyGrade(
  zipCode: string,
  crimeMap: Map<string, CrimeZipRow>,
  statsMap: Map<string, NeighborhoodStatRow>,
  allViolentRates: number[]
): string | null {
  const crime = crimeMap.get(zipCode);
  const stat = statsMap.get(zipCode);
  if (!crime || !stat || stat.building_count === 0) return null;

  const rate = crime.violent / stat.building_count;
  const sorted = [...allViolentRates].sort((a, b) => a - b);
  const rank = sorted.findIndex((r) => r >= rate);
  const percentile = rank >= 0 ? rank / sorted.length : 1;

  if (percentile >= 0.8) return "A";
  if (percentile >= 0.6) return "B";
  if (percentile >= 0.4) return "C";
  if (percentile >= 0.2) return "D";
  return "F";
}

export default async function NeighborhoodsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  if (!meta) return null;

  const allNeighborhoods = getAllNeighborhoodsByCity(city);
  const [stats, crimeData] = await Promise.all([
    fetchNeighborhoodStats(city),
    fetchAllCrimeByZip(city),
  ]);

  const statsMap = new Map(stats.map((s) => [s.zip_code, s]));
  const crimeMap = new Map(crimeData.map((c) => [c.zip_code, c]));

  // Precompute violent crime rates for percentile ranking
  const allViolentRates: number[] = [];
  for (const s of stats) {
    const crime = crimeMap.get(s.zip_code);
    if (crime && s.building_count > 0) {
      allViolentRates.push(crime.violent / s.building_count);
    }
  }

  const neighborhoods: NeighborhoodIndexEntry[] = allNeighborhoods
    .map((n) => {
      const stat = statsMap.get(n.zipCode);
      const crime = crimeMap.get(n.zipCode);
      return {
        zipCode: n.zipCode,
        name: n.name,
        region: n.region,
        buildingCount: stat ? Number(stat.building_count) : 0,
        avgScore: stat?.avg_score ? Number(stat.avg_score) : null,
        totalViolations: stat ? Number(stat.total_violations) : 0,
        crimeTotal: crime ? Number(crime.total) : null,
        safetyGrade: computeSafetyGrade(n.zipCode, crimeMap, statsMap, allViolentRates),
        href: neighborhoodUrl(n.zipCode, city),
        rentsHref: cityPath(`/rents/${neighborhoodPageSlugByCity(n.zipCode, city)}`, city),
      };
    })
    .filter((n) => n.buildingCount > 0);

  const totalBuildings = neighborhoods.reduce((s, n) => s + n.buildingCount, 0);
  const aRated = neighborhoods.filter(
    (n) => n.avgScore !== null && getLetterGrade(n.avgScore) === "A"
  ).length;

  const regions = [...new Set(neighborhoods.map((n) => n.region).filter(Boolean))].sort();

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta.name, href: cityPath("", city) },
    { label: "Neighborhoods", href: cityPath("/neighborhoods", city) },
  ];

  const faqItems = [
    {
      question: `How many neighborhoods does Lucid Rents track in ${meta.name}?`,
      answer: `We currently track ${neighborhoods.length} neighborhoods across ${meta.name}, covering ${totalBuildings.toLocaleString()} buildings with grades, violation data, and safety scores.`,
    },
    {
      question: `How are ${meta.name} neighborhood grades calculated?`,
      answer: `Each neighborhood receives a letter grade (A-F) based on the average building score in that zip code. Building scores factor in violations, complaints, and tenant reviews.`,
    },
    {
      question: `What does the safety grade mean?`,
      answer: `Safety grades are based on the violent crime rate per building in each zip code, ranked against all other ${meta.name} neighborhoods using a percentile system. An "A" means the neighborhood is in the top 20% for safety.`,
    },
    {
      question: `Can I compare two ${meta.name} neighborhoods?`,
      answer: `Yes! Click on any neighborhood to see its full report card, then use the compare feature to view two neighborhoods side by side with stats on building quality, safety, violations, and more.`,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: meta.name, url: cityPath("", city) },
        { name: "Neighborhoods", url: neighborhoodsUrl(city) },
      ])} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${meta.name} Neighborhoods`,
        numberOfItems: neighborhoods.length,
        itemListElement: neighborhoods.slice(0, 50).map((n, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: n.name || n.zipCode,
          url: canonicalUrl(n.href),
        })),
      }} />
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#3B82F6] flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            {meta.name} Neighborhoods
          </h1>
          <p className="text-[#64748b] text-sm mt-0.5">
            Grades, safety scores & rent data for every neighborhood
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
          <p className="text-2xl font-bold text-[#0F1D2E]">{neighborhoods.length}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Neighborhoods</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
          <p className="text-2xl font-bold text-[#0F1D2E]">{totalBuildings.toLocaleString()}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Buildings Tracked</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
          <p className="text-2xl font-bold text-[#10B981]">{aRated}</p>
          <p className="text-xs text-[#94a3b8] mt-1">A-Rated</p>
        </div>
      </div>

      {/* Search & Filter */}
      <NeighborhoodSearch
        neighborhoods={neighborhoods}
        regions={regions}
        regionLabel={meta.regionLabel}
      />

      {/* FAQ */}
      <FAQSection items={faqItems} title={`${meta.name} Neighborhoods FAQ`} />
    </div>
  );
}
