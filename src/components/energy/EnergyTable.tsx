"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { getRegions, getRegionLabel } from "@/lib/constants";
import { useCity } from "@/lib/city-context";

interface EnergyRow {
  property_name: string | null;
  address: string | null;
  borough: string | null;
  energy_star_score: number | null;
  site_eui: number | null;
  total_ghg_emissions: number | null;
  building_slug: string | null;
  building_borough: string | null;
}

const BOROUGH_SLUGS: Record<string, string> = {
  Manhattan: "manhattan",
  Brooklyn: "brooklyn",
  Queens: "queens",
  Bronx: "bronx",
  "Staten Island": "staten-island",
};

function scoreClass(score: number | null): string {
  if (score == null) return "text-[#94a3b8]";
  if (score >= 75) return "text-emerald-600 font-bold";
  if (score >= 50) return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
}

export function EnergyTable({ data }: { data: EnergyRow[] }) {
  const city = useCity();
  const [borough, setBorough] = useState("");
  const [sortBy, setSortBy] = useState<"energy_star_score" | "site_eui">("energy_star_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let rows = data;
    if (borough) {
      rows = rows.filter((r) => r.borough === borough);
    }

    rows = [...rows].sort((a, b) => {
      const aVal = (sortBy === "energy_star_score" ? a.energy_star_score : a.site_eui) || 0;
      const bVal = (sortBy === "energy_star_score" ? b.energy_star_score : b.site_eui) || 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return rows;
  }, [data, borough, sortBy, sortDir]);

  function toggleSort(col: "energy_star_score" | "site_eui") {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir(col === "energy_star_score" ? "desc" : "asc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No energy data available yet.
      </div>
    );
  }

  return (
    <div>
      {/* Borough Filters */}
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
                Building
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                Borough
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#059669] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("energy_star_score")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Score <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                <button
                  onClick={() => toggleSort("site_eui")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Site EUI <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                GHG Emissions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.slice(0, 100).map((row, i) => (
              <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3 text-sm">
                  {row.building_slug && row.building_borough ? (
                    <Link
                      href={`/building/${BOROUGH_SLUGS[row.building_borough] || row.building_borough.toLowerCase().replace(/\s+/g, "-")}/${row.building_slug}`}
                      className="text-[#059669] hover:text-[#047857] hover:underline font-semibold"
                    >
                      {row.property_name || row.address || "Unknown"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[#0F1D2E]">
                      {row.property_name || row.address || "Unknown"}
                    </span>
                  )}
                  {row.address && row.property_name && (
                    <p className="text-xs text-[#94a3b8] mt-0.5">{row.address}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden md:table-cell">
                  {row.borough || "\u2014"}
                </td>
                <td className={`px-4 py-3 text-sm text-right ${scoreClass(row.energy_star_score)}`}>
                  {row.energy_star_score ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] text-right hidden sm:table-cell">
                  {row.site_eui != null ? `${row.site_eui.toFixed(1)}` : "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] text-right hidden lg:table-cell">
                  {row.total_ghg_emissions != null
                    ? `${row.total_ghg_emissions.toLocaleString()} t`
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#94a3b8] mt-3">
        Showing {Math.min(filtered.length, 100)} of {filtered.length} buildings. Data: NYC LL84 Energy Benchmarking.
      </p>
    </div>
  );
}
