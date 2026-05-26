"use client";

/**
 * Client-side wrapper for the landlords directory section. Reads sort / page /
 * search from useSearchParams() and fetches paginated data from
 * /api/landlords (already cached at the CDN via next.config.ts Cache-Control).
 *
 * Replaces the previous server-rendered DirectorySection: by moving the
 * searchParams reads off the server tree, the parent page becomes
 * static-prerenderable across all 5 cities. The cached API endpoint serves
 * paginated variants from the edge so this client fetch is still fast on
 * repeat hits.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

/* Style tokens — mirror DirectorySection.tsx so the rendered output is
   visually identical. */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const BORDER = "rgba(10,14,26,0.08)";
const ACCENT = {
  rose: "#ec4899",
  iris: "#7c3aed",
  amber: "#f59e0b",
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

const SORT_OPTIONS = [
  { key: "violations", label: "Violations" },
  { key: "complaints", label: "Complaints" },
  { key: "litigations", label: "Litigations" },
  { key: "dob", label: "DOB" },
  { key: "buildings", label: "Buildings" },
] as const;

interface ApiLandlord {
  name: string;
  buildingCount: number;
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  avgScore: number | null;
  worstBuilding?: {
    id: string | null;
    address: string | null;
    violations: number | null;
  };
}

interface ApiResponse {
  landlords: ApiLandlord[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

interface Props {
  city: City;
  basePath: string;
  /** Initial total landlords for the metro — passed from the static shell so
   *  the "of N total" copy renders without waiting for the first API call. */
  totalFallback: number;
}

export function DirectoryClient({ city, basePath, totalFallback }: Props) {
  const sp = useSearchParams();
  const sortBy = sp.get("sort") || "violations";
  const search = sp.get("search") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  // Build the API URL — /api/landlords is cached at the CDN with
  // s-maxage=600, stale-while-revalidate=3600 per next.config.ts. So even
  // though this is a client-side fetch, common pagination variants serve
  // from the edge cache.
  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams({
      city,
      sort: sortBy,
      page: String(page),
    });
    if (search) qs.set("search", search);
    return `/api/landlords?${qs.toString()}`;
  }, [city, sortBy, page, search]);

  // Plain useState + useEffect fetch with `keepPreviousData`-style behavior:
  // we keep showing the last successful response while a new fetch is in
  // flight, so pagination clicks don't blank out the table.
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    setError(null);
    fetch(apiUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        // Drop responses for stale requests so out-of-order fetches don't
        // overwrite newer data.
        if (myId !== reqIdRef.current) return;
        setData(json);
        setIsLoading(false);
      })
      .catch((err) => {
        if (myId !== reqIdRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
  }, [apiUrl]);

  const rows = data?.landlords ?? [];
  const total = data?.pagination?.total ?? totalFallback;
  const totalPages = data?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / limit));
  const sortOptionLabel =
    SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "Violations";

  // Build a URL for sort / page links — preserves the other params and
  // strips defaults so canonical URLs stay clean.
  function url(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      search,
      sort: sortBy,
      page: String(page),
      ...overrides,
    };
    Object.keys(merged).forEach((k) => {
      if (
        !merged[k] ||
        (k === "page" && merged[k] === "1") ||
        (k === "sort" && merged[k] === "violations")
      ) {
        delete merged[k];
      }
    });
    const qs = new URLSearchParams(merged).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const prevHref = page > 1 ? url({ page: String(page - 1) }) : null;
  const nextHref = page < totalPages ? url({ page: String(page + 1) }) : null;

  return (
    <section className="mb-10 sm:mb-14">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <MonoLabel color="#3b82f6">Section 03</MonoLabel>
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
            Browse the directory
          </h2>
        </div>
        <MonoLabel>
          {total.toLocaleString()} total · sorted by{" "}
          {sortOptionLabel.toLowerCase()}
        </MonoLabel>
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
          <Link
            href={basePath}
            className="px-4 py-2 text-sm font-semibold"
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              borderRadius: 999,
              border: "1px solid #fecaca",
              textDecoration: "none",
            }}
          >
            Clear &ldquo;{search}&rdquo; ×
          </Link>
        )}
      </div>

      <p
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.06em",
          color: INK_MUTE,
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        {error
          ? "Couldn't load landlords. Try again."
          : isLoading && !data
            ? "Loading…"
            : rows.length > 0
              ? `Showing ${(offset + 1).toLocaleString()}–${Math.min(offset + rows.length, total).toLocaleString()} of ${total.toLocaleString()}${search ? ` matching "${search}"` : ""}`
              : "No landlords found"}
      </p>

      {rows.length > 0 ? (
        <>
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
              {rows.map((l, idx) => {
                const rank = offset + idx + 1;
                return (
                  <li
                    key={l.name}
                    style={{
                      borderTop: idx > 0 ? `1px solid ${BORDER}` : "none",
                    }}
                  >
                    <Link
                      href={landlordUrl(l.name, city)}
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
                            margin: "0 0 6px",
                            color: INK,
                            letterSpacing: "-0.005em",
                          }}
                        >
                          {l.name}
                        </h3>
                        <div
                          className="flex flex-wrap gap-x-5 gap-y-1"
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            color: INK_MUTE,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          <span>
                            <span style={{ color: ACCENT.rose, fontWeight: 700 }}>
                              {l.totalViolations.toLocaleString()}
                            </span>{" "}
                            viol
                          </span>
                          <span>
                            <span style={{ color: ACCENT.amber, fontWeight: 700 }}>
                              {l.totalComplaints.toLocaleString()}
                            </span>{" "}
                            calls
                          </span>
                          <span>
                            <span style={{ color: ACCENT.iris, fontWeight: 700 }}>
                              {l.totalLitigations.toLocaleString()}
                            </span>{" "}
                            cases
                          </span>
                          <span>
                            <span style={{ color: INK, fontWeight: 700 }}>
                              {l.buildingCount.toLocaleString()}
                            </span>{" "}
                            bldg
                          </span>
                          {l.worstBuilding?.address && (
                            <span style={{ color: INK_MUTE, opacity: 0.85 }}>
                              worst:{" "}
                              <span style={{ color: INK_SOFT }}>
                                {l.worstBuilding.address.split(",")[0]}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-3">
                        {l.avgScore !== null && (
                          <LetterGrade score={l.avgScore} size="sm" />
                        )}
                        <ArrowUpRight
                          size={18}
                          style={{ color: INK_MUTE, flexShrink: 0 }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 gap-4">
              {prevHref ? (
                <Link
                  href={prevHref}
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
              {nextHref ? (
                <Link
                  href={nextHref}
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
        </>
      ) : isLoading && !data ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            border: `1px solid ${BORDER}`,
            padding: 32,
            textAlign: "center",
            color: INK_MUTE,
          }}
        >
          <Trophy size={28} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <MonoLabel>Loading directory…</MonoLabel>
        </div>
      ) : null}
    </section>
  );
}
