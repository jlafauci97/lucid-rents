import { createClient } from "@/lib/supabase/server";
import { Users, Building2, Search, ChevronLeft, ChevronRight, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import type { Metadata } from "next";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ city: string }>; searchParams: Promise<{ search?: string; sort?: string; page?: string }> }): Promise<Metadata> {
  const { city } = await params;
  const { page: pageStr } = await searchParams;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const page = parseInt(pageStr || "1", 10);
  const url = canonicalUrl(cityPath("/landlords", city));

  return {
    title: `Landlord Directory${page > 1 ? ` — Page ${page}` : ""} | ${meta.fullName}`,
    description: `Look up any ${meta.fullName} landlord. See their full portfolio, violation history, and complaint record before you rent from them.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.fullName} Landlord Directory`,
      description: `Look up any ${meta.fullName} landlord — see their portfolio, violations, and complaint history.`,
      url,
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

  // Pagination rel links for SEO
  const basePath = cityPath("/landlords", cityParam as City);
  const qsParts: string[] = [];
  if (search) qsParts.push(`search=${encodeURIComponent(search)}`);
  if (sortBy !== "violations") qsParts.push(`sort=${sortBy}`);
  const qsBase = qsParts.length ? `${qsParts.join("&")}` : "";
  const paginationPrevUrl = page > 1
    ? canonicalUrl(`${basePath}?${qsBase ? qsBase + "&" : ""}${page === 2 ? "" : `page=${page - 1}`}`.replace(/[?&]$/, ""))
    : null;
  const paginationNextUrl = page < totalPages
    ? canonicalUrl(`${basePath}?${qsBase ? qsBase + "&" : ""}page=${page + 1}`)
    : null;

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
      {paginationPrevUrl && <link rel="prev" href={paginationPrevUrl} />}
      {paginationNextUrl && <link rel="next" href={paginationNextUrl} />}
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex-shrink-0 mt-1 h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#0F1D2E] leading-tight">
            Landlord Directory
          </h1>
          <p className="text-[#64748b] mt-1.5 max-w-2xl">
            Search {CITY_META[cityParam as City]?.fullName || "NYC"} landlords by name and explore their building portfolios, violations, and complaint histories.
          </p>
        </div>
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
        <p className="text-sm text-[#64748b]">
          {(total || 0) > 0
            ? `${(total || 0).toLocaleString()} landlord${(total || 0) !== 1 ? "s" : ""} found`
            : "No landlords found"}
          {search && ` matching "${search}"`}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-[#94a3b8] mr-2 hidden sm:inline">Sort by</span>
          <div className="inline-flex bg-slate-100 rounded-lg p-1 flex-wrap gap-0.5">
            {[
              { key: "violations", label: "Violations" },
              { key: "complaints", label: "Complaints" },
              { key: "litigations", label: "Litigations" },
              { key: "dob", label: "DOB" },
              { key: "buildings", label: "Buildings" },
            ].map((opt) => (
              <Link
                key={opt.key}
                href={buildUrl({ sort: opt.key, page: "1" })}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortBy === opt.key
                    ? "bg-white text-[#0F1D2E] shadow-sm font-semibold"
                    : "text-[#64748b] hover:text-[#0F1D2E]"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Landlords table */}
      {(landlords || []).length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 w-12">
                    #
                  </th>
                  <th className="text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3">
                    Landlord
                  </th>
                  <th className="text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 w-24">
                    Buildings
                  </th>
                  <th className={`text-right text-xs font-semibold uppercase tracking-wider px-4 py-3 w-24 ${sortBy === "violations" ? "text-[#0F1D2E]" : "text-[#64748b]"}`}>
                    Violations
                  </th>
                  <th className={`text-right text-xs font-semibold uppercase tracking-wider px-4 py-3 w-24 hidden sm:table-cell ${sortBy === "complaints" ? "text-[#0F1D2E]" : "text-[#64748b]"}`}>
                    Complaints
                  </th>
                  <th className={`text-right text-xs font-semibold uppercase tracking-wider px-4 py-3 w-24 hidden md:table-cell ${sortBy === "litigations" ? "text-[#0F1D2E]" : "text-[#64748b]"}`}>
                    Litigations
                  </th>
                  <th className={`text-right text-xs font-semibold uppercase tracking-wider px-4 py-3 w-28 hidden md:table-cell ${sortBy === "dob" ? "text-[#0F1D2E]" : "text-[#64748b]"}`}>
                    DOB
                  </th>
                  <th className="text-center text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3 w-20 hidden lg:table-cell">
                    Grade
                  </th>
                  <th className="px-4 py-3 w-12 hidden lg:table-cell">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {(landlords || []).map((landlord, idx) => {
                  const rank = offset + idx + 1;
                  const cellBase = "px-4 py-3 text-right text-sm tabular-nums";
                  return (
                    <tr
                      key={landlord.name}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#94a3b8] tabular-nums">
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={landlordUrl(landlord.name, cityParam as City)}
                          className="group block"
                        >
                          <p className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                            {landlord.name}
                          </p>
                          {landlord.worst_building_address && (
                            <p className="text-xs text-[#94a3b8] mt-0.5 truncate max-w-md">
                              Worst: {landlord.worst_building_address}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className={`${cellBase} text-[#64748b]`}>
                        {landlord.building_count.toLocaleString()}
                      </td>
                      <td className={`${cellBase} ${sortBy === "violations" ? "text-[#0F1D2E] font-semibold" : "text-[#64748b]"}`}>
                        {landlord.total_violations.toLocaleString()}
                      </td>
                      <td className={`${cellBase} hidden sm:table-cell ${sortBy === "complaints" ? "text-[#0F1D2E] font-semibold" : "text-[#64748b]"}`}>
                        {landlord.total_complaints.toLocaleString()}
                      </td>
                      <td className={`${cellBase} hidden md:table-cell ${sortBy === "litigations" ? "text-[#0F1D2E] font-semibold" : "text-[#64748b]"}`}>
                        {landlord.total_litigations.toLocaleString()}
                      </td>
                      <td className={`${cellBase} hidden md:table-cell ${sortBy === "dob" ? "text-[#0F1D2E] font-semibold" : "text-[#64748b]"}`}>
                        {landlord.total_dob_violations.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex justify-center">
                          <LetterGrade score={landlord.avg_score} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <Link
                          href={landlordUrl(landlord.name, cityParam as City)}
                          className="inline-flex items-center text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                          aria-label={`View ${landlord.name} portfolio`}
                        >
                          <ArrowRight className="w-4 h-4" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e2e8f0] bg-slate-50">
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

      {/* Cross-links */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b] mb-3">Related</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={cityPath("/worst-rated-buildings", cityParam as City)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-[#94a3b8]" />
            Worst Rated Buildings
          </Link>
          <Link
            href={cityPath("/buildings", cityParam as City)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
          >
            <Building2 className="w-4 h-4 text-[#94a3b8]" />
            Buildings Directory
          </Link>
          <Link
            href={cityPath("/crime", cityParam as City)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-[#94a3b8]" />
            Crime by Zip Code
          </Link>
        </div>
      </section>
    </div>
    </AdSidebar>
  );
}
