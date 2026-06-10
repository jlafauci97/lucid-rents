"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2, Clock, Users } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useRecentBuildings } from "@/hooks/useRecentBuildings";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { deriveScore } from "@/lib/constants";
import { buildingUrl, cityPath, landlordUrl, neighborhoodUrl } from "@/lib/seo";
import { searchNeighborhoodsByCity, type NeighborhoodResult } from "@/lib/neighborhoods";
import { useCity } from "@/lib/city-context";
import type { Building } from "@/types";

interface LandlordSuggestion {
  name: string;
  building_count: number | null;
  total_violations: number | null;
}

interface SearchBarProps {
  size?: "default" | "hero";
  placeholder?: string;
  initialQuery?: string;
}

interface FlatItem {
  type: "neighborhood" | "building" | "landlord" | "recent" | "view-all";
  neighborhood?: NeighborhoodResult;
  building?: Building;
  landlord?: LandlordSuggestion;
  recent?: { id: string; full_address: string; borough: string; slug: string; overall_score: number | null };
}

export function SearchBar({
  size = "default",
  placeholder = "Search by address, neighborhood, or zip code...",
  initialQuery = "",
}: SearchBarProps) {
  const router = useRouter();
  const city = useCity();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Building[]>([]);
  const [neighborhoodResults, setNeighborhoodResults] = useState<NeighborhoodResult[]>([]);
  const [landlordResults, setLandlordResults] = useState<LandlordSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const debouncedQuery = useDebounce(query, 300);
  const { recent } = useRecentBuildings();

  // Build flat list of all items for keyboard navigation
  const flatItems: FlatItem[] = [];

  const showingRecent = query.trim().length === 0 && recent.length > 0;
  const hasSearchResults =
    neighborhoodResults.length > 0 || results.length > 0 || landlordResults.length > 0;

  if (showingRecent) {
    for (const r of recent) {
      flatItems.push({ type: "recent", recent: r });
    }
  } else {
    for (const n of neighborhoodResults) {
      flatItems.push({ type: "neighborhood", neighborhood: n });
    }
    for (const b of results) {
      flatItems.push({ type: "building", building: b });
    }
    for (const l of landlordResults) {
      flatItems.push({ type: "landlord", landlord: l });
    }
    if (hasSearchResults) {
      flatItems.push({ type: "view-all" });
    }
  }

  const navigateToItem = useCallback(
    (item: FlatItem) => {
      setOpen(false);
      setHighlightIndex(-1);
      switch (item.type) {
        case "neighborhood":
          if (item.neighborhood) router.push(neighborhoodUrl(item.neighborhood.zipCode, city));
          break;
        case "building":
          if (item.building) router.push(buildingUrl(item.building, city));
          break;
        case "landlord":
          if (item.landlord) router.push(landlordUrl(item.landlord.name, city));
          break;
        case "recent":
          if (item.recent) router.push(buildingUrl(item.recent, city));
          break;
        case "view-all":
          router.push(cityPath(`/search?q=${encodeURIComponent(query.trim())}`, city));
          break;
      }
    },
    [router, city, query]
  );

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      seq.current++; // invalidate any in-flight responses
      setResults([]);
      setNeighborhoodResults([]);
      setLandlordResults([]);
      if (debouncedQuery.length === 0 && recent.length > 0) {
        // Keep open if focused and have recent items — don't close
      } else {
        setOpen(false);
      }
      return;
    }

    // Client-side neighborhood matching (instant)
    const neighborhoods = searchNeighborhoodsByCity(debouncedQuery, city, 3);
    setNeighborhoodResults(neighborhoods);
    if (neighborhoods.length > 0) setOpen(true);

    // API building + landlord search in parallel
    setLoading(true);
    const buildingApi =
      neighborhoods.length > 0
        ? `/api/search?zip=${neighborhoods[0].zipCode}&city=${city}&limit=5`
        : `/api/search?q=${encodeURIComponent(debouncedQuery)}&city=${city}&limit=5`;
    const landlordApi = `/api/landlords?search=${encodeURIComponent(debouncedQuery)}&city=${city}&page=1`;

    const controller = new AbortController();
    // Stale-response guard: only the latest request may apply state. The
    // AbortController covers effect cleanup, but a response already past the
    // network layer can still resolve after a newer request started.
    const mySeq = ++seq.current;
    const isAbort = (err: unknown) => (err as { name?: string })?.name === "AbortError";

    Promise.all([
      fetch(buildingApi, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (mySeq === seq.current) setResults(data.buildings || []);
        })
        .catch((err) => {
          if (!isAbort(err) && mySeq === seq.current) setResults([]);
        }),
      fetch(landlordApi, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const rows: LandlordSuggestion[] = (data.landlords ?? [])
            .slice(0, 3)
            .map(
              (l: {
                name: string;
                buildingCount?: number | null;
                totalViolations?: number | null;
              }) => ({
                name: l.name,
                building_count: l.buildingCount ?? null,
                total_violations: l.totalViolations ?? null,
              }),
            );
          if (mySeq === seq.current) setLandlordResults(rows);
        })
        .catch((err) => {
          if (!isAbort(err) && mySeq === seq.current) setLandlordResults([]);
        }),
    ])
      .then(() => {
        if (!controller.signal.aborted && mySeq === seq.current) setOpen(true);
      })
      .finally(() => {
        if (!controller.signal.aborted && mySeq === seq.current) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, city, recent.length]);

  // Reset highlight when items change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [debouncedQuery, neighborhoodResults.length, results.length, landlordResults.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || flatItems.length === 0) {
      // If pressing down while input is focused and empty with recent items, open the dropdown
      if (e.key === "ArrowDown" && query.trim().length === 0 && recent.length > 0) {
        setOpen(true);
        setHighlightIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % flatItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
        break;
      case "Enter":
        if (highlightIndex >= 0 && highlightIndex < flatItems.length) {
          e.preventDefault();
          navigateToItem(flatItems[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setHighlightIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlightIndex >= 0 && highlightIndex < flatItems.length) {
      navigateToItem(flatItems[highlightIndex]);
      return;
    }
    if (query.trim()) {
      setOpen(false);
      setHighlightIndex(-1);
      router.push(cityPath(`/search?q=${encodeURIComponent(query.trim())}`, city));
    }
  }

  function handleFocus() {
    if (query.trim().length === 0 && recent.length > 0) {
      setOpen(true);
    } else if (hasSearchResults) {
      setOpen(true);
    }
  }

  const isHero = size === "hero";
  const showDropdown = open && (showingRecent || hasSearchResults);

  // Track the current flat index as we render items
  let currentFlatIndex = 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] ${isHero ? "w-6 h-6" : "w-5 h-5"}`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full bg-white text-[#0F1D2E] placeholder-[#94a3b8] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isHero ? "pl-14 pr-6 py-5 text-lg" : "pl-12 pr-4 py-3 text-sm"} shadow-sm`}
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-activedescendant={highlightIndex >= 0 ? `search-item-${highlightIndex}` : undefined}
          />
          {loading && (
            <Loader2
              className={`absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8] ${isHero ? "w-6 h-6" : "w-5 h-5"}`}
            />
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden" role="listbox">
          {/* Recently Viewed (when query is empty) */}
          {showingRecent && (
            <>
              <div className="px-4 py-1.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Recently Viewed
                </span>
              </div>
              {recent.map((r) => {
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={r.id}
                    id={`search-item-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={highlightIndex === idx}
                    onClick={() => navigateToItem({ type: "recent", recent: r })}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left ${highlightIndex === idx ? "bg-[#EFF6FF]" : "hover:bg-gray-50"}`}
                  >
                    <Clock className="w-5 h-5 text-[#94a3b8] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F1D2E] truncate">
                        {r.full_address}
                      </p>
                      <p className="text-xs text-[#64748b]">{r.borough}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <LetterGrade score={r.overall_score ?? 50} size="sm" />
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Neighborhood results */}
          {!showingRecent && neighborhoodResults.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Neighborhoods
                </span>
              </div>
              {neighborhoodResults.map((n) => {
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={n.zipCode}
                    id={`search-item-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={highlightIndex === idx}
                    onClick={() => navigateToItem({ type: "neighborhood", neighborhood: n })}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left ${highlightIndex === idx ? "bg-[#EFF6FF]" : "hover:bg-gray-50"}`}
                  >
                    <MapPin className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F1D2E]">
                        {n.name}
                      </p>
                      <p className="text-xs text-[#64748b]">
                        {n.zipCode} &middot; {n.region}
                      </p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
          {/* Building results */}
          {!showingRecent && results.length > 0 && (
            <>
              {neighborhoodResults.length > 0 && (
                <div className="px-4 py-1.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                    Buildings
                  </span>
                </div>
              )}
              {results.map((building) => {
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={building.id}
                    id={`search-item-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={highlightIndex === idx}
                    onClick={() => navigateToItem({ type: "building", building })}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left ${highlightIndex === idx ? "bg-[#EFF6FF]" : "hover:bg-gray-50"}`}
                  >
                    <MapPin className="w-5 h-5 text-[#94a3b8] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      {building.name && (
                        <p className="text-xs font-medium text-[#3B82F6]">{building.name}</p>
                      )}
                      <p className="text-sm font-medium text-[#0F1D2E] truncate">
                        {building.full_address}
                      </p>
                      <p className="text-xs text-[#64748b]">
                        {building.borough}
                        {building.zip_code && ` · ${building.zip_code}`}
                        {building.review_count > 0 &&
                          ` · ${building.review_count} review${building.review_count !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <LetterGrade score={building.overall_score ?? deriveScore(building.violation_count || 0, building.complaint_count || 0)} size="sm" />
                    </div>
                  </button>
                );
              })}
            </>
          )}
          {/* Landlord results */}
          {!showingRecent && landlordResults.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Landlords
                </span>
              </div>
              {landlordResults.map((landlord) => {
                const idx = currentFlatIndex++;
                const meta = [
                  typeof landlord.building_count === "number" && landlord.building_count > 0
                    ? `${landlord.building_count} building${landlord.building_count !== 1 ? "s" : ""}`
                    : null,
                  typeof landlord.total_violations === "number" && landlord.total_violations > 0
                    ? `${landlord.total_violations.toLocaleString()} violation${landlord.total_violations !== 1 ? "s" : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={landlord.name}
                    id={`search-item-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={highlightIndex === idx}
                    onClick={() => navigateToItem({ type: "landlord", landlord })}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left ${highlightIndex === idx ? "bg-[#EFF6FF]" : "hover:bg-gray-50"}`}
                  >
                    <Users className="w-5 h-5 text-[#94a3b8] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F1D2E] truncate">
                        {landlord.name}
                      </p>
                      {meta && (
                        <p className="text-xs text-[#64748b]">{meta}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
          {/* View all results link */}
          {!showingRecent && hasSearchResults && (() => {
            const idx = currentFlatIndex++;
            return (
              <button
                key="view-all"
                id={`search-item-${idx}`}
                type="button"
                role="option"
                aria-selected={highlightIndex === idx}
                onClick={() => navigateToItem({ type: "view-all" })}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full px-4 py-3 text-sm text-[#3B82F6] font-medium border-t border-[#e2e8f0] ${highlightIndex === idx ? "bg-[#EFF6FF]" : "hover:bg-gray-50"}`}
              >
                View all results for &ldquo;{query}&rdquo;
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
