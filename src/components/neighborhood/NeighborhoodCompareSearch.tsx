"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Plus, MapPin } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import {
  searchNeighborhoodsByCity,
  type NeighborhoodResult,
} from "@/lib/neighborhoods";

interface NeighborhoodCompareSearchProps {
  selectedZips: string[];
  selectedNames: { zip: string; name: string; region: string }[];
}

export function NeighborhoodCompareSearch({
  selectedZips,
  selectedNames,
}: NeighborhoodCompareSearchProps) {
  const router = useRouter();
  const city = useCity();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NeighborhoodResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 200);

  const maxNeighborhoods = 3;
  const isFull = selectedZips.length >= maxNeighborhoods;

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Client-side search through the static neighborhood maps
    const matches = searchNeighborhoodsByCity(debouncedQuery, city, 8).filter(
      (m) => !selectedZips.includes(m.zipCode)
    );
    setResults(matches);
    setOpen(matches.length > 0);
  }, [debouncedQuery, selectedZips, city]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateUrl = useCallback(
    (zips: string[]) => {
      if (zips.length === 0) {
        router.push(cityPath("/neighborhood/compare", city));
      } else {
        router.push(
          cityPath(`/neighborhood/compare?zips=${zips.join(",")}`, city)
        );
      }
    },
    [router, city]
  );

  function addNeighborhood(zipCode: string) {
    if (selectedZips.includes(zipCode) || isFull) return;
    const newZips = [...selectedZips, zipCode];
    setQuery("");
    setResults([]);
    setOpen(false);
    updateUrl(newZips);
  }

  function removeNeighborhood(zipCode: string) {
    const newZips = selectedZips.filter((z) => z !== zipCode);
    updateUrl(newZips);
  }

  return (
    <div className="space-y-4">
      {/* Selected neighborhood chips */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedNames.map((n) => (
            <div
              key={n.zip}
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
              <span className="text-[#0F1D2E] font-medium truncate max-w-[240px]">
                {n.name} ({n.zip})
              </span>
              <button
                type="button"
                onClick={() => removeNeighborhood(n.zip)}
                className="ml-1 text-[#64748b] hover:text-red-500 transition-colors shrink-0"
                aria-label={`Remove ${n.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={wrapperRef} className="relative">
        {isFull ? (
          <div className="w-full bg-gray-50 text-[#64748b] border border-[#e2e8f0] rounded-xl px-12 py-3 text-sm">
            Maximum of {maxNeighborhoods} neighborhoods reached. Remove one to
            add another.
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] w-5 h-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder={
                  selectedZips.length === 0
                    ? "Search by neighborhood name or zip code..."
                    : "Add another neighborhood..."
                }
                className="w-full bg-white text-[#0F1D2E] placeholder-[#94a3b8] border border-[#e2e8f0] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent shadow-sm"
              />
            </div>

            {open && results.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {results.map((n) => (
                  <button
                    key={n.zipCode}
                    type="button"
                    onClick={() => addNeighborhood(n.zipCode)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-[#94a3b8] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F1D2E] truncate">
                        {n.name}
                      </p>
                      <p className="text-xs text-[#64748b]">
                        {n.zipCode}
                        {n.region && ` · ${n.region}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </div>
                  </button>
                ))}
              </div>
            )}

            {open &&
              debouncedQuery.length >= 2 &&
              results.length === 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden">
                  <div className="px-4 py-6 text-center text-sm text-[#64748b]">
                    No neighborhoods found for &ldquo;{debouncedQuery}&rdquo;
                  </div>
                </div>
              )}
          </>
        )}
      </div>

      {selectedZips.length < 2 && (
        <p className="text-sm text-[#64748b]">
          {selectedZips.length === 0
            ? "Search and add 2-3 neighborhoods to compare them side by side."
            : "Add at least one more neighborhood to start comparing."}
        </p>
      )}
    </div>
  );
}
