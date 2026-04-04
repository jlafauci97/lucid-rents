"use client";

import { useState, useMemo } from "react";
import {
  NeighborhoodMatchCard,
  type NeighborhoodMatch,
} from "./NeighborhoodMatchCard";
import { neighborhoodUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface NeighborhoodMatchListProps {
  matches: NeighborhoodMatch[];
  recommendedMax: number;
  city: City;
}

export function NeighborhoodMatchList({
  matches,
  recommendedMax,
  city,
}: NeighborhoodMatchListProps) {
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const regions = useMemo(() => {
    const set = new Set(matches.map((m) => m.region));
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    let list = matches;
    if (regionFilter !== "all") {
      list = list.filter((m) => m.region === regionFilter);
    }
    // Sort: affordable first (closest to budget), then over-budget
    return list.sort((a, b) => {
      const aAffordable = a.medianRent <= recommendedMax;
      const bAffordable = b.medianRent <= recommendedMax;
      if (aAffordable && !bAffordable) return -1;
      if (!aAffordable && bAffordable) return 1;
      if (aAffordable && bAffordable) {
        // Both affordable: show closest to budget first (maximize value)
        return b.medianRent - a.medianRent;
      }
      // Both over: show cheapest first
      return a.medianRent - b.medianRent;
    });
  }, [matches, recommendedMax, regionFilter]);

  const affordableCount = filtered.filter(
    (m) => m.medianRent <= recommendedMax
  ).length;

  const meta = CITY_META[city];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1F36]">
            {meta.regionLabel} Matches in {meta.fullName}
          </h3>
          <p className="text-xs text-[#5E6687]">
            {affordableCount} of {filtered.length}{" "}
            {meta.regionLabel.toLowerCase()}s fit your budget
          </p>
        </div>

        {/* Region filter pills */}
        {regions.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRegionFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                regionFilter === "all"
                  ? "bg-[#6366F1] text-white border-[#6366F1]"
                  : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
              }`}
            >
              All
            </button>
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  regionFilter === r
                    ? "bg-[#6366F1] text-white border-[#6366F1]"
                    : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#A3ACBE]">
          <p className="text-sm">
            No neighborhood data available for this selection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((match) => (
            <NeighborhoodMatchCard
              key={match.zipCode}
              match={match}
              recommendedMax={recommendedMax}
              href={neighborhoodUrl(match.zipCode, city)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
