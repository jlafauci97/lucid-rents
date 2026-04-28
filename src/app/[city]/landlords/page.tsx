import "@/styles/landlord-list-v2.css";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, Building2, ShieldAlert, Trophy, Flame, Scale, FileWarning, BarChart3 } from "lucide-react";
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
  { id: "by-violations",  label: "Most violations on record",  col: "total_violations",      icon: AlertTriangle, sort: "violations",  unit: "viol" },
  { id: "by-complaints",  label: "Most 311 complaints",         col: "total_complaints",      icon: Flame,         sort: "complaints",  unit: "calls" },
  { id: "by-litigation",  label: "Most open litigation",        col: "total_litigations",     icon: Scale,         sort: "litigations", unit: "cases" },
  { id: "by-dob",         label: "Most DOB violations",         col: "total_dob_violations",  icon: FileWarning,   sort: "dob",         unit: "DOB" },
  { id: "by-buildings",   label: "Largest portfolios",          col: "building_count",        icon: Building2,     sort: "buildings",   unit: "bldg" },
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

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

  const baseSelect =
    "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations";

  function baseQuery() {
    return supabase
      .from("landlord_stats")
      .select(baseSelect)
      .eq("metro", city)
      .not("name", "in", GARBAGE_IN);
  }

  let countQuery = supabase
    .from("landlord_stats")
    .select("id", { count: "exact", head: true })
    .eq("metro", city)
    .not("name", "in", GARBAGE_IN);
  let dataQuery = baseQuery()
    .order(sortOption.col, { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  const shameQuery = baseQuery().order("total_violations", { ascending: false }).limit(6);
  const stripQueries = RANKING_STRIPS.map((s) =>
    baseQuery().order(s.col, { ascending: false }).limit(3)
  );

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

  return (
    <AdSidebar>
      <div className="v2">
        <V2Zoom />
        {prevHref && <link rel="prev" href={prevHref} />}
        {nextHref && <link rel="next" href={nextHref} />}

        <div className="container">
          {/* ─────── Crumbs + Hero ─────── */}
          <nav className="crumbs">
            <Link href="/">home</Link>
            <span className="sep">/</span>
            <Link href={`/${meta.urlPrefix}`}>{meta.urlPrefix.toLowerCase()}</Link>
            <span className="sep">/</span>
            <span className="now">landlords</span>
          </nav>

          <div className="hero">
            <div className="hero-left">
              <h1>Every landlord in {meta.fullName}.</h1>
              <div className="hero-address">
                <span>{(total ?? 0).toLocaleString()} indexed</span>
                <span className="sep">·</span>
                <span>{buildingsCount ? `${compact(buildingsCount)} buildings tracked` : `${meta.fullName} portfolio`}</span>
              </div>
              <div className="hero-meta">
                <span>Portfolio</span>
                <span>Violations</span>
                <span>Complaints</span>
                <span>Litigation</span>
                <span>Reviews</span>
              </div>
              <p className="hero-tagline">
                Search any {meta.fullName} landlord by name. Click through to the full portfolio,
                violation history, complaint record, and the worst building in their book.
              </p>
            </div>
            <aside className="hero-search-aside">
              <div className="hero-search-wrap">
                <span className="hero-search-eyebrow">Look up a landlord</span>
                <LandlordSearch city={city} cityName={meta.fullName} />
                <p className="hero-search-help">
                  Type 2+ characters for live results. ↑↓ to navigate · ⏎ to open.
                </p>
              </div>
            </aside>
          </div>

          {/* ─────── City record strip ─────── */}
          <section className="record" style={{ ['--record-cols' as string]: 5 }}>
            <div className="r-cell">
              <span className="r-k">Landlords</span>
              <span className="r-v">{(total ?? 0).toLocaleString()}</span>
              <span className="r-sub">indexed</span>
            </div>
            <div className="r-cell">
              <span className="r-k">Buildings</span>
              <span className="r-v">{buildingsCount ? compact(buildingsCount) : "—"}</span>
              <span className="r-sub">in {meta.name}</span>
            </div>
            <div className="r-cell warn">
              <span className="r-k">Top portfolio</span>
              <span className="r-v">
                {featured[0]?.building_count.toLocaleString() ?? "—"}
              </span>
              <span className="r-sub">{(featured[0]?.name ?? "").split(",")[0].slice(0, 22) || "—"}</span>
            </div>
            <div className="r-cell warn">
              <span className="r-k">Top violations</span>
              <span className="r-v">{featured[0]?.total_violations ? compact(featured[0].total_violations) : "—"}</span>
              <span className="r-sub">{(featured[0]?.name ?? "").split(",")[0].slice(0, 22) || "—"}</span>
            </div>
            <div className="r-cell">
              <span className="r-k">Refreshed</span>
              <span className="r-v">live</span>
              <span className="r-sub">cache 60 min</span>
            </div>
          </section>

          {/* ─────── 01 Hall of shame ─────── */}
          <section id="shame" className="section">
            <div className="section-head">
              <div>
                <div className="num">01</div>
                <h2>Hall of shame</h2>
              </div>
              <div className="meta">top 6 by total violations</div>
            </div>

            <div className="ll-shame-grid">
              {featured.slice(0, 6).map((l, idx) => (
                <Link key={l.name} href={landlordUrl(l.name, city)} className="ri-card ll-shame-card">
                  <div className="ll-shame-head">
                    <span className="ll-shame-rank">No. {String(idx + 1).padStart(2, "0")}</span>
                    <LetterGrade score={l.avg_score} size="sm" />
                  </div>
                  <h3 className="ll-shame-name">{l.name}</h3>
                  <div className="ll-shame-hero">
                    <span className="ll-shame-num">{compact(l.total_violations)}</span>
                    <span className="ll-shame-num-k">violations</span>
                  </div>
                  <div className="ll-shame-sub">
                    {l.building_count.toLocaleString()} bldg · {l.total_complaints.toLocaleString()} complaints · {l.total_litigations.toLocaleString()} cases
                  </div>
                  {l.worst_building_address && (
                    <div className="ll-shame-worst">
                      <span className="ll-shame-worst-k">Worst building</span>
                      <span className="ll-shame-worst-v">
                        {l.worst_building_address}
                        {l.worst_building_violations ? ` · ${l.worst_building_violations.toLocaleString()} viol` : ""}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* ─────── 02 Rankings (5 strips) ─────── */}
          <section id="rankings" className="section">
            <div className="section-head">
              <div>
                <div className="num">02</div>
                <h2>Rankings</h2>
              </div>
              <div className="meta">5 lenses · top 3 each</div>
            </div>

            <div className="ll-strips">
              {RANKING_STRIPS.map((strip, stripIdx) => {
                const stripData = (stripResults[stripIdx]?.data ?? []) as LandlordRow[];
                const Icon = strip.icon;
                if (stripData.length === 0) return null;
                const metricKey = strip.col;
                return (
                  <div key={strip.id} id={strip.id} className="ri-card ll-strip">
                    <div className="ll-strip-head">
                      <span className="ll-strip-icon"><Icon size={16} strokeWidth={2.25} /></span>
                      <div>
                        <h3 className="ll-strip-title">{strip.label}</h3>
                        <Link href={url({ sort: strip.sort, page: "1" })} className="ll-strip-link">
                          See full ranking →
                        </Link>
                      </div>
                    </div>
                    <ol className="ll-strip-list">
                      {stripData.slice(0, 3).map((l, i) => {
                        const value = (l as unknown as Record<string, number>)[metricKey] ?? 0;
                        return (
                          <li key={l.name}>
                            <Link href={landlordUrl(l.name, city)} className="ll-strip-row">
                              <span className="ll-strip-rank">{i + 1}</span>
                              <div className="ll-strip-body">
                                <span className="ll-strip-name">{l.name}</span>
                                <span className="ll-strip-meta">
                                  <strong>{value.toLocaleString()}</strong> {strip.unit} · {l.building_count.toLocaleString()} bldg
                                </span>
                              </div>
                              <ArrowRight size={14} className="ll-strip-arrow" />
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

          {/* ─────── 03 Browse the directory ─────── */}
          <section id="directory" className="section">
            <div className="section-head">
              <div>
                <div className="num">03</div>
                <h2>Browse the directory</h2>
              </div>
              <div className="meta">{(total ?? 0).toLocaleString()} total · sorted by {sortOption.label.toLowerCase()}</div>
            </div>

            <div className="ll-controls">
              <span className="ll-controls-label">Sort by</span>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={url({ sort: opt.key, page: "1" })}
                    className={active ? "chip ink" : "chip"}
                  >
                    {opt.label}
                  </Link>
                );
              })}
              {search && (
                <Link href={basePath} className="chip ll-clear-chip">
                  Clear &ldquo;{search}&rdquo; ×
                </Link>
              )}
            </div>

            <p className="ll-summary">
              {(total ?? 0) > 0
                ? `Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + rows.length, total ?? 0).toLocaleString()} of ${(total ?? 0).toLocaleString()}${search ? ` matching "${search}"` : ""}`
                : "No landlords found"}
            </p>

            {rows.length > 0 ? (
              <ol className="ll-list">
                {rows.map((l, idx) => {
                  const rank = offset + idx + 1;
                  const cells = [
                    { k: "buildings", label: "bldg", v: l.building_count },
                    { k: "violations", label: "viol", v: l.total_violations },
                    { k: "complaints", label: "calls", v: l.total_complaints },
                    { k: "litigations", label: "cases", v: l.total_litigations },
                    { k: "dob", label: "DOB", v: l.total_dob_violations },
                  ];
                  return (
                    <li key={l.name}>
                      <Link href={landlordUrl(l.name, city)} className="ri-card ll-row">
                        <div className="ll-row-rank">
                          <span className="ll-row-rank-k">No.</span>
                          <span className="ll-row-rank-v">{String(rank).padStart(2, "0")}</span>
                        </div>
                        <div className="ll-row-body">
                          <h3 className="ll-row-name">{l.name}</h3>
                          <div className="ll-row-stats">
                            {cells.map((c) => {
                              const active = sortBy === c.k;
                              return (
                                <span key={c.k} className={active ? "ll-row-stat is-active" : "ll-row-stat"}>
                                  <strong>{(c.v ?? 0).toLocaleString()}</strong>
                                  <em>{c.label}</em>
                                </span>
                              );
                            })}
                          </div>
                          {l.worst_building_address && (
                            <div className="ll-row-worst">
                              <span className="ll-row-worst-k">Worst</span>
                              <span className="ll-row-worst-v">
                                {l.worst_building_address}
                                {l.worst_building_violations ? ` · ${l.worst_building_violations.toLocaleString()} viol` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ll-row-grade">
                          <LetterGrade score={l.avg_score} size="sm" />
                          <ArrowRight size={16} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="ri-card" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}>
                <Trophy size={32} className="ll-empty-icon" />
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--f-22)', margin: '12px 0 4px', color: 'var(--ink)' }}>No landlords found</h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--f-14)', margin: 0 }}>
                  {search ? `No landlords match "${search}". Try a different search term.` : "Landlord data is still being processed for this metro."}
                </p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="ll-pagination">
                <span className="ll-pagination-meta">Page {page} of {totalPages.toLocaleString()}</span>
                <div className="ll-pagination-btns">
                  {page > 1 ? (
                    <Link href={url({ page: String(page - 1) })} className="ll-pagination-btn">
                      <ChevronLeft size={14} /> Previous
                    </Link>
                  ) : (
                    <span className="ll-pagination-btn is-disabled"><ChevronLeft size={14} /> Previous</span>
                  )}
                  {page < totalPages ? (
                    <Link href={url({ page: String(page + 1) })} className="ll-pagination-btn">
                      Next <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span className="ll-pagination-btn is-disabled">Next <ChevronRight size={14} /></span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ─────── 04 Related directories ─────── */}
          <section id="related" className="section">
            <div className="section-head">
              <div>
                <div className="num">04</div>
                <h2>Related directories</h2>
              </div>
              <div className="meta">deeper data per city</div>
            </div>
            <div className="ll-related">
              <Link href={cityPath("/worst-rated-buildings", city)} className="chip">
                <AlertTriangle size={14} /> Worst-rated buildings
              </Link>
              <Link href={cityPath("/buildings", city)} className="chip">
                <Building2 size={14} /> Buildings directory
              </Link>
              <Link href={cityPath("/crime", city)} className="chip">
                <ShieldAlert size={14} /> Crime by zip code
              </Link>
              <Link href={cityPath("/feed", city)} className="chip">
                <BarChart3 size={14} /> Live activity feed
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AdSidebar>
  );
}
