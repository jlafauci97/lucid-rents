"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getRegions, getRegionLabel } from "@/lib/constants";
import { cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

export function SearchFilters() {
  const router = useRouter();
  const city = useCity();
  const searchParams = useSearchParams();
  const currentBorough = searchParams.get("borough") || "";
  const currentZip = searchParams.get("zip") || "";
  const q = searchParams.get("q") || "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(cityPath(`/search?${params.toString()}`, city));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentBorough}
        onChange={(e) => updateFilter("borough", e.target.value)}
        className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
      >
        <option value="">All {getRegionLabel(city)}s</option>
        {getRegions(city).map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Zip code"
        value={currentZip}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "").slice(0, 5);
          if (val.length === 5 || val.length === 0) {
            updateFilter("zip", val);
          }
        }}
        maxLength={5}
        className="w-24 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
      />
    </div>
  );
}
