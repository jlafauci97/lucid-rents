import Link from "next/link";
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

/* ─── Bento style tokens (subset used by this section) ─────────── */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const PAPER = "#fafbfd";
const BORDER = "rgba(10,14,26,0.08)";
const ACCENT = {
  rose:  "#ec4899",
  iris:  "#7c3aed",
  sky:   "#3b82f6",
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

interface DirectorySectionProps {
  city: City;
  sortBy: string;
  borough: string;
  pageNum: number;
  basePath: string;
  sortOptionLabel: string;
  regionLabel: string;
  cityRegions: readonly string[];
  totalBuildings: number;
}

export async function DirectorySection({
  city,
  sortBy,
  borough,
  pageNum,
  basePath,
  sortOptionLabel,
  regionLabel,
  cityRegions,
  totalBuildings,
}: DirectorySectionProps) {
  const limit = 25;
  const offset = (pageNum - 1) * limit;
  const metro = city;
  const supabase = createCacheClient();

  const baseSelect =
    "id, full_address, borough, zip_code, slug, year_built, total_units, owner_name, violation_count, complaint_count, eviction_count, litigation_count, bedbug_report_count, overall_score, review_count";

  // ─── directory (paginated) ────────────────────────────────────────────
  // With the partial composite indexes from
  // 20260428300000_buildings_landlord_perf_indexes.sql in place, every
  // sortable column (violations / complaints / evictions / litigations /
  // bedbug) is fast to ORDER BY DESC under filter. The page no longer has
  // to fall back to re-sorting a top-200 cached pool in app code — this
  // removes the 8-page cap on non-violations sorts.
  async function fetchDirectory(): Promise<{ data: BuildingRow[] | null }> {
    const base = supabase
      .from("buildings")
      .select(baseSelect)
      .eq("metro", metro);
    const filtered = borough !== "all" ? base.eq("borough", borough) : base;

    // Map sort key → indexed column. Per-unit still uses violation_count
    // as a rough DB ordering proxy; we refine to true viol/unit in app
    // within the fetched window below.
    const sortColumn =
      sortBy === "per-unit" ? "violation_count" :
      sortBy === "complaints" ? "complaint_count" :
      sortBy === "evictions" ? "eviction_count" :
      sortBy === "lawsuits" ? "litigation_count" :
      sortBy === "bedbug" ? "bedbug_report_count" :
      "violation_count";

    const withFilter =
      sortBy === "per-unit"
        ? filtered.gt("violation_count", 0).gt("total_units", 0)
        : filtered.gt(sortColumn, 0);

    const { data } = await withFilter
      .order(sortColumn, { ascending: false })
      .range(offset, offset + limit);
    return { data: (data ?? []) as BuildingRow[] };
  }

  const dirRes = await fetchDirectory();

  // With the new partial composite indexes (see migration
  // 20260428300000_buildings_landlord_perf_indexes.sql), every sort
  // column hits a fast indexed range scan. Just use the DB result.
  // Per-unit still gets a final in-app refinement to true viol/unit
  // within the fetched window.
  const dirRowsRaw = (dirRes.data ?? []) as BuildingRow[];
  const hasNextPage = dirRowsRaw.length > limit;
  let directoryRows = dirRowsRaw.slice(0, limit);
  if (sortBy === "per-unit") {
    directoryRows = [...directoryRows].sort(
      (a, b) =>
        b.violation_count / (b.total_units || 1) - a.violation_count / (a.total_units || 1)
    );
  }

  // ─── url helper for filter/sort/page links ────────────────────────────
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

  return (
    <section id="directory" className="mb-14 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
        <div>
          <MonoLabel color={ACCENT.sky}>Section 10</MonoLabel>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
            Browse the directory
          </h2>
        </div>
        <MonoLabel>{compact(totalBuildings)} total · sorted by {sortOptionLabel.toLowerCase()}</MonoLabel>
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
          All {regionLabel.toLowerCase()}s
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
            Try a different sort or {regionLabel.toLowerCase()} filter.
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
  );
}
