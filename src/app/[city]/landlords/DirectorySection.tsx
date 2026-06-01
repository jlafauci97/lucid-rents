import Link from "next/link";
import { ArrowUpRight, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { GARBAGE_NOT_IN } from "@/lib/landlord-garbage-names";

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
  amber: "#f59e0b",
};
const SHADOW = "0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -12px rgba(10,14,26,0.08)";

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </span>
  );
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

const SORT_OPTIONS = [
  { key: "violations",  label: "Violations",  col: "total_violations" },
  { key: "complaints",  label: "Complaints",  col: "total_complaints" },
  { key: "litigations", label: "Litigations", col: "total_litigations" },
  { key: "dob",         label: "DOB",         col: "total_dob_violations" },
  { key: "buildings",   label: "Buildings",   col: "building_count" },
] as const;

interface DirectorySectionProps {
  city: City;
  search: string;
  sortBy: string;
  page: number;
  basePath: string;
  sortOptionLabel: string;
  total: number;
  totalPages: number;
}

export async function DirectorySection({
  city,
  search,
  sortBy,
  page,
  basePath,
  sortOptionLabel,
  total,
  totalPages,
}: DirectorySectionProps) {
  const limit = 25;
  const offset = (page - 1) * limit;

  const sortOption = SORT_OPTIONS.find((o) => o.key === sortBy) ?? SORT_OPTIONS[0];
  const supabase = createCacheClient();

  const baseSelect =
    "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations";

  let dataQuery = supabase
    .from("landlord_stats_canonical")
    .select(baseSelect)
    .eq("metro", city)
    .not("name", "in", GARBAGE_NOT_IN)
    .order(sortOption.col, { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  const { data: landlords } = await dataQuery;
  const rows = (landlords ?? []) as LandlordRow[];

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
    <section className="mb-10 sm:mb-14">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <MonoLabel color="#3b82f6">Section 03</MonoLabel>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
            Browse the directory
          </h2>
        </div>
        <MonoLabel>{total.toLocaleString()} total · sorted by {sortOptionLabel.toLowerCase()}</MonoLabel>
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
  );
}
