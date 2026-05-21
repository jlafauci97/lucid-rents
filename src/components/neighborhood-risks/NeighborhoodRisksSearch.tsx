"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useDebounce } from "@/hooks/useDebounce";
import { cityPath } from "@/lib/seo";

interface BuildingSuggestion {
  id: string;
  name: string | null;
  full_address: string;
  borough: string;
  slug: string;
}

const MAX_RESULTS = 6;

export function NeighborhoodRisksSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BuildingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 200);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("buildings")
        .select("id, name, full_address, borough, slug")
        .eq("metro", "nyc")
        .or(`name.ilike.%${q}%,full_address.ilike.%${q}%`)
        .limit(MAX_RESULTS);
      setResults((data ?? []) as BuildingSuggestion[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (building: BuildingSuggestion) => {
    router.push(cityPath(`/tenant-tools/neighborhood-risks/${building.slug}`, "nyc"));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <div className="flex items-center gap-3 bg-white border-2 border-[#E2E8F0] focus-within:border-[#3B82F6] rounded-2xl px-4 sm:px-5 py-3 sm:py-4 transition-colors">
        <Search className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a NYC building address or name"
          className="flex-1 bg-transparent outline-none text-base sm:text-lg text-[#0F1D2E] placeholder:text-[#94a3b8]"
          aria-label="Search a NYC building"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="nr-search-listbox"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-[#94a3b8]" />}
      </div>

      {open && debouncedQuery.length >= 2 && (
        <ul
          id="nr-search-listbox"
          role="listbox"
          className="absolute top-full mt-2 left-0 right-0 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden z-20"
        >
          {results.length === 0 && !loading && (
            <li className="px-4 py-3 text-sm text-[#94a3b8]">
              No buildings found. Try a different address.
            </li>
          )}
          {results.map((b, i) => {
            const isHighlighted = i === highlightIndex;
            return (
              <li
                key={b.id}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(b);
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${
                  isHighlighted ? "bg-[#F8FAFC]" : ""
                }`}
              >
                <MapPin className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#0F1D2E] truncate">
                    {b.name || b.full_address}
                  </div>
                  <div className="text-xs text-[#64748B] truncate">
                    {b.full_address} · {b.borough}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#cbd5e1] flex-shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
