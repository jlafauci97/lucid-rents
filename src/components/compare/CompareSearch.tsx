"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus, MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import type { Building } from "@/types";

interface CompareSearchProps {
  selectedIds: string[];
  selectedBuildings: Building[];
}

export function CompareSearch({
  selectedIds,
  selectedBuildings,
}: CompareSearchProps) {
  const router = useRouter();
  const city = useCity();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const maxBuildings = 3;
  const isFull = selectedIds.length >= maxBuildings;

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`)
      .then((res) => res.json())
      .then((data) => {
        const buildings: Building[] = data.buildings || [];
        // Filter out already-selected buildings
        const filtered = buildings.filter(
          (b) => !selectedIds.includes(b.id)
        );
        setResults(filtered);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, selectedIds]);

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
    (ids: string[]) => {
      if (ids.length === 0) {
        router.push(cityPath("/compare", city));
      } else {
        router.push(cityPath(`/compare?ids=${ids.join(",")}`, city));
      }
    },
    [router]
  );

  function addBuilding(buildingId: string) {
    if (selectedIds.includes(buildingId) || isFull) return;
    const newIds = [...selectedIds, buildingId];
    setQuery("");
    setResults([]);
    setOpen(false);
    updateUrl(newIds);
  }

  function removeBuilding(buildingId: string) {
    const newIds = selectedIds.filter((id) => id !== buildingId);
    updateUrl(newIds);
  }

  return (
    <div className="space-y-4">
      {/* Selected building chips */}
      {selectedBuildings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedBuildings.map((building) => (
            <div
              key={building.id}
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
              <span className="text-[#0F1D2E] font-medium truncate max-w-[240px]">
                {building.full_address}
              </span>
              <button
                type="button"
                onClick={() => removeBuilding(building.id)}
                className="ml-1 text-[#64748b] hover:text-red-500 transition-colors shrink-0"
                aria-label={`Remove ${building.full_address}`}
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
            Maximum of {maxBuildings} buildings reached. Remove one to add
            another.
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] w-5 h-5" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder={
                  selectedIds.length === 0
                    ? "Search for a building to start comparing..."
                    : "Add another building to compare..."
                }
                className="w-full bg-white text-[#0F1D2E] placeholder-[#94a3b8] border border-[#e2e8f0] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent shadow-sm"
              />
              {loading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8] w-5 h-5" />
              )}
            </div>

            {open && results.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden">
                {results.map((building) => (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => addBuilding(building.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-[#94a3b8] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F1D2E] truncate">
                        {building.full_address}
                      </p>
                      <p className="text-xs text-[#64748b]">
                        {building.borough}
                        {building.zip_code && ` \u00B7 ${building.zip_code}`}
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

            {open && debouncedQuery.length >= 2 && results.length === 0 && !loading && (
              <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden">
                <div className="px-4 py-6 text-center text-sm text-[#64748b]">
                  No buildings found for &ldquo;{debouncedQuery}&rdquo;
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Helper text */}
      {selectedIds.length < 2 && (
        <p className="text-sm text-[#64748b]">
          {selectedIds.length === 0
            ? "Search and add 2-3 buildings to compare them side by side."
            : "Add at least one more building to start comparing."}
        </p>
      )}
    </div>
  );
}
