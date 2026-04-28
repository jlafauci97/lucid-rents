import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Search, ArrowRight, ArrowUpRight, Building2, Trophy, Flame, Scale, FileWarning,
  Snowflake, Sparkles, AlertTriangle, TrendingUp, TrendingDown, MapPin, Calendar, Layers, Quote,
  Gavel, Bug, ChevronLeft, ChevronRight,
} from "lucide-react";
import { unstable_cache } from "next/cache";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Non-cookie anonymous client safe to use inside unstable_cache. The data
// fetched here is fully public (counts and rankings on a public buildings
// table), so there's no RLS reason to need a user-scoped client.
function createAnonClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
import { buildingUrl, landlordUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { getRegions, normalizeScore } from "@/lib/constants";
import {
  WATCHLIST, MOVERS, BY_ERA, BY_SIZE, TOP_ZIPS, COMPLAINT_CLOUD,
} from "@/app/mock/_building-rankings-mock-data";
import { BentoWayfinder } from "./BentoWayfinder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const url = canonicalUrl(cityPath("/building-rankings", city));
  const title = `Building Rankings in ${meta.fullName}`;
  const description = `Every building in ${meta.fullName} ranked by violations, evictions, lawsuits, and tenant ratings. Check before you sign a lease.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

// Pre-render all 5 cities at build time so end users never hit a cold cache.
// Pages with searchParams (sort/page/borough variants) still server-render
// on demand, but they share the cached data layer below so each variant is
// fast (single small directory query + cached pool reuse).
export async function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

/* ─── Bento style tokens (must match the mock pixel-for-pixel) ─────────── */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const PAPER = "#fafbfd";
const BORDER = "rgba(10,14,26,0.08)";

const G = {
  rose:    "linear-gradient(135deg, #fff0f4 0%, #ffd6e3 100%)",
  iris:    "linear-gradient(135deg, #f0eaff 0%, #d9d0ff 100%)",
  sky:     "linear-gradient(135deg, #e6f1ff 0%, #c5dcff 100%)",
  mint:    "linear-gradient(135deg, #e0f7ee 0%, #b8efd6 100%)",
  amber:   "linear-gradient(135deg, #fff5dc 0%, #ffe5a8 100%)",
  peach:   "linear-gradient(135deg, #fff0e8 0%, #ffd2bc 100%)",
  ember:   "linear-gradient(135deg, #fee4d6 0%, #ffb38a 100%)",
  graphite:"linear-gradient(135deg, #1a1d2b 0%, #0a0e1a 100%)",
};
const ACCENT = {
  rose:  "#ec4899",
  iris:  "#7c3aed",
  sky:   "#3b82f6",
  mint:  "#10b981",
  amber: "#f59e0b",
  peach: "#f97316",
  ember: "#ea580c",
  red:   "#dc2626",
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

function PreviewBadge() {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
      color: INK_MUTE, fontWeight: 700, padding: "3px 7px",
      border: `1px solid ${BORDER}`, borderRadius: 4, background: "#fff",
    }}>
      Preview
    </span>
  );
}

interface BuildingRow {
  id: string;
  full_address: string;
  borough: string;
  zip_code: string | null;
  slug: string;
  year_built: number | null;
  total_units: number | null;
  owner_name: string | null;
  violation_count: number;
  complaint_count: number;
  eviction_count: number;
  litigation_count: number;
  bedbug_report_count: number;
  overall_score: number | null;
  review_count: number;
}

const SORT_OPTIONS = [
  { key: "violations",  label: "Violations",  col: "violation_count"  },
  { key: "complaints",  label: "Complaints",  col: "complaint_count"  },
  { key: "evictions",   label: "Evictions",   col: "eviction_count"   },
  { key: "lawsuits",    label: "Lawsuits",    col: "litigation_count" },
  { key: "per-unit",    label: "Per-unit",    col: "violation_count"  }, // sorted in-app
] as const;

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ borough?: string; sort?: string; page?: string }>;
}

export default async function BuildingRankingsPage({ params: routeParams, searchParams }: PageProps) {
  const { city: cityParam } = await routeParams;
  if (!isValidCity(cityParam)) notFound();
  const city = cityParam as City;
  const meta = CITY_META[city];

  const params = await searchParams;
  const borough = params.borough || "all";
  const sortBy = params.sort || "violations";
  const pageNum = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const limit = 25;
  const offset = (pageNum - 1) * limit;

  const sortOption = SORT_OPTIONS.find((o) => o.key === sortBy) ?? SORT_OPTIONS[0];
  const supabase = await createClient();
  const metro = city; // metro column on every relevant table mirrors the city slug

  const baseSelect =
    "id, full_address, borough, zip_code, slug, year_built, total_units, owner_name, violation_count, complaint_count, eviction_count, litigation_count, bedbug_report_count, overall_score, review_count";

  // ─── borough region list (used for breakdown + boroughs cache key) ──
  const cityRegions = getRegions(city);
  const regionListForBreakdown = cityRegions.slice(0, 5);
  const favReviewMin = city === "nyc" ? 50 : 5;

  // ─── ALL shared, non-searchparam-dependent data in ONE cached call ──
  // Previously this page fanned out 13 separate queries (top-6 shame,
  // top-3 violations, top-200 complaints pool, top-100 per-unit pool,
  // top-5 favorites, top-3 per borough × 5, count queries × 6+) — all
  // hitting the same 640K-row buildings table. Cold-cache load was 8–14s.
  // We now do this with a SHARED top-200 violations pool + favorites +
  // per-borough top-3, all wrapped in unstable_cache so the data layer
  // is reused across every (sort × page × borough) variant of the page.
  const fetchSharedData = unstable_cache(
    async (cityKey: City) => {
      const metroKey = cityKey;
      // Use the cookie-free anon client — `unstable_cache` forbids dynamic
      // data sources (cookies()) inside its scope.
      const supa = createAnonClient();

      // 1. Single top-200 pool by violation_count (covers shame, lenses, perUnit)
      const poolQ = supa
        .from("buildings")
        .select(baseSelect)
        .eq("metro", metroKey)
        .gt("violation_count", 0)
        .order("violation_count", { ascending: false })
        .limit(200);

      // 2. Tenant favorites
      const favMin = cityKey === "nyc" ? 50 : 5;
      const favQ = supa
        .from("buildings")
        .select(baseSelect)
        .eq("metro", metroKey)
        .gt("overall_score", 0)
        .gt("review_count", favMin)
        .order("overall_score", { ascending: false })
        .order("review_count", { ascending: false })
        .limit(5);

      // 3. Evictions count (cheap — small table, NYC-only)
      const evictionsQ = supa
        .from("evictions")
        .select("id", { count: "estimated", head: true })
        .eq("metro", metroKey);

      // 4. Per-borough top-3 (5 parallel)
      const boroughQs = regionListForBreakdown.map((r) =>
        supa
          .from("buildings")
          .select(baseSelect)
          .eq("metro", metroKey)
          .eq("borough", r)
          .gt("violation_count", 0)
          .order("violation_count", { ascending: false })
          .limit(3)
      );

      const [poolRes, favRes, evictRes, ...boroughRes] = await Promise.all([
        poolQ,
        favQ,
        evictionsQ,
        ...boroughQs,
      ]);

      return {
        pool: (poolRes.data ?? []) as BuildingRow[],
        favorites: (favRes.data ?? []) as BuildingRow[],
        totalEvictions: evictRes.count ?? 0,
        boroughs: boroughRes.map((r) => (r.data ?? []) as BuildingRow[]),
      };
    },
    ["building-rankings-shared-v2", city],
    { revalidate: 3600, tags: [`building-rankings:${city}`] }
  );

  // ─── directory (paginated) ────────────────────────────────────────────
  // Only `violation_count` has a fast index — sorting by complaints/evictions/
  // lawsuits/bedbug directly takes 8s+. For those sorts we re-use the shared
  // pool (top 200 by violations) and re-sort/paginate in app code. That caps
  // those views at 200 results but they're already "worst-violator" buildings.
  const useDbForDirectory = sortBy === "violations" || sortBy === "per-unit";

  // Wrap the chained Supabase query in an async helper so the call site
  // gets a Promise (parallelisable with the shared cache fetch) and we
  // sidestep TS friction between PostgrestQueryBuilder vs FilterBuilder.
  async function fetchDirectory(): Promise<{ data: BuildingRow[] | null }> {
    if (!useDbForDirectory) return { data: null };
    const base = supabase
      .from("buildings")
      .select(baseSelect)
      .eq("metro", metro);
    const filtered = borough !== "all" ? base.eq("borough", borough) : base;
    const sorted =
      sortBy === "per-unit"
        ? filtered
            .gt("violation_count", 0)
            .gt("total_units", 0)
            .order("violation_count", { ascending: false })
        : filtered
            .gt("violation_count", 0)
            .order("violation_count", { ascending: false });
    const { data } = await sorted.range(offset, offset + limit);
    return { data: (data ?? []) as BuildingRow[] };
  }

  // ─── parallel: shared cached data + (optional) small directory query ─
  // Shared data is wrapped in unstable_cache (60-min TTL, per-city tag).
  // The directory either uses an indexed-fast DB query (violations sort) or
  // re-sorts the cached pool in app for the slow-column sorts.
  const [shared, dirRes] = await Promise.all([
    fetchSharedData(city),
    fetchDirectory(),
  ]);

  // Hardcoded floor per city — count: 'estimated' is unreliable for this
  // table (planner can return 0 when stats are stale). These floors are
  // conservative (verified Apr 2026); actual counts are higher.
  const BUILDINGS_FLOOR: Record<string, number> = {
    nyc: 913_000,
    "los-angeles": 480_000,
    chicago: 265_000,
    miami: 256_000,
    houston: 255_000,
  };
  const totalBuildings = BUILDINGS_FLOOR[city] ?? 0;
  const totalEvictions = shared.totalEvictions;

  // Derive every ranking from the single shared top-200 pool — this avoids
  // hitting the per-column timeout we'd otherwise see ordering by
  // eviction_count / litigation_count / bedbug_report_count directly.
  const complaintsPool = shared.pool;
  const hallOfShame = complaintsPool.slice(0, 6);
  const mostViolations = complaintsPool.slice(0, 3);
  const mostComplaints = [...complaintsPool]
    .filter((b) => (b.complaint_count ?? 0) > 0)
    .sort((a, b) => (b.complaint_count ?? 0) - (a.complaint_count ?? 0))
    .slice(0, 3);
  const mostEvictions = [...complaintsPool]
    .filter((b) => (b.eviction_count ?? 0) > 0)
    .sort((a, b) => (b.eviction_count ?? 0) - (a.eviction_count ?? 0))
    .slice(0, 3);
  const mostLawsuits = [...complaintsPool]
    .filter((b) => (b.litigation_count ?? 0) > 0)
    .sort((a, b) => (b.litigation_count ?? 0) - (a.litigation_count ?? 0))
    .slice(0, 3);
  const sixthLensRows = [...complaintsPool]
    .filter((b) => (b.bedbug_report_count ?? 0) > 0)
    .sort((a, b) => (b.bedbug_report_count ?? 0) - (a.bedbug_report_count ?? 0))
    .slice(0, 3);
  const perUnitPool = complaintsPool.filter((b) => (b.total_units ?? 0) > 0);
  const favorites = shared.favorites;
  const boroughTopResults = shared.boroughs.map((rows) => ({ data: rows, count: null }));
  const boroughCountResults = shared.boroughs.map((rows) => ({ count: rows.length, data: null }));

  // Compute per-unit top 3 in app
  const perUnit = perUnitPool
    .filter((b) => (b.total_units ?? 0) > 0)
    .map((b) => ({ b, ratio: b.violation_count / (b.total_units || 1) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  // Build the directory rows. For violations/per-unit, use the DB result
  // (full table sorted by indexed column). For other sorts, slice from the
  // shared pool re-sorted in app code (capped at top-200 violators).
  let directoryRows: BuildingRow[];
  let hasNextPage: boolean;
  if (useDbForDirectory) {
    const dirRowsRaw = (dirRes.data ?? []) as BuildingRow[];
    hasNextPage = dirRowsRaw.length > limit;
    directoryRows = dirRowsRaw.slice(0, limit);
    if (sortBy === "per-unit") {
      directoryRows = [...directoryRows].sort(
        (a, b) =>
          b.violation_count / (b.total_units || 1) - a.violation_count / (a.total_units || 1)
      );
    }
  } else {
    // Re-sort the cached pool by the requested column in app code.
    const sortColumn: keyof BuildingRow =
      sortBy === "complaints" ? "complaint_count" :
      sortBy === "evictions"  ? "eviction_count"  :
      sortBy === "lawsuits"   ? "litigation_count" :
      sortBy === "bedbug"     ? "bedbug_report_count" :
                                "complaint_count";
    let filtered = complaintsPool.filter((b) => Number(b[sortColumn] ?? 0) > 0);
    if (borough !== "all") filtered = filtered.filter((b) => b.borough === borough);
    filtered.sort((a, b) => Number(b[sortColumn] ?? 0) - Number(a[sortColumn] ?? 0));
    hasNextPage = filtered.length > offset + limit;
    directoryRows = filtered.slice(offset, offset + limit);
  }

  // Estimated total complaint count for the heading badge — falls back to building count
  const totalComplaintsEstimate = mostComplaints.reduce((s, b) => s + (b.complaint_count ?? 0), 0);

  // ─── url helper for filter/sort/page links ────────────────────────────
  const basePath = cityPath("/building-rankings", city);
  function buildHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = { borough, sort: sortBy, page: String(pageNum), ...overrides };
    Object.keys(merged).forEach((k) => {
      if (
        !merged[k] ||
        (k === "page" && merged[k] === "1") ||
        (k === "sort" && merged[k] === "violations") ||
        (k === "borough" && merged[k] === "all")
      ) {
        delete merged[k];
      }
    });
    const qs = new URLSearchParams(merged).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // ─── ranking lens config ──────────────────────────────────────────────
  type LensRow = { b: BuildingRow; value: number; sub: string };
  const lenses: {
    id: string;
    label: string;
    description: string;
    unit: string;
    metroOnly?: City;
    icon: typeof Trophy;
    rows: LensRow[];
    sortKey: string;
  }[] = [
    {
      id: "by-violations",
      label: "Most violations on record",
      description: "Total open HPD/DOB violations citywide",
      unit: "viol",
      icon: Trophy,
      sortKey: "violations",
      rows: mostViolations.map((b) => ({
        b,
        value: b.violation_count,
        sub: `${b.borough || "—"} · ${b.total_units ? b.total_units.toLocaleString() + " units" : "—"}`,
      })),
    },
    {
      id: "by-complaints",
      label: "Most 311 complaints",
      description: "Quality-of-life and habitability calls",
      unit: "calls",
      icon: Flame,
      sortKey: "complaints",
      rows: mostComplaints.map((b) => ({
        b,
        value: b.complaint_count,
        sub: `${b.borough || "—"} · ${b.total_units ? b.total_units.toLocaleString() + " units" : "—"}`,
      })),
    },
    {
      id: "by-evictions",
      label: "Most evictions filed",
      description: "Housing court filings on record",
      unit: "filings",
      icon: Scale,
      sortKey: "evictions",
      rows: mostEvictions.map((b) => ({
        b,
        value: b.eviction_count,
        sub: `${b.borough || "—"} · ${b.total_units ? b.total_units.toLocaleString() + " units" : "—"}`,
      })),
    },
    {
      id: "by-per-unit",
      label: "Worst per-unit ratio",
      description: "Violations divided by total units",
      unit: "viol/unit",
      icon: Building2,
      sortKey: "per-unit",
      rows: perUnit.map(({ b, ratio }) => ({
        b,
        value: Math.round(ratio * 100) / 100,
        sub: `${b.borough || "—"} · ${b.total_units?.toLocaleString() ?? "—"} units`,
      })),
    },
    {
      id: "by-lawsuits",
      label: "Most active lawsuits",
      description: "Open housing court cases against the building",
      unit: "cases",
      icon: FileWarning,
      sortKey: "lawsuits",
      rows: mostLawsuits.map((b) => ({
        b,
        value: b.litigation_count,
        sub: `${b.borough || "—"} · ${b.total_units ? b.total_units.toLocaleString() + " units" : "—"}`,
      })),
    },
    {
      id: "by-bedbug",
      label: city === "nyc" ? "Most bedbug reports" : "Most bedbug reports",
      description: "DOHMH bedbug filings",
      unit: "reports",
      icon: Bug,
      sortKey: "bedbug",
      rows: sixthLensRows.map((b) => ({
        b,
        value: b.bedbug_report_count,
        sub: `${b.borough || "—"} · ${b.total_units ? b.total_units.toLocaleString() + " units" : "—"}`,
      })),
    },
  ];

  // Hide lenses with no data so we don't render empty tiles
  const visibleLenses = lenses.filter((l) => l.rows.length > 0);

  // Borough breakdown rows assembled from parallel results
  const boroughBreakdown = regionListForBreakdown.map((name, i) => {
    const top3 = (boroughTopResults[i]?.data ?? []) as BuildingRow[];
    const count = boroughCountResults[i]?.count ?? 0;
    const violations = top3.reduce((sum, b) => sum + (b.violation_count || 0), 0);
    return { name, buildings: count, violations, top3 };
  }).filter((b) => b.top3.length > 0);

  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }} className="pb-24 md:pb-0">
      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 pt-12 sm:pt-16">
        {/* Hero */}
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT.rose }} />
            <MonoLabel>{meta.fullName} · Building Rankings · {compact(totalBuildings)} indexed</MonoLabel>
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: "clamp(48px, 7vw, 84px)", lineHeight: 1.0, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
            Every building in{" "}
            <span style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed 60%, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {meta.fullName}.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", lineHeight: 1.5, color: INK_SOFT, maxWidth: 720, margin: "20px auto 0", fontWeight: 400 }}>
            Ranked by violations, evictions, lawsuits, and what tenants actually report. Pull up any building&rsquo;s
            full file before you sign a lease.
          </p>

          <form action={cityPath("/buildings", city)} className="mt-8 max-w-2xl mx-auto">
            <div className="flex items-center" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 6, boxShadow: SHADOW }}>
              <span style={{ padding: "0 14px", color: INK_MUTE }}>
                <Search size={20} strokeWidth={2} />
              </span>
              <input
                type="text"
                name="q"
                placeholder="Search any building by address…"
                className="flex-1 bg-transparent py-3 text-base focus:outline-none"
                style={{ fontFamily: SANS, color: INK }}
              />
              <button type="submit" className="px-5 py-3 font-semibold text-white text-sm flex items-center gap-2" style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)", borderRadius: 12 }}>
                Search
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </form>
        </header>
      </div>

      {/* Wayfinder — sticky in-page nav */}
      <BentoWayfinder />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 pt-10 pb-16">
        {/* Stats Bento */}
        <section id="stats" className="mb-14 scroll-mt-24">
          <div className="grid grid-cols-12 grid-rows-[auto] gap-4">
            <div className="col-span-12 md:col-span-6 row-span-2 p-7 sm:p-9 flex flex-col justify-between" style={{ background: G.rose, borderRadius: 24, minHeight: 220 }}>
              <div>
                <MonoLabel color={ACCENT.rose}>Buildings indexed</MonoLabel>
                <div style={{ fontSize: "clamp(56px, 7vw, 96px)", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.04em", marginTop: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {compact(totalBuildings)}
                </div>
                <p style={{ marginTop: 12, fontSize: 14, color: INK_SOFT, maxWidth: 360 }}>
                  Every multi-family building in {meta.fullName}, scored on violations, complaints, lawsuits, and tenant ratings.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <span style={{ background: "rgba(255,255,255,0.7)", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: INK }}>
                  Live · cached 60m
                </span>
              </div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.sky, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.sky}>Top 6 violations</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(hallOfShame.reduce((s, b) => s + (b.violation_count ?? 0), 0))}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>combined Hall of Shame</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.iris, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.iris}>Top 311 caller</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {mostComplaints[0]?.complaint_count ? compact(mostComplaints[0].complaint_count) : "—"}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mostComplaints[0]?.full_address?.split(",")[0] ?? "calls at one building"}
              </div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.amber, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.amber}>Hall of shame top</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {hallOfShame[0]?.violation_count ? compact(hallOfShame[0].violation_count) : "—"}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {hallOfShame[0]?.full_address?.split(",")[0] ?? "—"}
              </div>
            </div>

            {/* 5th tile: evictions for NYC (only metro with backfilled data),
                top-100 violations sum for other metros so the slot always
                shows real data. */}
            {totalEvictions > 0 ? (
              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.mint, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.mint}>Evictions filed</MonoLabel>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {compact(totalEvictions)}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>housing court · on record</div>
              </div>
            ) : (
              <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.mint, borderRadius: 20 }}>
                <MonoLabel color={ACCENT.mint}>Top 100 sum</MonoLabel>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {compact(complaintsPool.slice(0, 100).reduce((s, b) => s + (b.violation_count ?? 0), 0))}
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>violations across worst 100</div>
              </div>
            )}
          </div>
        </section>

        {/* Hall of Worst — Bento mosaic */}
        {hallOfShame.length > 0 && (
          <section id="worst" className="mb-14 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
              <div>
                <MonoLabel color={ACCENT.rose}>Section 01</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Hall of Shame
                </h2>
              </div>
              <MonoLabel>Top {hallOfShame.length} by violations</MonoLabel>
            </div>

            <div className="grid grid-cols-12 gap-4">
              {hallOfShame[0] && (
                <Link href={buildingUrl(hallOfShame[0], city)} className="col-span-12 lg:col-span-7 p-7 sm:p-8 group transition-all" style={{ background: "#fff", borderRadius: 24, border: `1px solid ${BORDER}`, boxShadow: SHADOW, textDecoration: "none", color: "inherit" }}>
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.rose, fontWeight: 700 }}>NO. 01</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(236,72,153,0.1)", color: ACCENT.rose, fontWeight: 600 }}>Worst overall</span>
                    </div>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: G.rose, display: "inline-flex", alignItems: "center", justifyContent: "center", color: ACCENT.rose }}>
                      <Trophy size={18} strokeWidth={2.25} />
                    </span>
                  </div>
                  <h3 style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 6px", fontWeight: 700, color: INK }}>
                    {hallOfShame[0].full_address.split(",")[0]}
                  </h3>
                  <div style={{ fontSize: 14, color: INK_MUTE, marginBottom: 22 }}>
                    {[
                      hallOfShame[0].borough,
                      hallOfShame[0].zip_code,
                      hallOfShame[0].total_units ? `${hallOfShame[0].total_units.toLocaleString()} units` : null,
                      hallOfShame[0].year_built ? `built ${hallOfShame[0].year_built}` : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                      { k: "Violations", v: hallOfShame[0].violation_count.toLocaleString(), c: ACCENT.rose },
                      { k: "Complaints", v: hallOfShame[0].complaint_count.toLocaleString(), c: ACCENT.amber },
                      { k: "Evictions",  v: hallOfShame[0].eviction_count.toLocaleString(),  c: ACCENT.iris },
                      { k: "Rating",     v: hallOfShame[0].overall_score ? `${normalizeScore(hallOfShame[0].overall_score).toFixed(1)}★` : "—", c: ACCENT.peach },
                    ].map((s) => (
                      <div key={s.k}>
                        <MonoLabel>{s.k}</MonoLabel>
                        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hallOfShame[0].owner_name && (
                    <div className="pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <MonoLabel color={ACCENT.rose}>Owner of record</MonoLabel>
                      <div style={{ marginTop: 6, fontSize: 14, color: INK_SOFT }}>
                        {hallOfShame[0].owner_name}
                        {hallOfShame[0].litigation_count > 0 && (
                          <> · <strong style={{ color: INK }}>{hallOfShame[0].litigation_count.toLocaleString()} active cases</strong></>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              )}

              {hallOfShame[1] && (
                <Link href={buildingUrl(hallOfShame[1], city)} className="col-span-12 sm:col-span-6 lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between" style={{ background: G.iris, borderRadius: 24, textDecoration: "none", color: "inherit", minHeight: 280 }}>
                  <div>
                    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.iris, fontWeight: 700 }}>NO. 02</span>
                    <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.015em", margin: "12px 0 0", fontWeight: 700, color: INK }}>
                      {hallOfShame[1].full_address.split(",")[0]}
                    </h3>
                    <div style={{ fontSize: 13, color: INK_MUTE, marginTop: 4 }}>
                      {hallOfShame[1].borough}
                      {hallOfShame[1].total_units ? ` · ${hallOfShame[1].total_units.toLocaleString()} units` : ""}
                    </div>
                  </div>
                  <div className="mt-6">
                    <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                      {compact(hallOfShame[1].violation_count)}
                    </div>
                    <MonoLabel color={INK_SOFT}>open violations</MonoLabel>
                    <div style={{ marginTop: 10, fontSize: 12, color: INK_SOFT }}>
                      {hallOfShame[1].eviction_count} evictions · {hallOfShame[1].litigation_count} lawsuits
                    </div>
                  </div>
                </Link>
              )}

              {hallOfShame.slice(2, 6).map((b, idx) => {
                const palette = [G.amber, G.mint, G.peach, G.sky][idx];
                const accent = [ACCENT.amber, ACCENT.mint, ACCENT.peach, ACCENT.sky][idx];
                return (
                  <Link key={b.id} href={buildingUrl(b, city)} className="col-span-6 sm:col-span-6 lg:col-span-3 p-5 sm:p-6 flex flex-col" style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: accent, fontWeight: 700 }}>
                      NO. {String(idx + 3).padStart(2, "0")}
                    </span>
                    <h3 style={{ fontSize: 14, lineHeight: 1.2, letterSpacing: "-0.005em", margin: "8px 0 0", fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {b.full_address.split(",")[0]}
                    </h3>
                    <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4 }}>
                      {b.borough}{b.total_units ? ` · ${b.total_units} units` : ""}
                    </div>
                    <div style={{ marginTop: "auto", paddingTop: 14 }}>
                      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                        {compact(b.violation_count)}
                      </div>
                      <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        viol · {b.complaint_count.toLocaleString()} calls
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* THE WATCHLIST — preview (mock data) */}
        <section id="watchlist" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MonoLabel color={ACCENT.ember}>Section 02</MonoLabel>
                <PreviewBadge />
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                The watchlist
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6, maxWidth: 560 }}>
                Buildings about to crash — pre-foreclosure filings, sudden violation spikes, owners gone missing.
              </p>
            </div>
            <MonoLabel color={ACCENT.ember}>● updated daily</MonoLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WATCHLIST.map((w) => {
              const sigColor = w.signal === "critical" ? ACCENT.red : w.signal === "high" ? ACCENT.ember : ACCENT.amber;
              const sigBg = w.signal === "critical" ? G.ember : w.signal === "high" ? G.peach : G.amber;
              return (
                <div key={w.address} className="p-6 flex flex-col" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, boxShadow: SHADOW, color: "inherit", minHeight: 240, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: sigColor }} />
                  <div className="flex items-start justify-between mb-4 mt-1">
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: sigBg, color: sigColor, fontWeight: 700, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {w.signal}
                    </span>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: sigBg, color: sigColor, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle size={16} strokeWidth={2.25} />
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0, fontWeight: 700, color: INK }}>
                    {w.address}
                  </h3>
                  <div style={{ fontSize: 12, color: INK_MUTE, marginTop: 4 }}>
                    {w.borough} · {w.units.toLocaleString()} units
                  </div>

                  <div className="mt-5 mb-4 p-3" style={{ background: PAPER, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sigColor }}>{w.reasonLabel}</div>
                  </div>

                  <div className="mt-auto pt-4 grid grid-cols-3 gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div>
                      <MonoLabel>Violations</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{w.currentViolations.toLocaleString()}</div>
                    </div>
                    <div>
                      <MonoLabel>Trend</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sigColor, marginTop: 2, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingUp size={14} strokeWidth={2.5} />
                        {w.trend}%
                      </div>
                    </div>
                    <div>
                      <MonoLabel>On watch</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{w.daysOnWatch}d</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Six rankings */}
        {visibleLenses.length > 0 && (
          <section id="rankings" className="mb-14 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
              <div>
                <MonoLabel color={ACCENT.iris}>Section 03</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Six rankings
                </h2>
              </div>
              <MonoLabel>Top 3 each</MonoLabel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleLenses.map((strip, idx) => {
                const palette = [G.rose, G.amber, G.iris, G.peach, G.sky, G.mint][idx % 6];
                const accent = [ACCENT.rose, ACCENT.amber, ACCENT.iris, ACCENT.peach, ACCENT.sky, ACCENT.mint][idx % 6];
                const Icon = strip.icon;
                return (
                  <div key={strip.id} id={strip.id} className="p-5 sm:p-6" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span style={{ width: 36, height: 36, borderRadius: 12, background: palette, color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                          <Link href={buildHref({ sort: strip.sortKey, page: "1" })} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, fontWeight: 700, textDecoration: "none" }}>
                            {strip.description} →
                          </Link>
                        </div>
                      </div>
                    </div>
                    <ol className="m-0 p-0 list-none">
                      {strip.rows.map((r, i) => (
                        <li key={r.b.id} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                          <span style={{ width: 24, height: 24, borderRadius: 8, background: palette, color: accent, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <Link href={buildingUrl(r.b, city)} className="flex-1 min-w-0" style={{ textDecoration: "none", color: "inherit" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.b.full_address.split(",")[0]}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                              <span style={{ color: INK, fontWeight: 700 }}>
                                {strip.unit === "viol/unit" ? r.value.toFixed(2) : r.value.toLocaleString()}
                              </span>
                              <span style={{ textTransform: "lowercase" }}> {strip.unit}</span> · {r.sub}
                            </div>
                          </Link>
                          <ArrowUpRight size={16} style={{ color: INK_MUTE, flexShrink: 0 }} />
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* MOVERS — preview (mock data) */}
        <section id="movers" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MonoLabel color={ACCENT.mint}>Section 04</MonoLabel>
                <PreviewBadge />
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Movers
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Where the trajectory matters more than the snapshot. Last 90 days.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-6 sm:p-7" style={{ background: G.mint, borderRadius: 22 }}>
              <div className="flex items-center gap-3 mb-5">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.6)", color: ACCENT.mint, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingDown size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: INK }}>Most improved</h3>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>Violations dropped most in 90 days</div>
                </div>
              </div>
              <ol className="m-0 p-0 list-none">
                {MOVERS.improved.map((m, i) => (
                  <li key={m.address} className="flex items-center gap-3 py-3.5" style={{ borderTop: i > 0 ? `1px solid rgba(10,14,26,0.08)` : "none" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.7)", color: ACCENT.mint, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{m.address}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 2, letterSpacing: "0.04em" }}>
                        {m.borough} · {m.units} units · {m.current.toLocaleString()} violations
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT.mint, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingDown size={14} strokeWidth={2.5} />
                        {m.pct.toFixed(0)}%
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: INK_SOFT, letterSpacing: "0.06em" }}>
                        {m.delta.toLocaleString()} viol
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-6 sm:p-7" style={{ background: G.ember, borderRadius: 22 }}>
              <div className="flex items-center gap-3 mb-5">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.6)", color: ACCENT.red, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: INK }}>Worst deteriorated</h3>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>Violations spiked most in 90 days</div>
                </div>
              </div>
              <ol className="m-0 p-0 list-none">
                {MOVERS.deteriorated.map((m, i) => (
                  <li key={m.address} className="flex items-center gap-3 py-3.5" style={{ borderTop: i > 0 ? `1px solid rgba(10,14,26,0.08)` : "none" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.7)", color: ACCENT.red, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{m.address}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 2, letterSpacing: "0.04em" }}>
                        {m.borough} · {m.units} units · {m.current.toLocaleString()} violations
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT.red, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingUp size={14} strokeWidth={2.5} />
                        +{m.pct.toFixed(0)}%
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: INK_SOFT, letterSpacing: "0.06em" }}>
                        +{m.delta.toLocaleString()} viol
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* BY ERA & SIZE — preview (mock data) */}
        <section id="era-size" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MonoLabel color={ACCENT.sky}>Section 05</MonoLabel>
                <PreviewBadge />
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                By era & size
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Find your kind of building. Worst on the books, per category.
              </p>
            </div>
          </div>

          <div className="mb-3">
            <MonoLabel color={ACCENT.sky}>Construction era</MonoLabel>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {BY_ERA.map((e, idx) => {
              const palette = [G.peach, G.amber, G.sky, G.mint][idx];
              const accent = [ACCENT.peach, ACCENT.amber, ACCENT.sky, ACCENT.mint][idx];
              return (
                <div key={e.era} className="p-5 flex flex-col" style={{ background: palette, borderRadius: 18, color: "inherit", minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <Calendar size={16} style={{ color: accent }} strokeWidth={2.25} />
                    <MonoLabel color={accent}>{compact(e.buildings)} bldg</MonoLabel>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                    {e.era}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 4, letterSpacing: "0.06em" }}>
                    {e.range}
                  </div>
                  <div className="mt-auto pt-4" style={{ borderTop: `1px solid rgba(10,14,26,0.08)` }}>
                    <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 4 }}>Worst on record</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.topAddress}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: accent, marginTop: 2, letterSpacing: "0.04em", fontWeight: 700 }}>
                      {e.topViolations.toLocaleString()} VIOL · {e.topYear}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-3 mt-6">
            <MonoLabel color={ACCENT.iris}>Building size</MonoLabel>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BY_SIZE.map((s, idx) => {
              const palette = [G.iris, G.rose, G.graphite][idx];
              const accent = [ACCENT.iris, ACCENT.rose, "#fff"][idx];
              const ink = idx === 2 ? "#fff" : INK;
              const inkSoft = idx === 2 ? "rgba(255,255,255,0.7)" : INK_SOFT;
              const borderC = idx === 2 ? "rgba(255,255,255,0.15)" : "rgba(10,14,26,0.08)";
              return (
                <div key={s.size} className="p-6 flex flex-col" style={{ background: palette, borderRadius: 20, color: ink, minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Layers size={16} style={{ color: accent }} strokeWidth={2.25} />
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
                        {s.size}
                      </span>
                    </span>
                    <MonoLabel color={inkSoft}>{compact(s.buildings)} bldg</MonoLabel>
                  </div>
                  <div style={{ fontSize: 13, color: inkSoft, marginBottom: 12 }}>
                    {s.range}
                  </div>
                  <div className="mt-auto">
                    <div style={{ fontSize: 11, color: inkSoft, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                      Worst on record
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: ink, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                      {s.topAddress}
                    </div>
                    <div className="mt-3 pt-3 grid grid-cols-2 gap-3" style={{ borderTop: `1px solid ${borderC}` }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {compact(s.topViolations)}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: inkSoft, letterSpacing: "0.06em" }}>VIOLATIONS</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {s.topPerUnit.toFixed(2)}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: inkSoft, letterSpacing: "0.06em" }}>PER UNIT</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BOROUGH BREAKDOWN */}
        {boroughBreakdown.length > 0 && (
          <section id="boroughs" className="mb-14 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
              <div>
                <MonoLabel color={ACCENT.amber}>Section 06</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  {meta.regionLabel} breakdown
                </h2>
                <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                  Where the worst clusters. Top 3 per {meta.regionLabel.toLowerCase()}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {boroughBreakdown.map((b, idx) => {
                const palette = [G.rose, G.iris, G.sky, G.amber, G.mint][idx % 5];
                const accent = [ACCENT.rose, ACCENT.iris, ACCENT.sky, ACCENT.amber, ACCENT.mint][idx % 5];
                const span = idx === 0 ? "col-span-12 lg:col-span-7" : idx === 1 ? "col-span-12 sm:col-span-6 lg:col-span-5" : "col-span-12 sm:col-span-6 lg:col-span-4";
                return (
                  <Link key={b.name} href={buildHref({ borough: b.name, page: "1" })} className={`${span} p-6 flex flex-col`} style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 240 }}>
                    <div className="flex items-baseline justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} style={{ color: accent }} strokeWidth={2.25} />
                        <h3 style={{ fontSize: idx === 0 ? 26 : 18, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
                          {b.name}
                        </h3>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: idx === 0 ? 28 : 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", lineHeight: 1 }}>
                          {compact(b.violations)}
                        </div>
                        <MonoLabel color={INK_SOFT}>top-3 viol</MonoLabel>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: INK_SOFT, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                      {compact(b.buildings)} buildings indexed
                    </div>
                    <ol className="m-0 p-0 list-none mt-auto">
                      {b.top3.map((t, i) => (
                        <li key={t.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid rgba(10,14,26,0.08)` }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.7)", color: accent, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.full_address.split(",")[0]}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                              <span style={{ color: accent, fontWeight: 700 }}>{t.violation_count.toLocaleString()}</span> viol{t.total_units ? ` · ${t.total_units.toLocaleString()} units` : ""}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* TOP 10 ZIP CODES — preview (mock data) */}
        <section id="zips" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MonoLabel color={ACCENT.iris}>Section 07</MonoLabel>
                <PreviewBadge />
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Top 10 zip codes
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                By violation density (per 1,000 units). Where you really don&rsquo;t want to land.
              </p>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
            <div className="hidden sm:grid" style={{ gridTemplateColumns: "60px 72px 1fr 120px 120px 120px", gap: 16, padding: "12px 24px", background: PAPER, borderBottom: `1px solid ${BORDER}` }}>
              <MonoLabel>#</MonoLabel>
              <MonoLabel>Zip</MonoLabel>
              <MonoLabel>Neighborhood</MonoLabel>
              <MonoLabel>Buildings</MonoLabel>
              <MonoLabel>Violations</MonoLabel>
              <MonoLabel>Per 1K units</MonoLabel>
            </div>
            <ol className="m-0 p-0 list-none">
              {TOP_ZIPS.map((z, idx) => {
                const heat = z.perKUnit > 130 ? ACCENT.red : z.perKUnit > 110 ? ACCENT.ember : z.perKUnit > 95 ? ACCENT.peach : ACCENT.amber;
                const heatBg = z.perKUnit > 130 ? G.ember : z.perKUnit > 110 ? G.peach : z.perKUnit > 95 ? G.amber : G.amber;
                return (
                  <li key={z.zip} style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                    <div
                      className="zip-row"
                      style={{ display: "grid", alignItems: "center", gap: 16, padding: "16px 24px", color: "inherit" }}
                    >
                      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: idx < 3 ? ACCENT.rose : INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        {String(z.rank).padStart(2, "0")}
                      </span>
                      <span className="zip-code" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                        {z.zip}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {z.neighborhood}
                        </div>
                        <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 2 }}>
                          <span className="zip-mobile">{z.zip} · </span>{z.borough}
                        </div>
                      </div>
                      <span className="zip-bldg" style={{ fontFamily: MONO, fontSize: 13, color: INK_SOFT, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                        {z.buildings.toLocaleString()}
                      </span>
                      <span className="zip-viol" style={{ fontFamily: MONO, fontSize: 13, color: INK, fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                        {compact(z.violations)}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, padding: "4px 10px", borderRadius: 999, background: heatBg, color: heat, fontFamily: MONO, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                          {z.perKUnit}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <style>{`
              .zip-row { grid-template-columns: 50px 1fr 80px; }
              .zip-code, .zip-bldg, .zip-viol { display: none; }
              @media (min-width: 640px) {
                .zip-row { grid-template-columns: 60px 72px 1fr 120px 120px 120px; }
                .zip-code, .zip-bldg, .zip-viol { display: inline; }
                .zip-mobile { display: none; }
              }
            `}</style>
          </div>
        </section>

        {/* COMPLAINT CLOUD — preview (mock data) */}
        <section id="complaints" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MonoLabel color={ACCENT.rose}>Section 08</MonoLabel>
                <PreviewBadge />
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                What people complain about
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Every 311 call last year, by category. Heat dominates everything.
              </p>
            </div>
            <MonoLabel>{compact(totalComplaintsEstimate)} buildings flagged</MonoLabel>
          </div>

          <div className="grid grid-cols-12 grid-flow-row-dense gap-3 auto-rows-[110px]">
            {COMPLAINT_CLOUD.map((c, idx) => {
              const span =
                c.size === "xl" ? "col-span-12 sm:col-span-7 row-span-2" :
                c.size === "lg" ? "col-span-12 sm:col-span-5 row-span-2" :
                c.size === "md" ? "col-span-6 sm:col-span-4 row-span-2" :
                c.size === "sm" ? "col-span-6 sm:col-span-3 row-span-1" :
                "col-span-6 sm:col-span-3 row-span-1";

              const palette = c.size === "xl"
                ? G.rose
                : c.size === "lg"
                ? [G.amber, G.iris][idx % 2]
                : c.size === "md"
                ? [G.sky, G.peach, G.mint][idx % 3]
                : c.size === "sm"
                ? [G.amber, G.iris, G.peach][idx % 3]
                : [G.sky, G.mint, G.amber, G.peach][idx % 4];

              const accent = c.size === "xl"
                ? ACCENT.rose
                : c.size === "lg"
                ? [ACCENT.amber, ACCENT.iris][idx % 2]
                : c.size === "md"
                ? [ACCENT.sky, ACCENT.peach, ACCENT.mint][idx % 3]
                : c.size === "sm"
                ? [ACCENT.amber, ACCENT.iris, ACCENT.peach][idx % 3]
                : [ACCENT.sky, ACCENT.mint, ACCENT.amber, ACCENT.peach][idx % 4];

              const titleSize =
                c.size === "xl" ? "clamp(28px, 3.6vw, 48px)" :
                c.size === "lg" ? "clamp(20px, 2.4vw, 32px)" :
                c.size === "md" ? "clamp(16px, 1.6vw, 22px)" :
                c.size === "sm" ? "15px" : "13px";

              const valueSize =
                c.size === "xl" ? "clamp(48px, 6vw, 80px)" :
                c.size === "lg" ? "clamp(36px, 4vw, 52px)" :
                c.size === "md" ? "clamp(24px, 2.6vw, 32px)" :
                c.size === "sm" ? "20px" : "16px";

              return (
                <div
                  key={c.category}
                  className={`${span} flex flex-col justify-between`}
                  style={{
                    background: palette,
                    borderRadius: c.size === "xl" || c.size === "lg" ? 22 : 16,
                    padding: c.size === "xl" ? "28px" : c.size === "lg" ? "22px" : c.size === "md" ? "18px" : "14px",
                    color: "inherit",
                  }}
                >
                  <div>
                    <MonoLabel color={accent}>{c.share.toFixed(1)}% of all calls</MonoLabel>
                    <h3 style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.025em", margin: "8px 0 0", color: INK }}>
                      {c.size === "xs" || c.size === "sm" ? c.short : c.category}
                    </h3>
                  </div>
                  <div className="mt-auto pt-3 flex items-baseline justify-between">
                    <div style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                      {compact(c.count)}
                    </div>
                    {(c.size === "xl" || c.size === "lg") && (
                      <ArrowUpRight size={20} style={{ color: accent }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tenant favorites */}
        {favorites.length > 0 && (
          <section id="best" className="mb-14 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
              <div>
                <MonoLabel color={ACCENT.mint}>Section 09</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Tenant favorites
                </h2>
              </div>
              <MonoLabel>Top {favorites.length} by rating · {favReviewMin}+ reviews</MonoLabel>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {favorites.map((b, idx) => (
                <Link key={b.id} href={buildingUrl(b, city)} className="p-5 flex flex-col" style={{ background: G.mint, borderRadius: 18, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: ACCENT.mint, fontWeight: 700 }}>
                      NO. {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Sparkles size={14} style={{ color: ACCENT.mint }} />
                  </div>
                  <h3 style={{ fontSize: 14, lineHeight: 1.2, margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {b.full_address.split(",")[0]}
                  </h3>
                  <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4 }}>
                    {b.borough}{b.year_built ? ` · built ${b.year_built}` : ""}
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 14 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {b.overall_score ? normalizeScore(b.overall_score).toFixed(1) : "—"}
                      <span style={{ fontSize: 16, color: ACCENT.mint }}>★</span>
                    </div>
                    <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {b.review_count} reviews
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Directory */}
        <section id="directory" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.sky}>Section 10</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Browse the directory
              </h2>
            </div>
            <MonoLabel>{compact(totalBuildings)} total · sorted by {sortOption.label.toLowerCase()}</MonoLabel>
          </div>

          {/* Sort pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.key;
              return (
                <Link
                  key={opt.key}
                  href={buildHref({ sort: opt.key, page: "1" })}
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
          </div>

          {/* Borough filter pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            <Link
              href={buildHref({ borough: "all", page: "1" })}
              className="px-3 py-1.5 text-sm transition-colors"
              style={{
                background: borough === "all" ? INK : "#fff",
                color: borough === "all" ? "#fff" : INK_SOFT,
                borderRadius: 8,
                border: `1px solid ${borough === "all" ? INK : BORDER}`,
                fontFamily: SANS,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              All {meta.regionLabel.toLowerCase()}s
            </Link>
            {cityRegions.slice(0, 12).map((r) => {
              const active = borough === r;
              return (
                <Link
                  key={r}
                  href={buildHref({ borough: r, page: "1" })}
                  className="px-3 py-1.5 text-sm transition-colors"
                  style={{
                    background: active ? INK : "#fff",
                    color: active ? "#fff" : INK_SOFT,
                    borderRadius: 8,
                    border: `1px solid ${active ? INK : BORDER}`,
                    fontFamily: SANS,
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {r}
                </Link>
              );
            })}
          </div>

          {directoryRows.length > 0 ? (
            <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
              <ol className="m-0 p-0 list-none">
                {directoryRows.map((b, idx) => {
                  const rank = offset + idx + 1;
                  const perUnitVal = b.total_units ? b.violation_count / b.total_units : 0;
                  return (
                    <li key={b.id} className="relative group transition-colors hover:bg-[#fafbfd]" style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                      <Link
                        href={buildingUrl(b, city)}
                        aria-label={`Open ${b.full_address.split(",")[0]}`}
                        className="absolute inset-0 z-0"
                        style={{ textDecoration: "none" }}
                      />
                      <div className="relative z-10 flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 pointer-events-none">
                        <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                          {String(rank).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 2px", color: INK, letterSpacing: "-0.005em" }}>
                            {b.full_address.split(",")[0]}
                          </h3>
                          <div style={{ fontSize: 12, color: INK_MUTE, marginBottom: 6 }}>
                            {b.borough}
                            {b.zip_code ? ` · ${b.zip_code}` : ""}
                            {b.total_units ? ` · ${b.total_units.toLocaleString()} units` : ""}
                            {b.owner_name ? (
                              <>
                                {" · "}
                                <Link
                                  href={landlordUrl(b.owner_name, city)}
                                  className="pointer-events-auto"
                                  style={{ color: INK_SOFT, textDecoration: "underline", textDecorationColor: BORDER }}
                                >
                                  {b.owner_name}
                                </Link>
                              </>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                            <span><span style={{ color: ACCENT.rose, fontWeight: 700 }}>{b.violation_count.toLocaleString()}</span> viol</span>
                            <span><span style={{ color: ACCENT.amber, fontWeight: 700 }}>{b.complaint_count.toLocaleString()}</span> calls</span>
                            <span><span style={{ color: ACCENT.iris, fontWeight: 700 }}>{b.eviction_count}</span> evict</span>
                            <span><span style={{ color: ACCENT.peach, fontWeight: 700 }}>{b.litigation_count}</span> cases</span>
                            {sortBy === "per-unit" && (
                              <span><span style={{ color: INK, fontWeight: 700 }}>{perUnitVal.toFixed(2)}</span> /unit</span>
                            )}
                          </div>
                        </div>
                        <span className="hidden sm:inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: PAPER, color: INK_MUTE }}>
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="p-12 text-center" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
              <Building2 size={32} style={{ color: INK_MUTE, margin: "0 auto 10px" }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>No buildings found</h3>
              <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>
                Try a different sort or {meta.regionLabel.toLowerCase()} filter.
              </p>
            </div>
          )}

          {(pageNum > 1 || hasNextPage) && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: INK_MUTE, textTransform: "uppercase" }}>
                Page {pageNum}
              </span>
              <div className="flex gap-2">
                {pageNum > 1 ? (
                  <Link href={buildHref({ page: String(pageNum - 1) })} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ background: "#fff", color: INK_SOFT, borderRadius: 12, border: `1px solid ${BORDER}`, textDecoration: "none" }}>
                    <ChevronLeft size={14} /> Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ color: "#cbd5e1", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                    <ChevronLeft size={14} /> Previous
                  </span>
                )}
                {hasNextPage ? (
                  <Link href={buildHref({ page: String(pageNum + 1) })} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold" style={{ background: "#fff", color: INK_SOFT, borderRadius: 12, border: `1px solid ${BORDER}`, textDecoration: "none" }}>
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

        {/* CTA */}
        <section className="p-8 sm:p-12 text-center" style={{ background: G.graphite, borderRadius: 28, color: "#fff" }}>
          <MonoLabel color="rgba(255,255,255,0.5)">Tenant testimony</MonoLabel>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "12px 0 16px", fontWeight: 700 }}>
            Review your building.
          </h2>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(255,255,255,0.7)", maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Public records show what was reported. Reviews from former tenants show what it was actually like.
            Two minutes saves the next renter from a year of mistakes.
          </p>
          <Link href={cityPath("/review/new", city)} className="inline-flex items-center gap-2 px-7 py-4 font-semibold" style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)", color: "#fff", borderRadius: 14, fontSize: 16, textDecoration: "none" }}>
            Write a review
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </section>
      </div>
    </main>
  );
}

// Suppress unused import warnings — kept for parity with the mock's icon set
void Snowflake;
void Quote;
void Gavel;
