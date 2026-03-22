import { createClient } from "@/lib/supabase/server";
import { AlertTriangle, Building2, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buildingUrl, canonicalUrl } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { getRegions, getRegionLabel } from "@/lib/constants";
import type { City } from "@/lib/cities";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Worst Rated Buildings in NYC | Lucid Rents",
  description:
    "Which NYC buildings have the most problems? See the worst-rated buildings ranked by HPD violations and 311 complaints across all five boroughs.",
  alternates: { canonical: canonicalUrl("/rankings") },
  openGraph: {
    title: "Worst Rated Buildings in NYC",
    description:
      "Which NYC buildings have the most problems? See the worst-rated buildings ranked by HPD violations and 311 complaints.",
    url: canonicalUrl("/rankings"),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export const revalidate = 3600;

interface RankingsPageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ borough?: string; sort?: string; page?: string }>;
}

export default async function RankingsPage({ params: routeParams, searchParams }: RankingsPageProps) {
  const { city: cityParam } = await routeParams;
  const city = cityParam as City;
  const regions = ["all", ...getRegions(city)];
  const regionLabel = getRegionLabel(city);
  const params = await searchParams;
  const borough = params.borough || "all";
  const sortBy = params.sort || "violations";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, slug, year_built, total_units, num_floors, owner_name, overall_score, review_count, violation_count, complaint_count"
    );

  if (borough !== "all") {
    query = query.eq("borough", borough);
  }

  if (sortBy === "violations") {
    query = query.gt("violation_count", 0).order("violation_count", { ascending: false });
  } else if (sortBy === "complaints") {
    query = query.gt("complaint_count", 0).order("complaint_count", { ascending: false });
  } else {
    query = query
      .or("violation_count.gt.0,complaint_count.gt.0")
      .order("violation_count", { ascending: false });
  }

  // Fetch one extra to detect if there's a next page
  query = query.range(offset, offset + limit);

  const { data: rawBuildings } = await query;
  const hasNextPage = (rawBuildings?.length || 0) > limit;
  const buildings = rawBuildings?.slice(0, limit) || [];

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = { borough, sort: sortBy, page: String(page) };
    const merged = { ...base, ...overrides };
    const qs = new URLSearchParams(merged).toString();
    return `/rankings?${qs}`;
  }

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0F1D2E]">
          <AlertTriangle className="inline w-8 h-8 text-[#ef4444] mr-2 -mt-1" />
          Worst Rated Buildings
        </h1>
        <p className="text-[#64748b] mt-2">
          NYC buildings ranked by the most HPD violations, 311 complaints, and reported issues.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Borough filter */}
        <div className="flex flex-wrap gap-2">
          {regions.map((b) => (
            <Link
              key={b}
              href={buildUrl({ borough: b, page: "1" })}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                borough === b
                  ? "bg-[#0F1D2E] text-white border-[#0F1D2E]"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {b === "all" ? `All ${regionLabel}s` : b}
            </Link>
          ))}
        </div>

        {/* Sort options */}
        <div className="flex gap-2 sm:ml-auto">
          {[
            { key: "violations", label: "Violations" },
            { key: "complaints", label: "Complaints" },
          ].map((opt) => (
            <Link
              key={opt.key}
              href={buildUrl({ sort: opt.key, page: "1" })}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                sortBy === opt.key
                  ? "bg-[#3B82F6] text-white border-[#3B82F6] font-medium"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              Sort by {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-[#64748b] mb-4">
        {buildings.length > 0
          ? `Showing ${offset + 1}–${offset + buildings.length} buildings`
          : "No buildings found"}
        {borough !== "all" && ` in ${borough}`}
      </p>

      {/* Rankings table */}
      {buildings && buildings.length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-[#e2e8f0]">
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 w-12">
                    #
                  </th>
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Building
                  </th>
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Owner
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Violations
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Complaints
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Units
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {buildings.map((building, idx) => {
                  const rank = offset + idx + 1;
                  return (
                    <tr key={building.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${rank <= 3 ? "text-[#ef4444]" : "text-[#94a3b8]"}`}>
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={buildingUrl(building)} className="group">
                          <p className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors truncate max-w-xs">
                            {building.full_address}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-[#64748b] mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {building.borough}
                            {building.zip_code && ` · ${building.zip_code}`}
                            {building.year_built && ` · Built ${building.year_built}`}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-[#64748b] truncate max-w-[200px]">
                          {building.owner_name || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${
                          building.violation_count > 50
                            ? "text-[#ef4444]"
                            : building.violation_count > 10
                            ? "text-[#f97316]"
                            : "text-[#64748b]"
                        }`}>
                          {building.violation_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${
                          building.complaint_count > 50
                            ? "text-[#ef4444]"
                            : building.complaint_count > 10
                            ? "text-[#f97316]"
                            : "text-[#64748b]"
                        }`}>
                          {building.complaint_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-sm text-[#64748b]">
                          {building.total_units || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(page > 1 || hasNextPage) && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e2e8f0] bg-gray-50">
              <p className="text-sm text-[#64748b]">
                Page {page}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: String(page - 1) })}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-white transition-colors text-[#64748b]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Link>
                )}
                {hasNextPage && (
                  <Link
                    href={buildUrl({ page: String(page + 1) })}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-white transition-colors text-[#64748b]"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center">
          <Building2 className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">No buildings found</h3>
          <p className="text-sm text-[#64748b]">
            Building violation data is still being imported. Check back soon.
          </p>
        </div>
      )}

      <AdBlock adSlot="RANKINGS_BOTTOM" adFormat="horizontal" />
    </div>
    </AdSidebar>
  );
}
