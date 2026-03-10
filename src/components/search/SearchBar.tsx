"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { deriveScore } from "@/lib/constants";
import { buildingUrl, cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import type { Building } from "@/types";

interface SearchBarProps {
  size?: "default" | "hero";
  placeholder?: string;
  initialQuery?: string;
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
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

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
        setResults(data.buildings || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setOpen(false);
      router.push(cityPath(`/search?q=${encodeURIComponent(query.trim())}`, city));
    }
  }

  const isHero = size === "hero";

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] ${isHero ? "w-6 h-6" : "w-5 h-5"}`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className={`w-full bg-white text-[#0F1D2E] placeholder-[#94a3b8] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isHero ? "pl-14 pr-6 py-5 text-lg" : "pl-12 pr-4 py-3 text-sm"} shadow-sm`}
          />
          {loading && (
            <Loader2
              className={`absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8] ${isHero ? "w-6 h-6" : "w-5 h-5"}`}
            />
          )}
        </div>
      </form>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-lg overflow-hidden">
          {results.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(buildingUrl(building, city));
              }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <MapPin className="w-5 h-5 text-[#94a3b8] mt-0.5 shrink-0" />
              <div className="min-w-0">
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
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(cityPath(`/search?q=${encodeURIComponent(query.trim())}`, city));
            }}
            className="w-full px-4 py-3 text-sm text-[#3B82F6] hover:bg-gray-50 font-medium border-t border-[#e2e8f0]"
          >
            View all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
