"use client";

/**
 * Client-side wrapper for the paginated buildings list on
 * /[city]/building-list/[chip]. Reads sort / page from useSearchParams and
 * fetches from /api/building-list/[chip] (edge runtime, CDN-cached).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BuildingCard } from "@/components/search/BuildingCard";
import type { Building } from "@/types";

interface Props {
  chipSlug: string;
  city: string;
  basePath: string;
  /** Initial count fallback so the static shell shows a sensible "N buildings"
   *  before the first client fetch resolves. */
  countFallback: number;
}

interface ApiResponse {
  buildings: Building[];
  page: number;
  perPage: number;
  count: number;
  totalPages: number;
}

const SORT_OPTIONS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "LucidIQ" },
  { key: "reviews", label: "Reviews" },
  { key: "year", label: "Year built" },
  { key: "units", label: "Units" },
];

export function BuildingsClient({ chipSlug, city, basePath, countFallback }: Props) {
  const sp = useSearchParams();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const sort = sp.get("sort") || undefined;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    const qs = new URLSearchParams({ city, page: String(page) });
    if (sort) qs.set("sort", sort);
    fetch(`/api/building-list/${chipSlug}?${qs.toString()}`)
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
  }, [chipSlug, city, sort, page]);

  const buildings = data?.buildings ?? [];
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(countFallback / 30));

  return (
    <>
      {/* Sort bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SORT_OPTIONS.map((opt) => {
          const href = opt.key === undefined ? basePath : `${basePath}?sort=${opt.key}`;
          const active = (sort ?? undefined) === opt.key;
          return (
            <Link
              key={opt.label}
              href={href}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                active
                  ? "bg-[#0F1D2E] text-white border-[#0F1D2E]"
                  : "text-[#0F1D2E] border-[#e2e8f0] hover:border-[#0F1D2E]"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-lg bg-[#f1f5f9] animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : buildings.length === 0 ? (
        <div className="border border-dashed border-[#e2e8f0] rounded-lg p-12 text-center">
          <p className="text-[#64748b]">
            No buildings match this filter yet. Try another category.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          style={{ opacity: isLoading ? 0.6 : 1, transition: "opacity 150ms" }}
        >
          {buildings.map((b) => (
            <BuildingCard key={b.id} building={b} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-10 text-sm">
          {page > 1 && (
            <Link
              href={`${basePath}?${new URLSearchParams({
                ...(sort ? { sort } : {}),
                page: String(page - 1),
              }).toString()}`}
              className="px-4 py-2 border border-[#e2e8f0] rounded-full hover:border-[#0F1D2E] transition"
            >
              ← Prev
            </Link>
          )}
          <span className="text-[#64748b]">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`${basePath}?${new URLSearchParams({
                ...(sort ? { sort } : {}),
                page: String(page + 1),
              }).toString()}`}
              className="px-4 py-2 border border-[#e2e8f0] rounded-full hover:border-[#0F1D2E] transition"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
