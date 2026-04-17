"use client";

/**
 * Interactive filter for the /[city]/neighborhoods index.
 *
 * - Search input at the top.
 * - As the user types, neighborhoods whose name or zip matches the query
 *   are promoted into a "Matches" section at the very top, while
 *   non-matches fall out of view.
 * - When the query is empty, the default region-grouped listing renders.
 * - Search is case-insensitive and matches any substring in name OR zip.
 */

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MapPin, Search, X } from "lucide-react";

interface NeighborhoodItem {
  zipCode: string;
  name: string;
  region: string;
  slug: string;
}

interface Props {
  cityPrefix: string;
  regionLabel: string;
  items: NeighborhoodItem[];
}

export function NeighborhoodsFilter({ cityPrefix, regionLabel, items }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input with `/` keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = q.trim().toLowerCase();

  const { matches, groupedRest } = useMemo(() => {
    if (!trimmed) {
      // No query — show every item grouped by region, sorted alphabetically.
      const byRegion = new Map<string, NeighborhoodItem[]>();
      for (const n of items) {
        const arr = byRegion.get(n.region) ?? [];
        arr.push(n);
        byRegion.set(n.region, arr);
      }
      const grouped = [...byRegion.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([region, arr]) => [region, arr.sort((a, b) => a.name.localeCompare(b.name))] as const);
      return { matches: [], groupedRest: grouped };
    }
    const matched: NeighborhoodItem[] = [];
    const rest: NeighborhoodItem[] = [];
    for (const n of items) {
      const hit = n.name.toLowerCase().includes(trimmed) || n.zipCode.toLowerCase().includes(trimmed);
      if (hit) matched.push(n);
      else rest.push(n);
    }
    // Sort matches so exact-name-prefix wins, then by name length, then alpha.
    matched.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(trimmed) ? 0 : 1;
      const bStarts = bName.startsWith(trimmed) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (aName.length !== bName.length) return aName.length - bName.length;
      return aName.localeCompare(bName);
    });
    // Rest: group by region so the "everything else" area still has structure.
    const byRegion = new Map<string, NeighborhoodItem[]>();
    for (const n of rest) {
      const arr = byRegion.get(n.region) ?? [];
      arr.push(n);
      byRegion.set(n.region, arr);
    }
    const grouped = [...byRegion.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([region, arr]) => [region, arr.sort((a, b) => a.name.localeCompare(b.name))] as const);
    return { matches: matched, groupedRest: grouped };
  }, [trimmed, items]);

  return (
    <>
      {/* Search input */}
      <div className="mt-2 mb-8 relative max-w-xl">
        <div className="relative flex items-center gap-2 px-4 py-3 bg-white border border-[#e2e8f0] rounded-full shadow-sm focus-within:border-[#3B82F6] focus-within:ring-2 focus-within:ring-[#3B82F6]/20 transition">
          <Search className="w-4 h-4 text-[#64748b] flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Filter by neighborhood or zip… (press / to focus)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter neighborhoods"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-[#0F1D2E] placeholder-[#94a3b8] min-w-0"
          />
          {q ? (
            <button
              type="button"
              onClick={() => { setQ(""); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="flex-shrink-0 p-1 rounded-full text-[#94a3b8] hover:text-[#0F1D2E] hover:bg-[#f1f5f9] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
        {trimmed ? (
          <p className="mt-2 text-xs text-[#64748b] font-mono">
            {matches.length} match{matches.length === 1 ? "" : "es"} for &quot;{q.trim()}&quot;
            {matches.length === 0 ? " — try another neighborhood or zip." : ""}
          </p>
        ) : null}
      </div>

      {/* Matches block (only when filtering) */}
      {trimmed && matches.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[#0F1D2E] mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-[#3B82F6]" aria-hidden="true" />
            Matches
            <span className="text-sm font-normal text-[#64748b]">· {matches.length}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matches.map((n) => (
              <NeighborhoodCard key={n.zipCode} n={n} cityPrefix={cityPrefix} highlight={trimmed} showRegion />
            ))}
          </div>
        </section>
      ) : null}

      {/* Default / rest: grouped by region */}
      {!trimmed || groupedRest.length > 0 ? (
        <div className="space-y-10">
          {groupedRest.map(([region, nbhs]) => (
            <section key={region}>
              <h2 className="text-xl font-semibold text-[#0F1D2E] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#3B82F6]" aria-hidden="true" />
                {region}
                <span className="text-sm font-normal text-[#64748b]">· {nbhs.length} {regionLabel.toLowerCase()}{nbhs.length === 1 ? "" : "s"}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nbhs.map((n) => (
                  <NeighborhoodCard key={n.zipCode} n={n} cityPrefix={cityPrefix} highlight={trimmed} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-[#64748b] mb-2">No neighborhoods match &quot;{q.trim()}&quot;.</p>
          <button onClick={() => setQ("")} className="text-[#3B82F6] hover:underline text-sm font-medium">
            Clear search
          </button>
        </div>
      )}
    </>
  );
}

function NeighborhoodCard({
  n,
  cityPrefix,
  highlight,
  showRegion,
}: {
  n: NeighborhoodItem;
  cityPrefix: string;
  highlight: string;
  showRegion?: boolean;
}) {
  return (
    <Link
      href={`/${cityPrefix}/neighborhood/${n.slug}`}
      className="group flex items-center justify-between gap-3 p-4 bg-white border border-[#e2e8f0] rounded-lg hover:border-[#3B82F6] hover:shadow-sm transition"
    >
      <div className="min-w-0">
        <div className="font-medium text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition">
          <HighlightText text={n.name} highlight={highlight} />
        </div>
        <div className="text-xs text-[#64748b] font-mono mt-0.5">
          <HighlightText text={n.zipCode} highlight={highlight} />
          {showRegion ? <span className="ml-2 text-[#94a3b8]">· {n.region}</span> : null}
        </div>
      </div>
      <span className="text-[#94a3b8] group-hover:text-[#3B82F6] transition" aria-hidden="true">→</span>
    </Link>
  );
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(highlight);
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + highlight.length);
  const after = text.slice(idx + highlight.length);
  return (
    <>
      {before}
      <mark className="bg-[#dbeafe] text-[#0F1D2E] rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}
