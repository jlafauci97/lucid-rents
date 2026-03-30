"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { getRegions, getRegionLabel } from "@/lib/constants";
import { useCity } from "@/lib/city-context";

interface ZipRentRow {
  zip_code: string;
  borough: string;
  median_rent: number;
  month: string;
}

export function ZipRentTable({ data }: { data: ZipRentRow[] }) {
  const city = useCity();
  const [borough, setBorough] = useState("");
  const [sortBy, setSortBy] = useState<"median_rent" | "zip_code">("median_rent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const normalizeBorough = (b: string) =>
    b === "STATEN ISLAND"
      ? "Staten Island"
      : b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();

  const filtered = useMemo(() => {
    let rows = borough
      ? data.filter((r) => normalizeBorough(r.borough) === borough)
      : data;

    rows = [...rows].sort((a, b) => {
      if (sortBy === "median_rent") {
        return sortDir === "desc"
          ? b.median_rent - a.median_rent
          : a.median_rent - b.median_rent;
      }
      return sortDir === "desc"
        ? b.zip_code.localeCompare(a.zip_code)
        : a.zip_code.localeCompare(b.zip_code);
    });

    return rows;
  }, [data, borough, sortBy, sortDir]);

  function toggleSort(col: "median_rent" | "zip_code") {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir(col === "median_rent" ? "desc" : "asc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No zip code rent data available yet.
      </div>
    );
  }

  return (
    <div>
      {/* Borough filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setBorough("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !borough
              ? "bg-[#0F1D2E] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          }`}
        >
          All {getRegionLabel(city)}s
        </button>
        {getRegions(city).map((b) => (
          <button
            key={b}
            onClick={() => setBorough(b)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              borough === b
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("zip_code")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E]"
                >
                  Zip Code <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                {getRegionLabel(city)}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#3B82F6] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("median_rent")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Median Rent <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.map((row) => (
              <tr key={row.zip_code} className="hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E]">
                  {row.zip_code}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                  {normalizeBorough(row.borough)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[#3B82F6] text-right">
                  ${Math.round(row.median_rent).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#94a3b8] mt-3">
        {filtered.length} zip codes shown. Data: Zillow Observed Rent Index (ZORI).
      </p>
    </div>
  );
}
