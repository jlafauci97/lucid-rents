import { createClient } from "@/lib/supabase/server";
import { Users, Building2, Search, ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, ArrowRight, Scale, HardHat, ShieldAlert } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Landlord Directory | ${meta.fullName} | Lucid Rents`,
    description: `Look up any ${meta.fullName} landlord. See their full portfolio, violation history, and complaint record before you rent from them.`,
    alternates: { canonical: canonicalUrl(cityPath("/landlords", city)) },
    openGraph: {
      title: `${meta.fullName} Landlord Directory`,
      description: `Look up any ${meta.fullName} landlord — see their portfolio, violations, and complaint history.`,
      url: canonicalUrl(cityPath("/landlords", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

interface LandlordsPageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ search?: string; sort?: string; page?: string }>;
}

export default async function LandlordsPage({ params: routeParams, searchParams }: LandlordsPageProps) {
  const { city: cityParam } = await routeParams;
  const params = await searchParams;
  const search = params.search || "";
  const sortBy = params.sort || "violations";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;

  const supabase = await createClient();

  // Determine sort column
  const sortColumns: Record<string, string> = {
    violations: "total_violations",
    complaints: "total_complaints",
    litigations: "total_litigations",
    dob: "total_dob_violations",
    buildings: "building_count",
  };
  const sortCol = sortColumns[sortBy] || "total_violations";

  // Run count + paginated data in parallel
  const offset = (page - 1) * limit;

  let countQuery = supabase
    .from("landlord_stats")
    .select("id", { count: "exact", head: true })
    .eq("metro", cityParam);
  let dataQuery = supabase
    .from("landlord_stats")
    .select("name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_id,worst_building_address,worst_building_violations")
    .eq("metro", cityParam)
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  const [{ count: total }, { data: landlords }] = await Promise.all([countQuery, dataQuery]);
  const totalPages = Math.ceil((total || 0) / limit);

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = { search, sort: sortBy, page: String(page) };
    const merged = { ...base, ...overrides };
    Object.keys(merged).forEach((key) => {
      if (!merged[key]) delete merged[key];
    });
    const qs = new URLSearchParams(merged).toString();
    return `${cityPath("/landlords", cityParam as City)}?${qs}`;
  }

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0F1D2E]">
          <Users className="inline w-8 h-8 text-[#3B82F6] mr-2 -mt-1" />
          Landlord Directory
        </h1>
        <p className="text-[#64748b] mt-2">
          Search {CITY_META[cityParam as City]?.fullName || "NYC"} landlords by name and explore their building portfolios, violations, and complaint histories.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <form action={cityPath("/landlords", cityParam as City)} method="GET" className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by landlord name..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            />
          </div>
          <input type="hidden" name="sort" value={sortBy} />
          <button
            type="submit"
            className="px-4 py-2.5 text-sm font-medium bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors"
          >
            Search
          </button>
          {search && (
            <Link
              href={cityPath("/landlords", cityParam as City)}
              className="px-4 py-2.5 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-gray-50 transition-colors flex items-center"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Sort options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-sm text-[#64748b]">
          {(total || 0) > 0
            ? `${(total || 0).toLocaleString()} landlord${(total || 0) !== 1 ? "s" : ""} found`
            : "No landlords found"}
          {search && ` matching "${search}"`}
        </p>
        <div className="flex gap-2">
          {[
            { key: "violations", label: "Most Violations" },
            { key: "complaints", label: "Most Complaints" },
            { key: "litigations", label: "Most Litigations" },
            { key: "dob", label: "Most DOB Violations" },
            { key: "buildings", label: "Most Buildings" },
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
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Landlords table */}
      {(landlords || []).length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EFF6FF] border-b border-[#e2e8f0]">
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 w-12">
                    #
                  </th>
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Landlord
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Buildings
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Violations
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Complaints
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Litigations
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    DOB Violations
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    Avg Score
                  </th>
                  <th className="text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    {/* Action */}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {(landlords || []).map((landlord, idx) => {
                  const rank = offset + idx + 1;
                  return (
                    <tr
                      key={landlord.name}
                      className="hover:bg-[#EFF6FF] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold ${
                            rank <= 3 ? "text-[#EF4444]" : "text-[#94a3b8]"
                          }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={landlordUrl(landlord.name, cityParam as City)}
                          className="group"
                        >
                          <p className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                            {landlord.name}
                          </p>
                          <p className="text-xs text-[#94a3b8] mt-0.5">
                            Worst: {landlord.worst_building_address}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-[#64748b]">
                          <Building2 className="w-3.5 h-3.5" />
                          {landlord.building_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.total_violations > 100
                              ? "text-[#EF4444]"
                              : landlord.total_violations > 20
                              ? "text-[#F59E0B]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {landlord.total_violations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.total_complaints > 100
                              ? "text-[#EF4444]"
                              : landlord.total_complaints > 20
                              ? "text-[#F59E0B]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {landlord.total_complaints.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.total_litigations > 10
                              ? "text-[#8B5CF6]"
                              : landlord.total_litigations > 0
                              ? "text-[#8B5CF6]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <Scale className="w-3.5 h-3.5" />
                          {landlord.total_litigations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.total_dob_violations > 50
                              ? "text-[#EF4444]"
                              : landlord.total_dob_violations > 10
                              ? "text-[#3B82F6]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <HardHat className="w-3.5 h-3.5" />
                          {landlord.total_dob_violations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="flex justify-center">
                          <LetterGrade score={landlord.avg_score} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <Link
                          href={landlordUrl(landlord.name, cityParam as City)}
                          className="inline-flex items-center gap-1 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
                        >
                          View Portfolio
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e2e8f0] bg-[#EFF6FF]">
              <p className="text-sm text-[#64748b]">
                Page {page} of {totalPages}
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
                {page < totalPages && (
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
          <Users className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            No landlords found
          </h3>
          <p className="text-sm text-[#64748b]">
            {search
              ? `No landlords matching "${search}". Try a different search term.`
              : "Landlord data is still being processed. Check back soon."}
          </p>
          {search && (
            <Link
              href={cityPath("/landlords", cityParam as City)}
              className="inline-flex items-center gap-2 mt-4 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
            >
              Clear search and view all
            </Link>
          )}
        </div>
      )}

      <AdBlock adSlot="LANDLORDS_BOTTOM" adFormat="horizontal" />

      {/* Cross-links */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">Related</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={cityPath("/worst-rated-buildings", cityParam as City)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-50 text-[#ef4444] border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Worst Rated Buildings
          </Link>
          <Link
            href={cityPath("/buildings", cityParam as City)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 text-[#3B82F6] border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Buildings Directory
          </Link>
          <Link
            href={cityPath("/crime", cityParam as City)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-50 text-[#d97706] border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Crime by Zip Code
          </Link>
        </div>
      </section>
    </div>
    </AdSidebar>
  );
}
