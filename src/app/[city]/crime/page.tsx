import { Metadata } from "next";
import Link from "next/link";
import { Siren, ArrowUpDown, MapPin } from "lucide-react";
import { canonicalUrl, cityPath, neighborhoodUrl } from "@/lib/seo";
import { getNeighborhoodName } from "@/lib/nyc-neighborhoods";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { CrimeMapSection } from "@/components/crime/CrimeMapSection";

export const metadata: Metadata = {
  title: "Crime by Zip Code | Lucid Rents",
  description:
    "Explore NYPD crime data by zip code across NYC. View violent, property, and quality of life crime breakdowns.",
  alternates: { canonical: canonicalUrl(cityPath("/crime")) },
  openGraph: {
    title: "NYC Crime Data by Zip Code",
    description: "NYPD crime data by zip code — violent, property, and quality of life crime breakdowns.",
    url: canonicalUrl(cityPath("/crime")),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export const revalidate = 3600;

async function getCrimeByZip() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error("crime_by_zip fetch error:", res.status, await res.text());
    return [];
  }
  return res.json();
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
  searchParams,
}: {
  searchParams: Promise<{ borough?: string; sort?: string; order?: string }>;
}) {
  const params = await searchParams;
  const borough = params.borough || "";
  const sortBy = params.sort || "total";
  const order = params.order || "desc";

  const data = await getCrimeByZip();

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

  const boroughs = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

  function sortUrl(col: string) {
    const newOrder = sortBy === col && order === "desc" ? "asc" : "desc";
    const base = `${cityPath("/crime")}?sort=${col}&order=${newOrder}`;
    return borough ? `${base}&borough=${encodeURIComponent(borough)}` : base;
  }

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#FEE2E2] rounded-lg">
            <Siren className="w-6 h-6 text-[#DC2626]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Crime by Zip Code
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          NYPD crime data aggregated by zip code over the last 12 months. Click a
          zip code for detailed breakdowns and trends.
        </p>
      </div>

      {/* Borough filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={cityPath("/crime")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !borough
              ? "bg-[#0F1D2E] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          }`}
        >
          All Boroughs
        </Link>
        {boroughs.map((b) => (
          <Link
            key={b}
            href={`${cityPath("/crime")}?borough=${encodeURIComponent(b)}${sortBy !== "total" ? `&sort=${sortBy}&order=${order}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              borough.toLowerCase() === b.toLowerCase()
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            {b}
          </Link>
        ))}
      </div>

      {/* Interactive Map */}
      <div className="mb-6">
        <CrimeMapSection borough={borough} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
            Zip Codes
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {rows.length}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
            Total Incidents
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {rows.reduce((s, r) => s + r.total, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
            Violent
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {rows.reduce((s, r) => s + r.violent, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide">
            Property
          </p>
          <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
            {rows.reduce((s, r) => s + r.property, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl">
          <Siren className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">No crime data available yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                    <Link href={sortUrl("zip_code")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E]">
                      Zip Code <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                    <Link href={sortUrl("borough")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E]">
                      Borough <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                    <Link href={sortUrl("total")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                      Total <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#EF4444] uppercase tracking-wide hidden md:table-cell">
                    <Link href={sortUrl("violent")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                      Violent <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#F59E0B] uppercase tracking-wide hidden md:table-cell">
                    <Link href={sortUrl("property")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                      Property <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#3B82F6] uppercase tracking-wide hidden lg:table-cell">
                    <Link href={sortUrl("quality_of_life")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                      QoL <ArrowUpDown className="w-3 h-3" />
                    </Link>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {rows.map((row) => (
                  <tr
                    key={row.zip_code}
                    className="hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={cityPath(`/crime/${row.zip_code}`)}
                        className="text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8] hover:underline"
                      >
                        {row.zip_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                      {row.borough}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E] text-right">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#EF4444] text-right hidden md:table-cell">
                      {row.violent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F59E0B] text-right hidden md:table-cell">
                      {row.property.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#3B82F6] text-right hidden lg:table-cell">
                      {row.quality_of_life.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Link
                        href={neighborhoodUrl(row.zip_code)}
                        className="inline-flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#1d4ed8] font-medium"
                        title="Neighborhood Report Card"
                      >
                        <MapPin className="w-3 h-3" />
                        {getNeighborhoodName(row.zip_code) || "Report Card"}
                      </Link>
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
