"use client";

/**
 * Client-side wrapper for the building-rankings directory section. Reads
 * sort / borough / page from useSearchParams and fetches from
 * /api/building-rankings (edge runtime). By moving the searchParams reads
 * off the server tree, the parent page becomes statically prerenderable.
 *
 * Also renders the sort selector (with active highlight) and the borough
 * filter — so those UI controls update correctly when the URL changes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

/* Style tokens — mirror DirectorySection so the rendered output matches. */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const BORDER = "rgba(10,14,26,0.08)";
const ACCENT = {
  rose: "#ec4899",
  iris: "#7c3aed",
  sky: "#3b82f6",
  amber: "#f59e0b",
  peach: "#f97316",
};
const SHADOW =
  "0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -12px rgba(10,14,26,0.08)";

function MonoLabel({
  children,
  color = INK_MUTE,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        fontWeight: 600,
      }}
    >
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
  { key: "violations", label: "Violations", col: "violation_count" },
  { key: "complaints", label: "Complaints", col: "complaint_count" },
  { key: "evictions", label: "Evictions", col: "eviction_count" },
  { key: "lawsuits", label: "Lawsuits", col: "litigation_count" },
  { key: "per-unit", label: "Per-unit", col: "violation_count" },
] as const;

interface ApiResponse {
  buildings: BuildingRow[];
  page: number;
  perPage: number;
  count: number;
  totalPages: number;
}

interface Props {
  city: City;
  basePath: string;
  regionLabel: string;
  cityRegions: readonly string[];
}

export function DirectoryClient({ city, basePath, regionLabel, cityRegions }: Props) {
  const sp = useSearchParams();
  const sortBy = sp.get("sort") || "violations";
  const borough = sp.get("borough") || "all";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams({ city, sort: sortBy, page: String(page) });
    if (borough !== "all") qs.set("borough", borough);
    return `/api/building-rankings?${qs.toString()}`;
  }, [city, sortBy, borough, page]);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    fetch(apiUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: ApiResponse) => {
        if (myId !== reqIdRef.current) return;
        setData(json);
        setIsLoading(false);
      })
      .catch(() => {
        if (myId !== reqIdRef.current) return;
        setIsLoading(false);
      });
  }, [apiUrl]);

  // URL builder for sort/borough/page links — strips defaults so canonical
  // URLs stay clean.
  function buildHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      borough,
      sort: sortBy,
      page: String(page),
      ...overrides,
    };
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

  const rows = data?.buildings ?? [];
  const totalPages = data?.totalPages ?? 1;
  const offset = (page - 1) * 25;

  // Apply per-unit sort in-app if selected
  const displayRows =
    sortBy === "per-unit"
      ? [...rows]
          .filter((b) => (b.total_units ?? 0) > 0)
          .sort(
            (a, b) =>
              b.violation_count / (b.total_units || 1) -
              a.violation_count / (a.total_units || 1),
          )
      : rows;

  const sortOptionLabel =
    SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "Violations";

  return (
    <section id="directory" className="mb-16 scroll-mt-24">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <MonoLabel color={ACCENT.sky}>Section · Directory</MonoLabel>
          <h2
            style={{
              fontSize: "clamp(28px, 3.5vw, 44px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              margin: "6px 0 0",
              fontWeight: 700,
              color: INK,
            }}
          >
            Every ranked building
          </h2>
        </div>
        <MonoLabel>
          sorted by {sortOptionLabel.toLowerCase()}
          {borough !== "all" ? ` · ${borough}` : ""}
        </MonoLabel>
      </div>

      {/* Sort selector */}
      <div className="flex flex-wrap gap-2 mb-4">
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

      {/* Borough filter */}
      {cityRegions.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={buildHref({ borough: "all", page: "1" })}
            className="px-3 py-1.5 text-xs font-semibold"
            style={{
              background: borough === "all" ? INK : "transparent",
              color: borough === "all" ? "#fff" : INK_MUTE,
              borderRadius: 999,
              border: `1px solid ${borough === "all" ? INK : BORDER}`,
              fontFamily: MONO,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            All {regionLabel.toLowerCase()}s
          </Link>
          {cityRegions.map((r) => {
            const active = borough === r;
            return (
              <Link
                key={r}
                href={buildHref({ borough: r, page: "1" })}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: active ? INK : "transparent",
                  color: active ? "#fff" : INK_MUTE,
                  borderRadius: 999,
                  border: `1px solid ${active ? INK : BORDER}`,
                  fontFamily: MONO,
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {r}
              </Link>
            );
          })}
        </div>
      )}

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-[#f1f5f9] animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : displayRows.length === 0 ? (
        <div className="border border-dashed border-[#e2e8f0] rounded-lg p-12 text-center">
          <p className="text-[#64748b]">
            No buildings match this filter. Try another sort or borough.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            border: `1px solid ${BORDER}`,
            boxShadow: SHADOW,
            overflow: "hidden",
            opacity: isLoading ? 0.6 : 1,
            transition: "opacity 150ms",
          }}
        >
          <ol className="m-0 p-0 list-none">
            {displayRows.map((b, idx) => {
              const rank = offset + idx + 1;
              const sortVal =
                sortBy === "complaints"
                  ? b.complaint_count
                  : sortBy === "evictions"
                    ? b.eviction_count
                    : sortBy === "lawsuits"
                      ? b.litigation_count
                      : sortBy === "per-unit"
                        ? Math.round(
                            (b.violation_count / (b.total_units || 1)) * 100,
                          ) / 100
                        : b.violation_count;
              const unit =
                sortBy === "complaints"
                  ? "calls"
                  : sortBy === "evictions"
                    ? "filings"
                    : sortBy === "lawsuits"
                      ? "cases"
                      : sortBy === "per-unit"
                        ? "viol/unit"
                        : "viol";
              return (
                <li
                  key={b.id}
                  style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}
                >
                  <Link
                    href={buildingUrl(b, city)}
                    className="group flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-[#fafbfd]"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span
                      style={{
                        minWidth: 40,
                        fontFamily: MONO,
                        fontSize: 18,
                        fontWeight: 700,
                        color: INK_MUTE,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(rank).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3
                        style={{
                          fontSize: "clamp(15px, 1.4vw, 18px)",
                          fontWeight: 700,
                          margin: "0 0 4px",
                          color: INK,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.full_address}
                      </h3>
                      <div
                        className="flex flex-wrap gap-x-4 gap-y-1"
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: INK_MUTE,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span>{b.borough || "—"}</span>
                        {b.total_units && (
                          <span>{b.total_units.toLocaleString()} units</span>
                        )}
                        {b.year_built && <span>Built {b.year_built}</span>}
                        {b.owner_name && (
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 220,
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = landlordUrl(
                                b.owner_name!,
                                city,
                              );
                            }}
                          >
                            {b.owner_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 14,
                          fontWeight: 700,
                          color: INK,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {sortVal.toLocaleString()}
                      </div>
                      <MonoLabel>{unit}</MonoLabel>
                      <ArrowUpRight size={16} style={{ color: INK_MUTE }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 gap-4">
          {page > 1 ? (
            <Link
              href={buildHref({ page: String(page - 1) })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
              style={{
                background: "#fff",
                color: INK,
                borderRadius: 999,
                border: `1px solid ${BORDER}`,
                textDecoration: "none",
              }}
            >
              <ChevronLeft size={16} />
              Previous
            </Link>
          ) : (
            <span style={{ visibility: "hidden" }} />
          )}
          <MonoLabel>
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
          </MonoLabel>
          {page < totalPages ? (
            <Link
              href={buildHref({ page: String(page + 1) })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
              style={{
                background: INK,
                color: "#fff",
                borderRadius: 999,
                border: `1px solid ${INK}`,
                textDecoration: "none",
              }}
            >
              Next
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span style={{ visibility: "hidden" }} />
          )}
        </div>
      )}
    </section>
  );
}
