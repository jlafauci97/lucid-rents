import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, MapPin } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getLetterGrade, normalizeScore } from "@/lib/constants";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { neighborhoodUrl, canonicalUrl, cityPath, neighborhoodsUrl, breadcrumbJsonLd } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const { a, b } = await searchParams;
  const meta = CITY_META[city as City];
  if (!meta) return {};
  const nameA = a ? getNeighborhoodNameByCity(a, city as City) || a : null;
  const nameB = b ? getNeighborhoodNameByCity(b, city as City) || b : null;
  const title = nameA && nameB
    ? `${nameA} vs ${nameB} — Neighborhood Comparison | ${meta.name}`
    : `Compare ${meta.name} Neighborhoods | Lucid Rents`;
  return {
    title,
    description: `Compare ${meta.name} neighborhoods side by side. See which area has better grades, fewer violations, and safer streets.`,
    alternates: { canonical: canonicalUrl(cityPath("/neighborhoods/compare", city as City)) },
  };
}

interface NeighborhoodStatRow {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_reviews: number;
}

interface CrimeZipRow {
  zip_code: string;
  total: number;
  violent: number;
  property: number;
}

async function fetchStats(zipCode: string): Promise<NeighborhoodStatRow | null> {
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
  return Array.isArray(data) ? data[0] || null : data;
}

async function fetchCrime(zipCode: string): Promise<CrimeZipRow | null> {
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
}

function StatComparison({
  label,
  valueA,
  valueB,
  formatFn = (v: number) => v.toLocaleString(),
  lowerIsBetter = false,
}: {
  label: string;
  valueA: number | null;
  valueB: number | null;
  formatFn?: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const a = valueA ?? 0;
  const b = valueB ?? 0;
  const aWins = lowerIsBetter ? a < b : a > b;
  const bWins = lowerIsBetter ? b < a : b > a;
  const tie = a === b;

  return (
    <div className="grid grid-cols-3 items-center py-3 border-b border-[#f1f5f9] last:border-b-0">
      <div className={`text-right font-semibold ${aWins && !tie ? "text-[#10B981]" : "text-[#0F1D2E]"}`}>
        {valueA !== null ? formatFn(valueA) : "N/A"}
      </div>
      <div className="text-center text-xs text-[#94a3b8] font-medium uppercase tracking-wide px-2">
        {label}
      </div>
      <div className={`text-left font-semibold ${bWins && !tie ? "text-[#10B981]" : "text-[#0F1D2E]"}`}>
        {valueB !== null ? formatFn(valueB) : "N/A"}
      </div>
    </div>
  );
}

export default async function CompareNeighborhoodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { city: cityParam } = await params;
  const { a: zipA, b: zipB } = await searchParams;
  const city = cityParam as City;
  const meta = CITY_META[city];
  if (!meta) return null;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta.name, href: cityPath("", city) },
    { label: "Neighborhoods", href: cityPath("/neighborhoods", city) },
    { label: "Compare", href: cityPath("/neighborhoods/compare", city) },
  ];

  // Empty state: no params selected
  if (!zipA || !zipB) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <JsonLd data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: meta.name, url: cityPath("", city) },
          { name: "Neighborhoods", url: neighborhoodsUrl(city) },
          { name: "Compare", url: cityPath("/neighborhoods/compare", city) },
        ])} />
        <Breadcrumbs items={breadcrumbs} />
        <ArrowLeftRight className="w-12 h-12 text-[#94a3b8] mx-auto mb-4 mt-8" />
        <h1 className="text-2xl font-bold text-[#0F1D2E] mb-2">
          Compare {meta.name} Neighborhoods
        </h1>
        <p className="text-[#64748b] mb-6">
          Select two neighborhoods to compare them side by side.
        </p>
        <Link
          href={cityPath("/neighborhoods", city)}
          className="inline-flex items-center gap-2 text-[#3B82F6] font-medium hover:underline"
        >
          <MapPin className="w-4 h-4" />
          Browse all neighborhoods
        </Link>
      </div>
    );
  }

  const [statsA, statsB, crimeA, crimeB] = await Promise.all([
    fetchStats(zipA),
    fetchStats(zipB),
    fetchCrime(zipA),
    fetchCrime(zipB),
  ]);

  const nameA = getNeighborhoodNameByCity(zipA, city) || zipA;
  const nameB = getNeighborhoodNameByCity(zipB, city) || zipB;

  const scoreA = statsA?.avg_score ? Number(statsA.avg_score) : null;
  const scoreB = statsB?.avg_score ? Number(statsB.avg_score) : null;
  const buildingsA = statsA ? Number(statsA.building_count) : 0;
  const buildingsB = statsB ? Number(statsB.building_count) : 0;
  const violationsA = statsA ? Number(statsA.total_violations) : 0;
  const violationsB = statsB ? Number(statsB.total_violations) : 0;
  const complaintsA = statsA ? Number(statsA.total_complaints) : 0;
  const complaintsB = statsB ? Number(statsB.total_complaints) : 0;
  const reviewsA = statsA ? Number(statsA.total_reviews) : 0;
  const reviewsB = statsB ? Number(statsB.total_reviews) : 0;
  const vPerBuildingA = buildingsA > 0 ? violationsA / buildingsA : 0;
  const vPerBuildingB = buildingsB > 0 ? violationsB / buildingsB : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: meta.name, url: cityPath("", city) },
        { name: "Neighborhoods", url: neighborhoodsUrl(city) },
        { name: "Compare", url: cityPath("/neighborhoods/compare", city) },
      ])} />
      <Breadcrumbs items={breadcrumbs} />

      <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] text-center mb-8">
        {nameA} vs {nameB}
      </h1>

      {/* Side-by-side header cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href={neighborhoodUrl(zipA, city)}>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center hover:border-[#3B82F6] transition-colors">
            <LetterGrade score={scoreA} size="lg" />
            <h2 className="text-lg font-bold text-[#0F1D2E] mt-3">{nameA}</h2>
            <p className="text-sm text-[#94a3b8]">{zipA}</p>
            {scoreA !== null && (
              <p className="text-xs text-[#64748b] mt-1">{normalizeScore(scoreA).toFixed(1)} / 5</p>
            )}
          </div>
        </Link>
        <Link href={neighborhoodUrl(zipB, city)}>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center hover:border-[#3B82F6] transition-colors">
            <LetterGrade score={scoreB} size="lg" />
            <h2 className="text-lg font-bold text-[#0F1D2E] mt-3">{nameB}</h2>
            <p className="text-sm text-[#94a3b8]">{zipB}</p>
            {scoreB !== null && (
              <p className="text-xs text-[#64748b] mt-1">{normalizeScore(scoreB).toFixed(1)} / 5</p>
            )}
          </div>
        </Link>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
        <StatComparison
          label="Overall Grade"
          valueA={scoreA}
          valueB={scoreB}
          formatFn={(v) => getLetterGrade(v)}
        />
        <StatComparison
          label="Buildings"
          valueA={buildingsA}
          valueB={buildingsB}
        />
        <StatComparison
          label="Safety"
          valueA={crimeA ? crimeA.violent : null}
          valueB={crimeB ? crimeB.violent : null}
          lowerIsBetter
          formatFn={(v) => `${v.toLocaleString()} violent`}
        />
        <StatComparison
          label="Violations"
          valueA={violationsA}
          valueB={violationsB}
          lowerIsBetter
        />
        <StatComparison
          label="Viol./Building"
          valueA={vPerBuildingA}
          valueB={vPerBuildingB}
          lowerIsBetter
          formatFn={(v) => v.toFixed(1)}
        />
        <StatComparison
          label="Complaints"
          valueA={complaintsA}
          valueB={complaintsB}
          lowerIsBetter
        />
        <StatComparison
          label="Reviews"
          valueA={reviewsA}
          valueB={reviewsB}
        />
        <StatComparison
          label="Total Crime"
          valueA={crimeA?.total ?? null}
          valueB={crimeB?.total ?? null}
          lowerIsBetter
        />
        <StatComparison
          label="Violent Crime"
          valueA={crimeA?.violent ?? null}
          valueB={crimeB?.violent ?? null}
          lowerIsBetter
        />
        <StatComparison
          label="Property Crime"
          valueA={crimeA?.property ?? null}
          valueB={crimeB?.property ?? null}
          lowerIsBetter
        />
      </div>

      {/* Links */}
      <div className="flex items-center justify-center gap-6 mt-8">
        <Link
          href={neighborhoodUrl(zipA, city)}
          className="text-[#3B82F6] font-medium hover:underline text-sm"
        >
          View {nameA} report card
        </Link>
        <span className="text-[#e2e8f0]">|</span>
        <Link
          href={neighborhoodUrl(zipB, city)}
          className="text-[#3B82F6] font-medium hover:underline text-sm"
        >
          View {nameB} report card
        </Link>
      </div>
    </div>
  );
}
