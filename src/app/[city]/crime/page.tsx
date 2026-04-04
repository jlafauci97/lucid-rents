import type { Metadata } from "next";
import Link from "next/link";
import { Siren, ArrowUpDown, MapPin } from "lucide-react";
import { canonicalUrl, cityPath, neighborhoodUrl, cityBreadcrumbs } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getNeighborhoodName } from "@/lib/nyc-neighborhoods";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { CrimeMapSection } from "@/components/crime/CrimeMapSection";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Crime by Zip Code | ${meta.fullName} | Lucid Rents`,
    description: `How safe is your neighborhood? See ${meta.fullName} crime rates by zip code — violent, property, and quality-of-life breakdowns with interactive maps.`,
    alternates: { canonical: canonicalUrl(cityPath("/crime", city)) },
    openGraph: {
      title: `${meta.fullName} Crime Data by Zip Code`,
      description: `How safe is your neighborhood? ${meta.fullName} crime rates by zip code with interactive maps and breakdowns.`,
      url: canonicalUrl(cityPath("/crime", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

async function getCrimeByZip(city: string) {
  // Use 2-year lookback to ensure we capture all available data
  // (LAPD data may lag behind current date due to NIBRS transition)
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - 2);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crime_by_zip", {
      since_date: sinceDateStr,
      metro: city,
    });
    if (error) {
      console.error("crime_by_zip RPC error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("crime_by_zip fetch error:", err);
    return [];
  }
}

interface ZipCrimeRow {
  zip_code: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

export default async function CrimePage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ borough?: string; sort?: string; order?: string }>;
}) {
  const { city: cityParam } = await routeParams;
  const params = await searchParams;
  const borough = params.borough || "";
  const sortBy = params.sort || "total";
  const order = params.order || "desc";

  const data = await getCrimeByZip(cityParam);

  let rows: ZipCrimeRow[] = (data || []).map((r: ZipCrimeRow) => ({
    zip_code: r.zip_code,
    borough: r.borough || "Unknown",
    total: Number(r.total),
    violent: Number(r.violent),
    property: Number(r.property),
    quality_of_life: Number(r.quality_of_life),
  }));

  // Filter by borough
  if (borough) {
    rows = rows.filter(
      (r) => r.borough.toLowerCase() === borough.toLowerCase()
    );
  }

  // Sort
  const sortKey = sortBy as keyof ZipCrimeRow;
  rows.sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === "number" && typeof bVal === "number") {
      return order === "asc" ? aVal - bVal : bVal - aVal;
    }
    return order === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const meta = CITY_META[cityParam as City];
  const areas = meta.crimeAreas;

  function sortUrl(col: string) {
    const newOrder = sortBy === col && order === "desc" ? "asc" : "desc";
    const base = `${cityPath("/crime", cityParam as City)}?sort=${col}&order=${newOrder}`;
    return borough ? `${base}&borough=${encodeURIComponent(borough)}` : base;
  }

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={cityBreadcrumbs(cityParam as City, { label: "Crime Data", href: cityPath("/crime", cityParam as City) })} />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#FEE2E2] rounded-lg">
            <Siren className="w-6 h-6 text-[#DC2626]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
            Crime by Zip Code
          </h1>
        </div>
        <p className="text-[#5E6687] text-sm sm:text-base">
          {meta.crimeSource} crime data aggregated by zip code. Click a
          zip code for detailed breakdowns and trends.
        </p>
      </div>

      {/* Borough filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={cityPath("/crime", cityParam as City)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !borough
              ? "bg-[#0F1D2E] text-white"
              : "bg-[#F5F7FA] text-[#5E6687] hover:bg-[#e2e8f0]"
          }`}
        >
          All {meta.regionLabel}s
        </Link>
        {areas.map((area) => (
          <Link
            key={area}
            href={`${cityPath("/crime", cityParam as City)}?borough=${encodeURIComponent(area)}${sortBy !== "total" ? `&sort=${sortBy}&order=${order}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              borough.toLowerCase() === area.toLowerCase()
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#F5F7FA] text-[#5E6687] hover:bg-[#e2e8f0]"
            }`}
          >
            {area}
          </Link>
        ))}
      </div>

      {/* Interactive Map */}
      <div className="mb-6">
        <CrimeMapSection borough={borough} city={cityParam} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
            Zip Codes
          </p>
          <p className="text-2xl font-bold text-[#1A1F36] mt-1">
            {rows.length}
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
            Total Incidents
          </p>
          <p className="text-2xl font-bold text-[#1A1F36] mt-1">
            {rows.reduce((s, r) => s + r.total, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
            Violent
          </p>
          <p className="text-2xl font-bold text-[#1A1F36] mt-1">
            {rows.reduce((s, r) => s + r.violent, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide">
            Property
          </p>
          <p className="text-2xl font-bold text-[#1A1F36] mt-1">
            {rows.reduce((s, r) => s + r.property, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E2E8F0] rounded-xl">
          <Siren className="w-12 h-12 text-[#A3ACBE] mx-auto mb-3" />
          <p className="text-[#5E6687]">No crime data available yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFBFD] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide">
                    <Link href={sortUrl("zip_code")} className="inline-flex items-center gap-1 hover:text-[#1A1F36]">
                      Zip Code <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden sm:table-cell">
                    <Link href={sortUrl("borough")} className="inline-flex items-center gap-1 hover:text-[#1A1F36]">
                      {meta.regionLabel} <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide">
                    <Link href={sortUrl("total")} className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto">
                      Total <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#EF4444] uppercase tracking-wide hidden md:table-cell">
                    <Link href={sortUrl("violent")} className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto">
                      Violent <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#F59E0B] uppercase tracking-wide hidden md:table-cell">
                    <Link href={sortUrl("property")} className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto">
                      Property <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6366F1] uppercase tracking-wide hidden lg:table-cell">
                    <Link href={sortUrl("quality_of_life")} className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto">
                      QoL <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden lg:table-cell">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {rows.map((row) => (
                  <tr
                    key={row.zip_code}
                    className="hover:bg-[#FAFBFD] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={cityPath(`/crime/${row.zip_code}`, cityParam as City)}
                        className="text-sm font-semibold text-[#4F46E5] hover:text-[#1d4ed8] hover:underline"
                      >
                        {row.zip_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#1A1F36] hidden sm:table-cell">
                      {row.borough}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#1A1F36] text-right">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#EF4444] text-right hidden md:table-cell">
                      {row.violent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F59E0B] text-right hidden md:table-cell">
                      {row.property.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6366F1] text-right hidden lg:table-cell">
                      {row.quality_of_life.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(() => {
                        const name = getNeighborhoodName(row.zip_code);
                        return name ? (
                          <Link
                            href={neighborhoodUrl(row.zip_code)}
                            className="inline-flex items-center gap-1 text-xs text-[#6366F1] hover:text-[#1d4ed8] font-medium"
                            title="Neighborhood Report Card"
                          >
                            <MapPin className="w-3 h-3" />
                            {name}
                          </Link>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdBlock adSlot="CRIME_BOTTOM" adFormat="horizontal" />
    </div>
    </AdSidebar>
  );
}
