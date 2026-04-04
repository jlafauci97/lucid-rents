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

  const normalizeBorough = (b: string | null) => {
    if (!b) return "Unknown";
    if (b === "STATEN ISLAND") return "Staten Island";
    // Handle multi-word names like "NORTH HOLLYWOOD" → "North Hollywood"
    return b
      .split(/[\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(b.includes("-") ? "-" : " ");
  };

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
      <div className="text-center py-12 text-[#A3ACBE]">
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
              : "bg-[#F5F7FA] text-[#5E6687] hover:bg-[#e2e8f0]"
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
                : "bg-[#F5F7FA] text-[#5E6687] hover:bg-[#e2e8f0]"
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
            <tr className="bg-[#FAFBFD] border-b border-[#E2E8F0]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("zip_code")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36]"
                >
                  Zip Code <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden sm:table-cell">
                {getRegionLabel(city)}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#6366F1] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("median_rent")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  Median Rent <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.map((row) => (
              <tr key={row.zip_code} className="hover:bg-[#FAFBFD] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[#1A1F36]">
                  {row.zip_code}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] hidden sm:table-cell">
                  {normalizeBorough(row.borough)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[#6366F1] text-right">
                  ${Math.round(row.median_rent).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#A3ACBE] mt-3">
        {filtered.length} zip codes shown. Data: Zillow Observed Rent Index (ZORI).
      </p>
    </div>
  );
}
