import { createClient } from "@/lib/supabase/server";
import { Users, Building2, Search, ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, ArrowRight, Scale, HardHat } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landlord Directory | Lucid Rents",
  description:
    "Search and explore NYC landlords. View violation counts, complaint histories, and building portfolios for property owners across New York City.",
  alternates: { canonical: canonicalUrl(cityPath("/landlords")) },
  openGraph: {
    title: "NYC Landlord Directory",
    description: "Explore NYC landlords by violations, complaints, and building portfolios.",
    url: canonicalUrl(cityPath("/landlords")),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export const revalidate = 3600;

interface LandlordData {
  name: string;
  buildingCount: number;
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  avgScore: number | null;
  worstBuilding: {
    id: string;
    address: string;
    violations: number;
  };
}

interface LandlordsPageProps {
  searchParams: Promise<{ search?: string; sort?: string; page?: string }>;
}

export default async function LandlordsPage({ searchParams }: LandlordsPageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const sortBy = params.sort || "violations";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;

  const supabase = await createClient();

  // Query buildings with owner_name that have violations or complaints
  let query = supabase
    .from("buildings")
    .select("id, full_address, borough, owner_name, violation_count, complaint_count, litigation_count, dob_violation_count, overall_score")
    .not("owner_name", "is", null)
    .or("violation_count.gt.0,complaint_count.gt.0");

  if (search) {
    query = query.ilike("owner_name", `%${search}%`);
  }

  const { data: buildings } = await query;

  // Aggregate by owner_name
  const landlordMap = new Map<string, LandlordData & { _scores: number[] }>();

  for (const building of buildings || []) {
    const name = building.owner_name as string;
    if (!name) continue;

    const existing = landlordMap.get(name);
    if (existing) {
      existing.buildingCount++;
      existing.totalViolations += building.violation_count || 0;
      existing.totalComplaints += building.complaint_count || 0;
      existing.totalLitigations += building.litigation_count || 0;
      existing.totalDobViolations += building.dob_violation_count || 0;
      if (building.overall_score !== null) {
        existing._scores.push(building.overall_score);
        existing.avgScore =
          existing._scores.reduce((a: number, b: number) => a + b, 0) / existing._scores.length;
      }
      if ((building.violation_count || 0) > existing.worstBuilding.violations) {
        existing.worstBuilding = {
          id: building.id,
          address: building.full_address,
          violations: building.violation_count || 0,
        };
      }
    } else {
      landlordMap.set(name, {
        name,
        buildingCount: 1,
        totalViolations: building.violation_count || 0,
        totalComplaints: building.complaint_count || 0,
        totalLitigations: building.litigation_count || 0,
        totalDobViolations: building.dob_violation_count || 0,
        avgScore: building.overall_score,
        worstBuilding: {
          id: building.id,
          address: building.full_address,
          violations: building.violation_count || 0,
        },
        _scores: building.overall_score !== null ? [building.overall_score] : [],
      });
    }
  }

  // Convert, sort, paginate
  let landlords: LandlordData[] = Array.from(landlordMap.values()).map(
    ({ _scores, ...rest }) => {
      void _scores;
      return rest;
    }
  );

  if (sortBy === "violations") {
    landlords.sort((a, b) => b.totalViolations - a.totalViolations);
  } else if (sortBy === "complaints") {
    landlords.sort((a, b) => b.totalComplaints - a.totalComplaints);
  } else if (sortBy === "litigations") {
    landlords.sort((a, b) => b.totalLitigations - a.totalLitigations);
  } else if (sortBy === "dob") {
    landlords.sort((a, b) => b.totalDobViolations - a.totalDobViolations);
  } else if (sortBy === "buildings") {
    landlords.sort((a, b) => b.buildingCount - a.buildingCount);
  }

  const total = landlords.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedLandlords = landlords.slice(offset, offset + limit);

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = { search, sort: sortBy, page: String(page) };
    const merged = { ...base, ...overrides };
    // Remove empty values
    Object.keys(merged).forEach((key) => {
      if (!merged[key]) delete merged[key];
    });
    const qs = new URLSearchParams(merged).toString();
    return `${cityPath("/landlords")}?${qs}`;
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
          Search NYC landlords by name and explore their building portfolios, violations, and complaint histories.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <form action={cityPath("/landlords")} method="GET" className="flex gap-3">
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
              href={cityPath("/landlords")}
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
          {total > 0
            ? `${total.toLocaleString()} landlord${total !== 1 ? "s" : ""} found`
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
      {paginatedLandlords.length > 0 ? (
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
                {paginatedLandlords.map((landlord, idx) => {
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
                          href={landlordUrl(landlord.name)}
                          className="group"
                        >
                          <p className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                            {landlord.name}
                          </p>
                          <p className="text-xs text-[#94a3b8] mt-0.5">
                            Worst: {landlord.worstBuilding.address}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-[#64748b]">
                          <Building2 className="w-3.5 h-3.5" />
                          {landlord.buildingCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.totalViolations > 100
                              ? "text-[#EF4444]"
                              : landlord.totalViolations > 20
                              ? "text-[#F59E0B]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {landlord.totalViolations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.totalComplaints > 100
                              ? "text-[#EF4444]"
                              : landlord.totalComplaints > 20
                              ? "text-[#F59E0B]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {landlord.totalComplaints.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.totalLitigations > 10
                              ? "text-[#8B5CF6]"
                              : landlord.totalLitigations > 0
                              ? "text-[#8B5CF6]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <Scale className="w-3.5 h-3.5" />
                          {landlord.totalLitigations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-semibold ${
                            landlord.totalDobViolations > 50
                              ? "text-[#EF4444]"
                              : landlord.totalDobViolations > 10
                              ? "text-[#3B82F6]"
                              : "text-[#64748b]"
                          }`}
                        >
                          <HardHat className="w-3.5 h-3.5" />
                          {landlord.totalDobViolations.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="flex justify-center">
                          <LetterGrade score={landlord.avgScore} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <Link
                          href={landlordUrl(landlord.name)}
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
              href={cityPath("/landlords")}
              className="inline-flex items-center gap-2 mt-4 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
            >
              Clear search and view all
            </Link>
          )}
        </div>
      )}

      <AdBlock adSlot="LANDLORDS_BOTTOM" adFormat="horizontal" />
    </div>
    </AdSidebar>
  );
}
