"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "score-desc", label: "Highest Score" },
  { value: "score-asc", label: "Lowest Score" },
  { value: "violations-desc", label: "Most Violations" },
  { value: "reviews-desc", label: "Most Reviews" },
] as const;

export function SearchSort() {
  const router = useRouter();
  const city = useCity();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "relevance";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "relevance") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    params.set("page", "1");
    router.push(cityPath(`/search?${params.toString()}`, city));
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="search-sort" className="text-xs text-[#94a3b8] whitespace-nowrap">
        Sort by
      </label>
      <select
        id="search-sort"
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
