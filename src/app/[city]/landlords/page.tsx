import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, Building2, ShieldAlert, Trophy, Flame, Scale, FileWarning, BarChart3, Search } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import { LandlordSearch } from "@/components/landlord-search/LandlordSearch";
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

const RANKING_STRIPS = [
  { id: "by-violations",  label: "Most violations on record",  col: "total_violations",      icon: AlertTriangle, sort: "violations" },
  { id: "by-complaints",  label: "Most 311 complaints",         col: "total_complaints",      icon: Flame,         sort: "complaints" },
  { id: "by-litigation",  label: "Most open litigation",        col: "total_litigations",     icon: Scale,         sort: "litigations" },
  { id: "by-dob",         label: "Most DOB violations",         col: "total_dob_violations",  icon: FileWarning,   sort: "dob" },
  { id: "by-buildings",   label: "Largest portfolios",          col: "building_count",        icon: Building2,     sort: "buildings" },
] as const;

const GARBAGE_NAMES = [
  "AVAILABLE FROM DATA SOURCE",
  "NAME NOT ON FILE",
  "NOT AVAILABLE",
  "UNKNOWN",
  "N/A",
  "NA",
];
const GARBAGE_IN = `(${GARBAGE_NAMES.map((n) => `"${n}"`).join(",")})`;

interface Props {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ search?: string; sort?: string; page?: string }>;
}

interface LandlordRow {
  name: string;
  slug: string | null;
  building_count: number;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  total_dob_violations: number;
  avg_score: number | null;
  worst_building_address: string | null;
  worst_building_violations: number | null;
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
  const supabase = await createClient();

  function buildBaseDataQuery() {
    return supabase
      .from("landlord_stats")
      .select(
        "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations"
      )
      .eq("metro", city)
      .not("name", "in", GARBAGE_IN);
  }

  let countQuery = supabase
    .from("landlord_stats")
    .select("id", { count: "exact", head: true })
    .eq("metro", city)
    .not("name", "in", GARBAGE_IN);
  let dataQuery = buildBaseDataQuery()
    .order(sortOption.col, { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  // Top 6 worst (Hall of Shame) — always sorted by violations regardless of
  // user's directory sort. Kept distinct so the featured section is stable.
  const shameQuery = buildBaseDataQuery().order("total_violations", { ascending: false }).limit(6);

  // Five ranking strips — top 3 per metric.
  const stripQueries = RANKING_STRIPS.map((s) =>
    buildBaseDataQuery().order(s.col, { ascending: false }).limit(3)
  );

  // Lightweight count of buildings in this metro for the hero meta.
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

  const [
    { count: total },
    { data: landlords },
    buildingsCount,
    { data: shameRows },
    ...stripResults
  ] = await Promise.all([
    countQuery,
    dataQuery,
    getBuildingsCount(),
    shameQuery,
    ...stripQueries,
  ]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const rows = (landlords ?? []) as LandlordRow[];
  const featured = (shameRows ?? []) as LandlordRow[];

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

  /* Render helpers */
  function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
      <span
        className={`text-[10px] uppercase tracking-[0.1em] text-[#94a3b8] font-semibold ${className}`}
        style={{ fontFamily: 'var(--mono)' }}
      >
        {children}
      </span>
    );
  }

  return (
    <AdSidebar>
      <div className="v2">
        <V2Zoom />
        {prevHref && <link rel="prev" href={prevHref} />}
        {nextHref && <link rel="next" href={nextHref} />}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Crumbs */}
          <nav className="crumbs">
            <Link href="/">home</Link>
            <span className="sep">/</span>
            <Link href={`/${meta.urlPrefix}`}>{meta.urlPrefix.toLowerCase()}</Link>
            <span className="sep">/</span>
            <span className="now">landlords</span>
          </nav>

          {/* Hero */}
          <header className="mt-4 mb-6">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl tracking-[-0.02em] leading-[1.02] text-[#0F1D2E] m-0"
              style={{ fontFamily: 'var(--serif)' }}
            >
              Every landlord in {meta.fullName}.
            </h1>
            <p
              className="mt-4 text-[12px] uppercase tracking-[0.06em] text-[#52606d] flex flex-wrap gap-x-3 gap-y-1 items-center"
              style={{ fontFamily: 'var(--mono)' }}
            >
              <span>{(total ?? 0).toLocaleString()} indexed</span>
              <span className="opacity-30">·</span>
              <span>
                {buildingsCount ? `${compact(buildingsCount)} buildings tracked` : `${meta.fullName} portfolio`}
              </span>
              <span className="opacity-30">·</span>
              <span>portfolio · violations · complaints · litigation</span>
            </p>
            <p className="mt-4 text-base sm:text-lg text-[#475569] max-w-3xl leading-relaxed">
              Search any {meta.fullName} landlord by name. Click through to the full portfolio,
              violation history, complaint record, and the worst building in their book.
            </p>

            {/* Big autocomplete search */}
            <div className="mt-6">
              <LandlordSearch city={city} cityName={meta.fullName} />
            </div>
          </header>

          {/* City record strip */}
          <section
            className="mb-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-px bg-[#0F1D2E] rounded-xl overflow-hidden border border-[#0F1D2E]"
            aria-label="City landlord landscape"
          >
            {[
              { k: "Landlords", v: (total ?? 0).toLocaleString(), s: "indexed" },
              { k: "Buildings", v: buildingsCount ? compact(buildingsCount) : "—", s: `in ${meta.name}` },
              { k: "Top portfolio", v: featured[0]?.building_count.toLocaleString() ?? "—", s: featured[0]?.name?.split(",")[0]?.slice(0, 24) ?? "—" },
              { k: "Top violations", v: featured[0]?.total_violations ? compact(featured[0].total_violations) : "—", s: featured[0]?.name?.split(",")[0]?.slice(0, 24) ?? "—" },
              { k: "Updated", v: "live", s: "rev. 60 min" },
            ].map((c) => (
              <div key={c.k} className="bg-[#0F1D2E] px-4 py-4 flex flex-col gap-1">
                <span
                  className="text-[10px] uppercase tracking-[0.1em] text-white/55 font-semibold"
                  style={{ fontFamily: 'var(--mono)' }}
                >
                  {c.k}
                </span>
                <span
                  className="text-2xl sm:text-3xl text-white tabular-nums leading-none"
                  style={{ fontFamily: 'var(--serif)' }}
                >
                  {c.v}
                </span>
                <span
                  className="text-[10px] uppercase tracking-[0.06em] text-white/45 truncate"
                  style={{ fontFamily: 'var(--mono)' }}
                >
                  {c.s}
                </span>
              </div>
            ))}
          </section>

          {/* ============ SECTION 01 — HALL OF SHAME ============ */}
          <section id="shame" className="mb-12 sm:mb-14 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-5 gap-4">
              <div className="flex items-baseline gap-3">
                <MonoLabel>01</MonoLabel>
                <h2
                  className="text-2xl sm:text-3xl text-[#0F1D2E] m-0 tracking-[-0.01em]"
                  style={{ fontFamily: 'var(--serif)' }}
                >
                  Hall of shame
                </h2>
              </div>
              <MonoLabel>top 6 by total violations</MonoLabel>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featured.slice(0, 6).map((l, idx) => (
                <Link
                  key={l.name}
                  href={landlordUrl(l.name, city)}
                  className="group relative block rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0F1D2E] hover:shadow-[0_8px_24px_-12px_rgba(15,29,46,0.18)] transition-all overflow-hidden"
                >
                  {/* Rank tag */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]"
                      style={{ fontFamily: 'var(--mono)' }}
                    >
                      No.
                    </span>
                    <span
                      className="text-[28px] font-bold text-[#0F1D2E] tabular-nums leading-none"
                      style={{ fontFamily: 'var(--mono)' }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <LetterGrade score={l.avg_score} size="sm" />
                  </div>

                  <div className="px-5 pt-16 pb-5">
                    <h3
                      className="text-lg sm:text-xl text-[#0F1D2E] m-0 leading-[1.2] tracking-[-0.005em] group-hover:text-[#1e3a8a] transition-colors line-clamp-2 min-h-[2.4em]"
                      style={{ fontFamily: 'var(--serif)' }}
                    >
                      {l.name}
                    </h3>

                    {/* Hero stat */}
                    <div className="mt-4 flex items-baseline gap-2">
                      <span
                        className="text-4xl sm:text-5xl text-[#0F1D2E] tabular-nums leading-none tracking-[-0.02em]"
                        style={{ fontFamily: 'var(--serif)' }}
                      >
                        {compact(l.total_violations)}
                      </span>
                      <MonoLabel>violations</MonoLabel>
                    </div>

                    {/* Sub-stats */}
                    <p
                      className="mt-3 text-[11px] uppercase tracking-[0.06em] text-[#52606d] tabular-nums"
                      style={{ fontFamily: 'var(--mono)' }}
                    >
                      {l.building_count.toLocaleString()} bldg ·{" "}
                      {l.total_complaints.toLocaleString()} complaints ·{" "}
                      {l.total_litigations.toLocaleString()} cases
                    </p>

                    {/* Worst building */}
                    {l.worst_building_address && (
                      <div className="mt-3 pt-3 border-t border-dashed border-[#e2e8f0]">
                        <MonoLabel className="!text-[#dc2626]">Worst building</MonoLabel>
                        <p className="text-xs text-[#52606d] mt-0.5 truncate">
                          {l.worst_building_address}
                          {l.worst_building_violations
                            ? ` · ${l.worst_building_violations.toLocaleString()} viol.`
                            : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ============ SECTION 02 — RANKING STRIPS ============ */}
          <section id="rankings" className="mb-12 sm:mb-14 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-5 gap-4">
              <div className="flex items-baseline gap-3">
                <MonoLabel>02</MonoLabel>
                <h2
                  className="text-2xl sm:text-3xl text-[#0F1D2E] m-0 tracking-[-0.01em]"
                  style={{ fontFamily: 'var(--serif)' }}
                >
                  Rankings
                </h2>
              </div>
              <MonoLabel>5 lenses · top 3 each</MonoLabel>
            </div>

            <div className="space-y-3">
              {RANKING_STRIPS.map((strip, stripIdx) => {
                const stripData = (stripResults[stripIdx]?.data ?? []) as LandlordRow[];
                const Icon = strip.icon;
                if (stripData.length === 0) return null;
                const metricKey = strip.col;
                return (
                  <div
                    key={strip.id}
                    id={strip.id}
                    className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] rounded-xl border border-[#e2e8f0] bg-white overflow-hidden"
                  >
                    {/* Strip header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b lg:border-b-0 lg:border-r border-[#e2e8f0] bg-[#f8fafc]">
                      <span className="w-9 h-9 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-[#0F1D2E]" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0">
                        <h3
                          className="text-[13px] font-semibold text-[#0F1D2E] m-0 leading-tight"
                          style={{ fontFamily: 'var(--sans)' }}
                        >
                          {strip.label}
                        </h3>
                        <Link
                          href={url({ sort: strip.sort, page: "1" })}
                          className="text-[10px] uppercase tracking-[0.08em] text-[#3B82F6] font-semibold hover:text-[#0F1D2E] transition-colors"
                          style={{ fontFamily: 'var(--mono)' }}
                        >
                          See full ranking →
                        </Link>
                      </div>
                    </div>

                    {/* Top 3 */}
                    <ol className="grid grid-cols-1 sm:grid-cols-3 list-none m-0 p-0 divide-y sm:divide-y-0 sm:divide-x divide-[#e2e8f0]">
                      {stripData.slice(0, 3).map((l, i) => {
                        const value = (l as unknown as Record<string, number>)[metricKey] ?? 0;
                        return (
                          <li key={l.name}>
                            <Link
                              href={landlordUrl(l.name, city)}
                              className="group flex items-baseline gap-3 px-4 py-3 hover:bg-[#f8fafc] transition-colors h-full"
                            >
                              <span
                                className="text-base font-bold text-[#94a3b8] tabular-nums w-5 flex-shrink-0"
                                style={{ fontFamily: 'var(--mono)' }}
                              >
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-[#0F1D2E] truncate group-hover:text-[#1e3a8a] transition-colors">
                                  {l.name}
                                </p>
                                <p
                                  className="text-[11px] uppercase tracking-[0.06em] text-[#52606d] tabular-nums mt-0.5"
                                  style={{ fontFamily: 'var(--mono)' }}
                                >
                                  <span className="font-bold text-[#0F1D2E]">{value.toLocaleString()}</span>
                                  <span className="opacity-50"> · {l.building_count.toLocaleString()} bldg</span>
                                </p>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#0F1D2E] flex-shrink-0" />
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ============ SECTION 03 — BROWSE THE DIRECTORY ============ */}
          <section id="directory" className="mb-12 sm:mb-14 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <MonoLabel>03</MonoLabel>
                <h2
                  className="text-2xl sm:text-3xl text-[#0F1D2E] m-0 tracking-[-0.01em]"
                  style={{ fontFamily: 'var(--serif)' }}
                >
                  Browse the directory
                </h2>
              </div>
              <MonoLabel>
                {(total ?? 0).toLocaleString()} total · sorted by {sortOption.label.toLowerCase()}
              </MonoLabel>
            </div>

            {/* Filter bar — sort pills + secondary search (the hero search is the primary) */}
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              <MonoLabel className="!text-[#52606d] mr-2">Sort by</MonoLabel>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={url({ sort: opt.key, page: "1" })}
                    className={
                      active
                        ? "px-3 py-1.5 text-[12px] font-semibold rounded-full bg-[#0F1D2E] text-white"
                        : "px-3 py-1.5 text-[12px] font-medium rounded-full bg-white text-[#475569] border border-[#e2e8f0] hover:border-[#0F1D2E] hover:text-[#0F1D2E] transition-colors"
                    }
                    style={{ fontFamily: 'var(--mono)' }}
                  >
                    {opt.label}
                  </Link>
                );
              })}
              {search && (
                <Link
                  href={basePath}
                  className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-[#dc2626] font-semibold border border-[#fecaca] bg-[#fef2f2] rounded-full hover:bg-[#fee2e2] transition-colors"
                  style={{ fontFamily: 'var(--mono)' }}
                >
                  Clear &ldquo;{search}&rdquo; ×
                </Link>
              )}
            </div>

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
                              <h3
                                className="text-xl sm:text-2xl text-[#0F1D2E] m-0 leading-tight tracking-[-0.01em] group-hover:text-[#1e3a8a] transition-colors"
                                style={{ fontFamily: 'var(--serif)' }}
                              >
                                {l.name}
                              </h3>
                              <MonoLabel>{meta.stateCode} · {meta.name}</MonoLabel>
                            </div>

                            {/* Stats row */}
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              {cells.map((c) => {
                                const active = sortBy === c.k;
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
                                <MonoLabel className="!text-[#dc2626]">Worst building</MonoLabel>
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

                          {/* Right rail */}
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
          </section>

          {/* ============ SECTION 04 — RELATED ============ */}
          <section id="related" className="mt-12 pt-8 border-t border-[#e2e8f0] scroll-mt-20">
            <div className="flex items-baseline gap-3 mb-4">
              <MonoLabel>04</MonoLabel>
              <h2
                className="text-xl sm:text-2xl text-[#0F1D2E] m-0 tracking-[-0.01em]"
                style={{ fontFamily: 'var(--serif)' }}
              >
                Related directories
              </h2>
            </div>
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
              <Link
                href={cityPath("/feed", city)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white text-[#0F1D2E] border border-[#e2e8f0] rounded-lg hover:border-[#0F1D2E] transition-colors"
              >
                <BarChart3 className="w-4 h-4 text-[#94a3b8]" />
                Live activity feed
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AdSidebar>
  );
}
