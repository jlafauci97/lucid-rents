import { unstable_cache } from "next/cache";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, ArrowUpRight, Building2, Trophy, Flame, Scale, FileWarning, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert, Gavel } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { LandlordSearch } from "@/components/landlord-search/LandlordSearch";
import type { Metadata } from "next";

// Cookie-free anonymous client for use inside unstable_cache (Next.js
// forbids cookies() inside a cache scope, and this data is fully public).
function createAnonClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

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

// Landlord stats roll up nightly via build-landlord-stats.mjs — bumped
// from 3600s (1hr) to 86400s (24hr). The shared data cache (see below)
// has its own 3600s TTL so this just cuts ISR background work.
export const revalidate = 86400;

// Pre-render all 5 cities at build time so end users never hit a cold
// cache. Sort/page/search variants still server-render on demand but they
// share the cached data layer below, so each variant is sub-second.
export async function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

const SORT_OPTIONS = [
  { key: "violations",  label: "Violations",  col: "total_violations" },
  { key: "complaints",  label: "Complaints",  col: "total_complaints" },
  { key: "litigations", label: "Litigations", col: "total_litigations" },
  { key: "dob",         label: "DOB",         col: "total_dob_violations" },
  { key: "buildings",   label: "Buildings",   col: "building_count" },
] as const;

const RANKING_STRIPS = [
  { id: "by-violations",  label: "Most violations on record", col: "total_violations",     unit: "viol",  sort: "violations"  },
  { id: "by-complaints",  label: "Most 311 complaints",        col: "total_complaints",     unit: "calls", sort: "complaints"  },
  { id: "by-litigation",  label: "Most open litigation",       col: "total_litigations",    unit: "cases", sort: "litigations" },
  { id: "by-dob",         label: "Most DOB violations",        col: "total_dob_violations", unit: "DOB",   sort: "dob"         },
  { id: "by-buildings",   label: "Largest portfolios",         col: "building_count",       unit: "bldg",  sort: "buildings"   },
] as const;

/* Filter placeholder/redacted owner names from display.
   UNAVAILABLE OWNER is the placeholder for buildings whose owner couldn't
   be resolved — it's the single largest "owner" by building count (~3K bldg)
   but it's not a real landlord. We hide it from rankings/hall of shame/list/
   directory count, while the city-level building total (queried separately
   against the buildings table, NOT landlord_stats) keeps including those
   buildings. */
const GARBAGE_NAMES = [
  "AVAILABLE FROM DATA SOURCE",
  "NAME NOT ON FILE",
  "NOT AVAILABLE",
  "NOT AVAILABLE FROM THE DATA",
  "NOT AVAILABLE FROM THE DATA SOURCE",
  "UNKNOWN",
  "UNKNOWN OWNER",
  "N/A",
  "NA",
  "UNAVAILABLE",
  "UNAVAILABLE OWNER",
  "Taxpayer Unknown",
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

/* ─── Bento style tokens ─────────────────────────────────────────── */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const PAPER = "#fafbfd";
const BORDER = "rgba(10,14,26,0.08)";

const G = {
  rose:  "linear-gradient(135deg, #fff0f4 0%, #ffd6e3 100%)",
  iris:  "linear-gradient(135deg, #f0eaff 0%, #d9d0ff 100%)",
  sky:   "linear-gradient(135deg, #e6f1ff 0%, #c5dcff 100%)",
  mint:  "linear-gradient(135deg, #e0f7ee 0%, #b8efd6 100%)",
  amber: "linear-gradient(135deg, #fff5dc 0%, #ffe5a8 100%)",
  peach: "linear-gradient(135deg, #fff0e8 0%, #ffd2bc 100%)",
};
const ACCENT = {
  rose:  "#ec4899",
  iris:  "#7c3aed",
  sky:   "#3b82f6",
  mint:  "#10b981",
  amber: "#f59e0b",
  peach: "#f97316",
};
const SHADOW = "0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -12px rgba(10,14,26,0.08)";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </span>
  );
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

  // Read from the canonical rollup so identical legal entities stored as
  // multiple near-duplicate rows in landlord_stats ("SENIOR LIVING OPTIONS,
  // INC." + "SENIOR LIVING OPTIONS INC" + "SENIOR LIVING OPTIONS, INC")
  // surface as a single deduped row with summed metrics. Refreshed nightly
  // via refresh_landlord_stats_canonical_for_metro.
  const baseSelect =
    "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations";

  const baseQuery = () =>
    supabase
      .from("landlord_stats_canonical")
      .select(baseSelect)
      .eq("metro", city)
      .not("name", "in", GARBAGE_IN);

  // landlord_stats_canonical has no id; slug is the PK, count via slug.
  let countQuery = supabase
    .from("landlord_stats_canonical")
    .select("slug", { count: "estimated", head: true })
    .eq("metro", city)
    .not("name", "in", GARBAGE_IN);

  let dataQuery = baseQuery()
    .order(sortOption.col, { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  // ─── ALL non-search/sort/page-dependent data wrapped in unstable_cache ──
  // Previously every request fanned out: shame + 5 strip queries + 2 RPCs +
  // buildings count = 9 round-trips per request. We now cache the entire
  // shared layer per-city for 3600s, so EVERY sort/page/search variant of
  // the page reuses the same data — only the paginated countQuery and
  // dataQuery (which depend on search/sort/page) hit the DB per request.
  type OathRow = {
    name: string;
    slug: string;
    building_count: number;
    hearing_count: number;
    total_penalty: number;
    total_balance: number;
  };
  type TopBy311Row = {
    name: string;
    building_count: number;
    complaint_count: number;
    slug: string | null;
  };

  const fetchSharedLandlordData = unstable_cache(
    async (cityKey: City) => {
      const supa = createAnonClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const baseQ = () =>
        supa
          .from("landlord_stats")
          .select(baseSelect)
          .eq("metro", cityKey)
          .not("name", "in", GARBAGE_IN);

      const shameQ = baseQ().order("total_violations", { ascending: false }).limit(6);
      const stripQs = RANKING_STRIPS.map((s) =>
        baseQ().order(s.col, { ascending: false }).limit(3)
      );

      const oathQ = cityKey === "nyc"
        ? supa.rpc("get_top_landlords_by_oath", { p_limit: 3 }).then(
            (r) => (Array.isArray(r?.data) ? (r.data as unknown as OathRow[]) : []),
            () => [] as OathRow[]
          )
        : Promise.resolve([] as OathRow[]);

      const top311Q = supa.rpc("get_top_landlords_by_311", { p_limit: 3, p_metro: cityKey }).then(
        (r) => (Array.isArray(r?.data) ? (r.data as unknown as TopBy311Row[]) : []),
        () => [] as TopBy311Row[]
      );

      const buildingsCountQ = (async (): Promise<number | null> => {
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/buildings?select=id&metro=eq.${encodeURIComponent(cityKey)}`,
            {
              headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Prefer: "count=estimated", Range: "0-0" },
            }
          );
          if (!res.ok) return null;
          const range = res.headers.get("content-range") || "";
          const m = range.match(/\/(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        } catch {
          return null;
        }
      })();

      const [shameRes, oath, t311, bcount, ...stripRes] = await Promise.all([
        shameQ,
        oathQ,
        top311Q,
        buildingsCountQ,
        ...stripQs,
      ]);

      return {
        shameRows: (shameRes?.data ?? []) as LandlordRow[],
        oathTop: oath,
        top311: t311,
        buildingsCount: bcount,
        stripResults: stripRes.map((r) => ((r?.data ?? []) as LandlordRow[])),
      };
    },
    ["landlords-shared-v1", city],
    { revalidate: 3600, tags: [`landlords:${city}`] }
  );

  const [
    { count: totalRaw },
    { data: landlords },
    shared,
  ] = await Promise.all([
    countQuery,
    dataQuery,
    fetchSharedLandlordData(city),
  ]);

  const rows = (landlords ?? []) as LandlordRow[];
  const featured = shared.shameRows;
  const buildingsCount = shared.buildingsCount;
  const oathTop = shared.oathTop;
  const top311 = shared.top311;
  const stripResults = shared.stripResults;
  const total = totalRaw && totalRaw > 0 ? totalRaw : (rows.length > 0 ? rows.length + offset : 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const basePath = cityPath("/landlords", city);
  const baseQs: string[] = [];
  if (search) baseQs.push(`search=${encodeURIComponent(search)}`);
  if (sortBy !== "violations") baseQs.push(`sort=${sortBy}`);
  const qsHead = baseQs.length ? baseQs.join("&") : "";
  const prevHref =
    page > 1
      ? canonicalUrl(`${basePath}?${qsHead ? qsHead + "&" : ""}${page === 2 ? "" : `page=${page - 1}`}`.replace(/[?&]$/, ""))
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
      <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
        {prevHref && <link rel="prev" href={prevHref} />}
        {nextHref && <link rel="next" href={nextHref} />}

        {/* Tighter horizontal padding on smallest phones — 16px gives bento cards
            and the hero search bar more breathing room at 360-414px widths. */}
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-12 lg:py-16">

          {/* Hero */}
          <header className="mb-10 sm:mb-14">
            <div className="flex items-center gap-2 mb-6">
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT.rose }} />
              <MonoLabel>{meta.fullName} · Landlord Index · {total.toLocaleString()} indexed</MonoLabel>
            </div>
            {/* Hero title: lower min so longer city names ("Los Angeles") don't
                wrap to 4 lines on iPhone-class widths. 36px reads as a real
                hero on mobile while letting "Every landlord in {city}." fit
                on 2 lines on a 360-414px viewport. */}
            <h1 style={{ fontFamily: SANS, fontSize: "clamp(36px, 7vw, 84px)", lineHeight: 1.05, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
              Every landlord in{" "}
              <span style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed 60%, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {meta.fullName}.
              </span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 1.5vw, 21px)", lineHeight: 1.45, color: INK_SOFT, maxWidth: 720, margin: "16px 0 0", fontWeight: 400 }}>
              Look up any one of {total.toLocaleString()} indexed owners.
              Click through to the full portfolio, violation history, and the worst building in their book.
            </p>

            <div className="mt-8">
              <LandlordSearch city={city} cityName={meta.fullName} />
            </div>
          </header>

          {/* Stats Bento */}
          <section className="mb-10 sm:mb-14">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-6 row-span-2 p-7 sm:p-9 flex flex-col justify-between" style={{ background: G.rose, borderRadius: 24, minHeight: 220 }}>
                <div>
                  <MonoLabel color={ACCENT.rose}>Total indexed</MonoLabel>
                  <div style={{ fontSize: "clamp(56px, 7vw, 96px)", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.04em", marginTop: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>
                    {total.toLocaleString()}
                  </div>
                  <p style={{ marginTop: 12, fontSize: 14, color: INK_SOFT, maxWidth: 360 }}>
                    Every {meta.fullName} owner of record — individuals, LLCs, holding companies, and city agencies.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <span style={{ background: "rgba(255,255,255,0.7)", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: INK }}>
                    Live · cached 60m
                  </span>
                </div>
              </div>

              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.sky, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.sky}>Buildings</MonoLabel>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {buildingsCount ? compact(buildingsCount) : "—"}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>tracked across portfolios</div>
              </div>

              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.iris, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.iris}>Top portfolio</MonoLabel>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {featured[0]?.building_count?.toLocaleString() ?? "—"}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {featured[0]?.name?.slice(0, 32) ?? "—"}
                </div>
              </div>

              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.amber, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.amber}>Most violations</MonoLabel>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {featured[0]?.total_violations ? compact(featured[0].total_violations) : "—"}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {featured[0]?.name?.slice(0, 32) ?? "—"}
                </div>
              </div>

              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.mint, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.mint}>Sorted by</MonoLabel>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05, marginTop: 8, color: INK, letterSpacing: "-0.015em" }}>
                  {sortOption.label}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>
                  Page {page} of {totalPages.toLocaleString()}
                </div>
              </div>
            </div>
          </section>

          {/* Hall of Shame */}
          {featured.length > 0 && (
            <section className="mb-10 sm:mb-14">
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <MonoLabel color={ACCENT.rose}>Section 01</MonoLabel>
                  <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                    Hall of shame
                  </h2>
                </div>
                <MonoLabel>Top {featured.length} by violations</MonoLabel>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <Link href={landlordUrl(featured[0].name, city)} className="col-span-12 lg:col-span-7 p-7 sm:p-8 group transition-all" style={{ background: "#fff", borderRadius: 24, border: `1px solid ${BORDER}`, boxShadow: SHADOW, textDecoration: "none", color: "inherit" }}>
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.rose, fontWeight: 700 }}>NO. 01</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(236,72,153,0.1)", color: ACCENT.rose, fontWeight: 600 }}>Worst overall</span>
                    </div>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: G.rose, display: "inline-flex", alignItems: "center", justifyContent: "center", color: ACCENT.rose }}>
                      <Trophy size={18} strokeWidth={2.25} />
                    </span>
                  </div>
                  <h3 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 18px", fontWeight: 700, color: INK }}>
                    {featured[0].name}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { k: "Violations", v: featured[0].total_violations.toLocaleString(), c: ACCENT.rose },
                      { k: "Complaints", v: featured[0].total_complaints.toLocaleString(), c: ACCENT.amber },
                      { k: "Cases", v: featured[0].total_litigations.toLocaleString(), c: ACCENT.iris },
                    ].map((s) => (
                      <div key={s.k}>
                        <MonoLabel>{s.k}</MonoLabel>
                        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {featured[0].worst_building_address && (
                    <div className="pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <MonoLabel color={ACCENT.rose}>Worst building</MonoLabel>
                      <div style={{ marginTop: 6, fontSize: 14, color: INK_SOFT }}>
                        {featured[0].worst_building_address}
                        {featured[0].worst_building_violations
                          ? <> · <strong style={{ color: INK }}>{featured[0].worst_building_violations.toLocaleString()} viol.</strong></>
                          : null}
                      </div>
                    </div>
                  )}
                </Link>

                {featured[1] && (
                  <Link href={landlordUrl(featured[1].name, city)} className="col-span-12 sm:col-span-6 lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between" style={{ background: G.iris, borderRadius: 24, textDecoration: "none", color: "inherit", minHeight: 280 }}>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.iris, fontWeight: 700 }}>NO. 02</span>
                      </div>
                      <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.015em", margin: 0, fontWeight: 700, color: INK }}>
                        {featured[1].name}
                      </h3>
                    </div>
                    <div className="mt-6">
                      <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                        {compact(featured[1].total_violations)}
                      </div>
                      <MonoLabel color={INK_SOFT}>violations on record</MonoLabel>
                      <div style={{ marginTop: 10, fontSize: 12, color: INK_SOFT }}>
                        {featured[1].building_count} bldg · {featured[1].total_litigations} cases
                      </div>
                    </div>
                  </Link>
                )}

                {featured.slice(2, 6).map((l, idx) => {
                  const palette = [G.amber, G.mint, G.peach, G.sky][idx];
                  const accent = [ACCENT.amber, ACCENT.mint, ACCENT.peach, ACCENT.sky][idx];
                  return (
                    <Link key={l.name} href={landlordUrl(l.name, city)} className="col-span-6 sm:col-span-6 lg:col-span-3 p-5 sm:p-6 flex flex-col" style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                      <div className="flex items-center justify-between mb-3">
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: accent, fontWeight: 700 }}>
                          NO. {String(idx + 3).padStart(2, "0")}
                        </span>
                      </div>
                      {/* Allow 3 lines on small cards so long names like
                          "NEIGHBORHOOD RENEWAL HOUSING DEVELOPMENT FUND CORP"
                          don't get truncated mid-word ("…FUN…") at 2-line clamp. */}
                      <h3 style={{ fontSize: 15, lineHeight: 1.2, letterSpacing: "-0.005em", margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                        {l.name}
                      </h3>
                      <div style={{ marginTop: "auto", paddingTop: 14 }}>
                        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {compact(l.total_violations)}
                        </div>
                        <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          viol · {l.building_count} bldg
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Rankings */}
          <section className="mb-10 sm:mb-14">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={ACCENT.iris}>Section 02</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Rankings
                </h2>
              </div>
              <MonoLabel>5 lenses · top 3 each</MonoLabel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RANKING_STRIPS.map((strip, idx) => {
                const palette = [G.rose, G.iris, G.sky, G.mint, G.amber, G.peach][idx];
                const accent = [ACCENT.rose, ACCENT.iris, ACCENT.sky, ACCENT.mint, ACCENT.amber, ACCENT.peach][idx];
                const Icon = [Trophy, Flame, Scale, FileWarning, Building2, Gavel][idx];
                const metricKey = strip.col;
                // The 311-complaints strip uses the freshly-aggregated
                // landlord_311_summary RPC instead of the stale
                // landlord_stats.total_complaints column. Falls back to
                // landlord_stats if the matview hasn't been populated for
                // this metro yet.
                const useLive311 = strip.id === "by-complaints" && top311.length > 0;
                const stripData = useLive311
                  ? top311.map((r) => ({
                      name: r.name,
                      building_count: r.building_count,
                      total_violations: 0, total_complaints: r.complaint_count,
                      total_litigations: 0, total_dob_violations: 0,
                      avg_score: null, slug: r.slug, worst_building_address: null, worst_building_violations: null,
                    } satisfies LandlordRow))
                  : (stripResults[idx] ?? []);
                if (stripData.length === 0) return null;
                return (
                  <div key={strip.id} id={strip.id} className="p-5 sm:p-6" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span style={{ width: 36, height: 36, borderRadius: 12, background: palette, color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                          <Link href={url({ sort: strip.sort, page: "1" })} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, fontWeight: 700, textDecoration: "none" }}>
                            See full ranking →
                          </Link>
                        </div>
                      </div>
                    </div>
                    <ol className="m-0 p-0 list-none">
                      {stripData.slice(0, 3).map((l, i) => {
                        const value = (l as unknown as Record<string, number>)[metricKey] ?? 0;
                        return (
                          <li key={l.name} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                            <span style={{ width: 24, height: 24, borderRadius: 8, background: palette, color: accent, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <Link href={landlordUrl(l.name, city)} className="flex-1 min-w-0 group" style={{ textDecoration: "none", color: "inherit" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.name}
                              </div>
                              <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: INK, fontWeight: 700 }}>{value.toLocaleString()}</span>
                                <span style={{ textTransform: "lowercase" }}> {strip.unit}</span>
                                {/* Don't repeat "X bldg" when the metric IS building count */}
                                {metricKey !== "building_count" && (
                                  <span style={{ opacity: 0.55 }}> · {l.building_count.toLocaleString()} bldg</span>
                                )}
                              </div>
                            </Link>
                            <ArrowUpRight size={16} style={{ color: INK_MUTE, flexShrink: 0 }} />
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}

              {/* NYC-only: top landlords by OATH adjudicated hearings */}
              {city === "nyc" && oathTop.length > 0 && (
                <div id="by-oath" className="p-5 sm:p-6" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span style={{ width: 36, height: 36, borderRadius: 12, background: G.peach, color: ACCENT.peach, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Gavel size={16} strokeWidth={2.25} />
                      </span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>Most OATH adjudications</h3>
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT.peach, fontWeight: 700 }}>
                          NYC only · DOB hearings
                        </span>
                      </div>
                    </div>
                  </div>
                  <ol className="m-0 p-0 list-none">
                    {oathTop.slice(0, 3).map((l, i) => (
                      <li key={l.name} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, background: G.peach, color: ACCENT.peach, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <Link href={landlordUrl(l.name, city)} className="flex-1 min-w-0 group" style={{ textDecoration: "none", color: "inherit" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {l.name}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: INK, fontWeight: 700 }}>{l.hearing_count.toLocaleString()}</span>
                            <span style={{ textTransform: "lowercase" }}> hearings</span>
                            {l.total_penalty > 0 && (
                              <span style={{ opacity: 0.55 }}>
                                {" · "}
                                <span style={{ color: ACCENT.peach, fontWeight: 700 }}>${compact(Number(l.total_penalty))}</span> imposed
                              </span>
                            )}
                            <span style={{ opacity: 0.55 }}> · {l.building_count} bldg</span>
                          </div>
                        </Link>
                        <ArrowUpRight size={16} style={{ color: INK_MUTE, flexShrink: 0 }} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>

          {/* Browse the directory */}
          <section className="mb-10 sm:mb-14">
            <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
              <div>
                <MonoLabel color={ACCENT.sky}>Section 03</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Browse the directory
                </h2>
              </div>
              <MonoLabel>{total.toLocaleString()} total · sorted by {sortOption.label.toLowerCase()}</MonoLabel>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={url({ sort: opt.key, page: "1" })}
                    className="px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: active ? INK : "#fff",
                      color: active ? "#fff" : INK_SOFT,
                      borderRadius: 999,
                      border: `1px solid ${active ? INK : BORDER}`,
                      fontFamily: SANS,
                      textDecoration: "none",
                    }}
                  >
                    {opt.label}
                  </Link>
                );
              })}
              {search && (
                <Link href={basePath} className="px-4 py-2 text-sm font-semibold" style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 999, border: "1px solid #fecaca", textDecoration: "none" }}>
                  Clear &ldquo;{search}&rdquo; ×
                </Link>
              )}
            </div>

            <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: INK_MUTE, marginBottom: 12, textTransform: "uppercase" }}>
              {rows.length > 0
                ? `Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + rows.length, total).toLocaleString()} of ${total.toLocaleString()}${search ? ` matching "${search}"` : ""}`
                : "No landlords found"}
            </p>

            {rows.length > 0 ? (
              <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
                <ol className="m-0 p-0 list-none">
                  {rows.map((l, idx) => {
                    const rank = offset + idx + 1;
                    return (
                      <li key={l.name} style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <Link href={landlordUrl(l.name, city)} className="group flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-[#fafbfd]" style={{ textDecoration: "none", color: "inherit" }}>
                          <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                            {String(rank).padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.005em" }}>
                              {l.name}
                            </h3>
                            <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                              <span><span style={{ color: ACCENT.rose, fontWeight: 700 }}>{l.total_violations.toLocaleString()}</span> viol</span>
                              <span><span style={{ color: ACCENT.amber, fontWeight: 700 }}>{l.total_complaints.toLocaleString()}</span> calls</span>
                              <span><span style={{ color: ACCENT.iris, fontWeight: 700 }}>{l.total_litigations.toLocaleString()}</span> cases</span>
                              <span><span style={{ color: INK, fontWeight: 700 }}>{l.building_count.toLocaleString()}</span> bldg</span>
                              {l.worst_building_address && (
                                <span style={{ color: INK_MUTE, opacity: 0.85 }}>
                                  worst: <span style={{ color: INK_SOFT }}>{l.worst_building_address.split(",")[0]}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-3">
                            <LetterGrade score={l.avg_score} size="sm" />
                            <span className="inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: PAPER, color: INK_MUTE }}>
                              <ArrowUpRight size={16} className="group-hover:scale-110 transition-transform" />
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="p-12 text-center" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                <Trophy size={32} style={{ color: INK_MUTE, margin: "0 auto 10px" }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>No landlords found</h3>
                <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>
                  {search ? `No landlords match "${search}". Try a different search term.` : "Landlord data is still being processed for this metro."}
                </p>
                {search && (
                  <Link href={basePath} className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold" style={{ color: ACCENT.rose }}>
                    Clear search and view all
                  </Link>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: INK_MUTE, textTransform: "uppercase" }}>
                  Page {page} of {totalPages.toLocaleString()}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link href={url({ page: String(page - 1) })} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ background: "#fff", color: INK_SOFT, borderRadius: 12, border: `1px solid ${BORDER}`, textDecoration: "none" }}>
                      <ChevronLeft size={14} /> Previous
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ color: "#cbd5e1", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                      <ChevronLeft size={14} /> Previous
                    </span>
                  )}
                  {page < totalPages ? (
                    <Link href={url({ page: String(page + 1) })} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ background: "#fff", color: INK_SOFT, borderRadius: 12, border: `1px solid ${BORDER}`, textDecoration: "none" }}>
                      Next <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ color: "#cbd5e1", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                      Next <ChevronRight size={14} />
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Related */}
          <section className="mb-10 sm:mb-14">
            <div className="mb-5">
              <MonoLabel color={ACCENT.mint}>Section 04</MonoLabel>
              <h2 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Related directories
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { href: cityPath("/building-rankings", city), label: "Worst-rated buildings", icon: AlertTriangle },
                { href: cityPath("/buildings", city),               label: "Buildings directory",  icon: Building2 },
                { href: cityPath("/crime", city),                   label: "Crime by zip code",    icon: ShieldAlert },
              ].map((r) => (
                <Link key={r.href} href={r.href} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" style={{ background: "#fff", color: INK_SOFT, borderRadius: 999, border: `1px solid ${BORDER}`, textDecoration: "none" }}>
                  <r.icon size={14} style={{ color: INK_MUTE }} />
                  {r.label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="p-8 sm:p-12 text-center" style={{ background: "linear-gradient(135deg, #1a1d2b 0%, #0a0e1a 100%)", borderRadius: 28, color: "#fff" }}>
            <MonoLabel color="rgba(255,255,255,0.5)">Tenant testimony</MonoLabel>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "12px 0 16px", fontWeight: 700 }}>
              Add your receipts.
            </h2>
            <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(255,255,255,0.7)", maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
              Reviews from former tenants are the part of the file we can&rsquo;t pull from public records.
              Two minutes saves the next renter from a year of mistakes.
            </p>
            <Link href={cityPath("/review/new", city)} className="inline-flex items-center gap-2 px-7 py-4 font-semibold" style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)", color: "#fff", borderRadius: 14, fontSize: 16, textDecoration: "none" }}>
              Write a review
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </section>
        </div>
      </main>
    </AdSidebar>
  );
}
