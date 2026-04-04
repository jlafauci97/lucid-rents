"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { getRegions, getRegionLabel } from "@/lib/constants";
import { useCity } from "@/lib/city-context";

interface ShedRow {
  house_no: string;
  street_name: string;
  borough: string;
  zip_code: string;
  permit_count: number;
  first_issued: string;
  latest_issued: string;
  total_days: number;
  active_permits: number;
  owner_business_name: string | null;
}

const BOROUGH_NAME: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  BRONX: "Bronx",
  "STATEN ISLAND": "Staten Island",
};

function normalizeBorough(b: string): string {
  return BOROUGH_NAME[b.toUpperCase()] || b;
}

function formatDuration(days: number): string {
  if (days < 0) return "N/A";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0 && months > 0) return `${years}y ${months}mo`;
  if (years > 0) return `${years}y`;
  if (months > 0) return `${months}mo`;
  return `${days}d`;
}

export function ScaffoldingTable({ data }: { data: ShedRow[] }) {
  const city = useCity();
  const [borough, setBorough] = useState("");
  const [sortBy, setSortBy] = useState<"total_days" | "permit_count" | "first_issued">("total_days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let rows = borough
      ? data.filter((r) => normalizeBorough(r.borough) === borough)
      : data;

    rows = [...rows].sort((a, b) => {
      if (sortBy === "total_days") {
        return sortDir === "desc" ? b.total_days - a.total_days : a.total_days - b.total_days;
      }
      if (sortBy === "permit_count") {
        return sortDir === "desc" ? b.permit_count - a.permit_count : a.permit_count - b.permit_count;
      }
      const aDate = new Date(a.first_issued).getTime();
      const bDate = new Date(b.first_issued).getTime();
      return sortDir === "desc" ? bDate - aDate : aDate - bDate;
    });

    return rows;
  }, [data, borough, sortBy, sortDir]);

  function toggleSort(col: "total_days" | "permit_count" | "first_issued") {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#A3ACBE]">
        No scaffolding data available yet.
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
                Address
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden sm:table-cell">
                Borough
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#F59E0B] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("total_days")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  Total Time <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("permit_count")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  Renewals <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden md:table-cell">
                <button
                  onClick={() => toggleSort("first_issued")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  First Permit <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden xl:table-cell">
                Owner
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.map((row, i) => (
              <tr key={`${row.house_no}-${row.street_name}-${row.borough}-${i}`} className="hover:bg-[#FAFBFD] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[#1A1F36]">
                  {row.house_no} {row.street_name}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] hidden sm:table-cell">
                  {normalizeBorough(row.borough)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-right">
                  <span className={row.total_days > 1825 ? "text-red-600" : row.total_days > 365 ? "text-[#F59E0B]" : "text-[#1A1F36]"}>
                    {formatDuration(row.total_days)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={`inline-flex items-center gap-1 ${row.permit_count > 5 ? "text-red-600 font-semibold" : "text-[#1A1F36]"}`}>
                    {row.permit_count}x
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] text-right hidden md:table-cell">
                  {new Date(row.first_issued).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] hidden xl:table-cell max-w-[200px] truncate">
                  {row.owner_business_name || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#A3ACBE] mt-3">
        {filtered.length} addresses shown. Renewals = total permits issued at address. Data: NYC DOB Permits.
      </p>
    </div>
  );
}
