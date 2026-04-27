import { createClient } from "@/lib/supabase/server";
import { Search, ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, Building2, ShieldAlert, Trophy } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ search?: string; sort?: string; page?: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const { page: pageStr } = await searchParams;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const page = parseInt(pageStr || "1", 10);
  const url = canonicalUrl(cityPath("/landlords", city));
  return {
    title: `Landlord Directory${page > 1 ? ` — Page ${page}` : ""} | ${meta.fullName}`,
    description: `Look up any ${meta.fullName} landlord. See their full portfolio, violation history, and complaint record before you rent.`,
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

const SORT_OPTIONS = [
  { key: "violations", label: "Violations", col: "total_violations" },
  { key: "complaints", label: "Complaints", col: "total_complaints" },
  { key: "litigations", label: "Litigations", col: "total_litigations" },
  { key: "dob", label: "DOB", col: "total_dob_violations" },
  { key: "buildings", label: "Buildings", col: "building_count" },
] as const;

interface Props {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ search?: string; sort?: string; page?: string }>;
}

export default async function LandlordsPage({ params: routeParams, searchParams }: Props) {
  const { city: cityParam } = await routeParams;
  const params = await searchParams;
  const search = params.search || "";
  const sortBy = params.sort || "violations";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  if (!isValidCity(cityParam)) return null;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const sortOption = SORT_OPTIONS.find((o) => o.key === sortBy) ?? SORT_OPTIONS[0];
  const sortCol = sortOption.col;
  const supabase = await createClient();

  // Count + page in parallel.
  let countQuery = supabase
    .from("landlord_stats")
    .select("id", { count: "exact", head: true })
    .eq("metro", city);
  let dataQuery = supabase
    .from("landlord_stats")
    .select(
      "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations"
    )
    .eq("metro", city)
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  // Lightweight count of buildings in the metro for the hero meta line —
  // PostgREST count-header trick (same pattern as LiveStats / homepage).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  async function getBuildingsCount(): Promise<number | null> {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/buildings?select=id&metro=eq.${encodeURIComponent(city)}`,
        {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Prefer: "count=exact", Range: "0-0" },
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) return null;
      const range = res.headers.get("content-range") || "";
      const m = range.match(/\/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  }

  const [{ count: total }, { data: landlords }, buildingsCount] = await Promise.all([
    countQuery,
    dataQuery,
    getBuildingsCount(),
  ]);
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const rows = landlords ?? [];

  // SEO rel links
  const basePath = cityPath("/landlords", city);
  const baseQs: string[] = [];
  if (search) baseQs.push(`search=${encodeURIComponent(search)}`);
  if (sortBy !== "violations") baseQs.push(`sort=${sortBy}`);
  const qsHead = baseQs.length ? baseQs.join("&") : "";
  const prevHref =
    page > 1
      ? canonicalUrl(
          `${basePath}?${qsHead ? qsHead + "&" : ""}${page === 2 ? "" : `page=${page - 1}`}`.replace(/[?&]$/, "")
        )
      : null;
  const nextHref =
    page < totalPages ? canonicalUrl(`${basePath}?${qsHead ? qsHead + "&" : ""}page=${page + 1}`) : null;

  function url(overrides: Record<string, string>) {
    const merged: Record<string, string> = { search, sort: sortBy, page: String(page), ...overrides };
    Object.keys(merged).forEach((k) => {
      if (!merged[k] || (k === "page" && merged[k] === "1") || (k === "sort" && merged[k] === "violations")) {
        delete merged[k];
      }
    });
    const qs = new URLSearchParams(merged).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function compact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  return (
    <AdSidebar>
      <div className="v2">
        <V2Zoom />
        {prevHref && <link rel="prev" href={prevHref} />}
        {nextHref && <link rel="next" href={nextHref} />}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Crumbs */}
          <nav className="crumbs">
            <Link href="/">home</Link>
            <span className="sep">/</span>
            <Link href={`/${meta.urlPrefix}`}>{meta.urlPrefix.toLowerCase()}</Link>
            <span className="sep">/</span>
            <span className="now">landlords</span>
          </nav>

          {/* Hero */}
          <header className="mt-4 mb-8 sm:mb-10">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl tracking-[-0.02em] leading-[1.02] text-[#0F1D2E] m-0"
              style={{ fontFamily: 'var(--serif)' }}
            >
              All landlords in {meta.fullName}.
            </h1>
            <p
              className="mt-4 text-[12px] uppercase tracking-[0.06em] text-[#52606d] flex flex-wrap gap-x-3 gap-y-1 items-center"
              style={{ fontFamily: 'var(--mono)' }}
            >
              <span>{(total ?? 0).toLocaleString()} indexed</span>
              <span className="opacity-30">·</span>
              <span>{buildingsCount ? `${compact(buildingsCount)} buildings tracked` : `${meta.fullName} portfolio`}</span>
              <span className="opacity-30">·</span>
              <span>sorted by {sortOption.label.toLowerCase()}, worst first</span>
              <span className="opacity-30">·</span>
              <span>page {page} of {totalPages.toLocaleString()}</span>
            </p>
            <p className="mt-5 text-base sm:text-lg text-[#475569] max-w-3xl leading-relaxed">
              Search any {meta.fullName} landlord by name. Click through to see their full portfolio,
              violation history, complaint record, and the worst building in their book.
            </p>
          </header>

          {/* Filter bar — search + sort */}
          <section className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-end">
            <form action={basePath} method="GET" className="flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder={`Search ${meta.name} landlords by name…`}
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  style={{ fontFamily: 'var(--sans)' }}
                />
              </div>
              <input type="hidden" name="sort" value={sortBy} />
              <button
                type="submit"
                className="px-4 py-2.5 text-sm font-semibold bg-[#0F1D2E] text-white rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                Search
              </button>
              {search && (
                <Link
                  href={basePath}
                  className="px-4 py-2.5 text-sm text-[#475569] border border-[#e2e8f0] rounded-lg hover:bg-slate-50 transition-colors flex items-center"
                >
                  Clear
                </Link>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-[11px] uppercase tracking-[0.08em] text-[#94a3b8] mr-2 hidden sm:inline"
                style={{ fontFamily: 'var(--mono)' }}
              >
                Sort by
              </span>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={url({ sort: opt.key, page: "1" })}
                    className={
                      active
                        ? "px-3 py-1.5 text-[12px] font-semibold rounded-full bg-[#0F1D2E] text-white"
                        : "px-3 py-1.5 text-[12px] font-medium rounded-full bg-white text-[#475569] border border-[#e2e8f0] hover:border-[#3B82F6] hover:text-[#0F1D2E] transition-colors"
                    }
                    style={{ fontFamily: 'var(--mono)' }}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Result summary line */}
          <p
            className="mb-4 text-[11px] uppercase tracking-[0.08em] text-[#94a3b8]"
            style={{ fontFamily: 'var(--mono)' }}
          >
            {(total ?? 0) > 0
              ? `Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + rows.length, total ?? 0).toLocaleString()} of ${(total ?? 0).toLocaleString()}${
                  search ? ` matching "${search}"` : ""
                }`
              : "No landlords found"}
          </p>

          {/* Editorial list */}
          {rows.length > 0 ? (
            <ol className="space-y-3 list-none m-0 p-0">
              {rows.map((l, idx) => {
                const rank = offset + idx + 1;
                const cells = [
                  { k: "buildings", v: l.building_count },
                  { k: "violations", v: l.total_violations },
                  { k: "complaints", v: l.total_complaints },
                  { k: "litigations", v: l.total_litigations },
                  { k: "dob", v: l.total_dob_violations },
                ];
                const activeKey = sortBy;
                return (
                  <li key={l.name}>
                    <Link
                      href={landlordUrl(l.name, city)}
                      className="group block rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0F1D2E] hover:shadow-[0_8px_24px_-12px_rgba(15,29,46,0.18)] transition-all overflow-hidden"
                    >
                      <div className="flex items-stretch gap-0">
                        {/* Rank rail */}
                        <div
                          className="flex flex-col items-center justify-center px-3 sm:px-5 py-4 bg-[#f8fafc] border-r border-[#e2e8f0] min-w-[64px] sm:min-w-[88px]"
                          style={{ fontFamily: 'var(--mono)' }}
                        >
                          <span className="text-[9px] uppercase tracking-[0.12em] text-[#94a3b8]">No.</span>
                          <span className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tabular-nums leading-none mt-1">
                            {String(rank).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0 px-4 sm:px-6 py-4 flex flex-col justify-center gap-2">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <h2
                              className="text-xl sm:text-2xl text-[#0F1D2E] m-0 leading-tight tracking-[-0.01em] group-hover:text-[#1e3a8a] transition-colors"
                              style={{ fontFamily: 'var(--serif)' }}
                            >
                              {l.name}
                            </h2>
                            <span
                              className="text-[10px] uppercase tracking-[0.1em] text-[#94a3b8]"
                              style={{ fontFamily: 'var(--mono)' }}
                            >
                              {meta.stateCode} · {meta.name}
                            </span>
                          </div>

                          {/* Stats row */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {cells.map((c) => {
                              const active = activeKey === c.k;
                              return (
                                <span key={c.k} className="inline-flex items-baseline gap-1.5">
                                  <span
                                    className={
                                      active
                                        ? "text-base sm:text-lg font-bold tabular-nums text-[#0F1D2E]"
                                        : "text-sm sm:text-base font-semibold tabular-nums text-[#475569]"
                                    }
                                  >
                                    {(c.v ?? 0).toLocaleString()}
                                  </span>
                                  <span
                                    className={
                                      active
                                        ? "text-[10px] uppercase tracking-[0.1em] text-[#0F1D2E] font-bold"
                                        : "text-[10px] uppercase tracking-[0.1em] text-[#94a3b8] font-semibold"
                                    }
                                    style={{ fontFamily: 'var(--mono)' }}
                                  >
                                    {c.k}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {/* Worst building callout */}
                          {l.worst_building_address && (
                            <p className="text-[12px] text-[#52606d] flex items-baseline gap-1.5">
                              <span
                                className="text-[10px] uppercase tracking-[0.08em] text-[#dc2626] font-semibold"
                                style={{ fontFamily: 'var(--mono)' }}
                              >
                                Worst building
                              </span>
                              <span className="opacity-30">·</span>
                              <span className="truncate">
                                {l.worst_building_address}
                                {l.worst_building_violations
                                  ? ` (${l.worst_building_violations.toLocaleString()} viol.)`
                                  : ""}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Right rail: grade + arrow */}
                        <div className="hidden sm:flex flex-col items-center justify-center px-5 py-4 border-l border-[#e2e8f0] bg-white gap-2 min-w-[100px]">
                          <LetterGrade score={l.avg_score} size="sm" />
                          <ArrowRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#0F1D2E] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center">
              <Trophy className="w-10 h-10 text-[#94a3b8] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-1.5">No landlords found</h3>
              <p className="text-sm text-[#52606d]">
                {search
                  ? `No landlords matching "${search}". Try a different search term.`
                  : "Landlord data is still being processed for this metro."}
              </p>
              {search && (
                <Link
                  href={basePath}
                  className="inline-flex items-center gap-2 mt-4 text-sm text-[#3B82F6] hover:text-[#1e3a8a] font-semibold"
                >
                  Clear search and view all
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="mt-6 flex items-center justify-between gap-3"
              style={{ fontFamily: 'var(--mono)' }}
            >
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#94a3b8]">
                Page {page} of {totalPages.toLocaleString()}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={url({ page: String(page - 1) })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] hover:bg-white text-[#475569] hover:text-[#0F1D2E] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg text-[#cbd5e1] cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </span>
                )}
                {page < totalPages ? (
                  <Link
                    href={url({ page: String(page + 1) })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] hover:bg-white text-[#475569] hover:text-[#0F1D2E] transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg text-[#cbd5e1] cursor-not-allowed">
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Related links — v2 chips */}
          <section className="mt-12 pt-8 border-t border-[#e2e8f0]">
            <p
              className="text-[11px] uppercase tracking-[0.1em] text-[#94a3b8] mb-3"
              style={{ fontFamily: 'var(--mono)' }}
            >
              Related directories
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={cityPath("/worst-rated-buildings", city)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-[#94a3b8]" />
                Worst-rated buildings
              </Link>
              <Link
                href={cityPath("/buildings", city)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] transition-colors"
              >
                <Building2 className="w-4 h-4 text-[#94a3b8]" />
                Buildings directory
              </Link>
              <Link
                href={cityPath("/crime", city)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-[#94a3b8]" />
                Crime by zip code
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AdSidebar>
  );
}
