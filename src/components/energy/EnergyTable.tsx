"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getRegions, getRegionLabel } from "@/lib/constants";
import { buildingUrl } from "@/lib/seo";
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

function scoreClass(score: number | null): string {
  if (score == null) return "text-[#A3ACBE]";
  if (score >= 75) return "text-emerald-600 font-bold";
  if (score >= 50) return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
}

interface EnergyTableProps {
  data: EnergyRow[];
  dataSourceLabel?: string;
}

const PAGE_SIZE = 50;

export function EnergyTable({ data, dataSourceLabel }: EnergyTableProps) {
  const city = useCity();
  const [borough, setBorough] = useState("");
  const [sortBy, setSortBy] = useState<"energy_star_score" | "site_eui">("energy_star_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const sourceLabel = dataSourceLabel || (city === "nyc" ? "NYC LL84 Energy Benchmarking" : "LA EBEWE Energy Benchmarking");

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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const handleBoroughChange = (b: string) => {
    setBorough(b);
    setPage(1);
  };

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
      <div className="text-center py-12 text-[#A3ACBE]">
        No energy data available yet.
      </div>
    );
  }

  return (
    <div>
      {/* Region Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleBoroughChange("")}
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
            onClick={() => handleBoroughChange(b)}
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
                Building
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden md:table-cell">
                {getRegionLabel(city)}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#059669] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("energy_star_score")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  Score <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden sm:table-cell">
                <button
                  onClick={() => toggleSort("site_eui")}
                  className="inline-flex items-center gap-1 hover:text-[#1A1F36] ml-auto"
                >
                  Site EUI <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#5E6687] uppercase tracking-wide hidden lg:table-cell">
                GHG Emissions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {paginated.map((row, i) => (
              <tr key={i} className="hover:bg-[#FAFBFD] transition-colors">
                <td className="px-4 py-3 text-sm">
                  {row.building_slug && row.building_borough ? (
                    <Link
                      href={buildingUrl({ borough: row.building_borough, slug: row.building_slug }, city)}
                      className="text-[#059669] hover:text-[#047857] hover:underline font-semibold"
                    >
                      {row.property_name || row.address || "Unknown"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[#1A1F36]">
                      {row.property_name || row.address || "Unknown"}
                    </span>
                  )}
                  {row.address && row.property_name && (
                    <p className="text-xs text-[#A3ACBE] mt-0.5">{row.address}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] hidden md:table-cell">
                  {row.borough || "\u2014"}
                </td>
                <td className={`px-4 py-3 text-sm text-right ${scoreClass(row.energy_star_score)}`}>
                  {row.energy_star_score ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] text-right hidden sm:table-cell">
                  {row.site_eui != null ? `${row.site_eui.toFixed(1)}` : "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1F36] text-right hidden lg:table-cell">
                  {row.total_ghg_emissions != null
                    ? `${row.total_ghg_emissions.toLocaleString()} t`
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-[#A3ACBE]">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} buildings. Data: {sourceLabel}.
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] hover:bg-[#FAFBFD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Previous
            </button>
            <span className="text-xs text-[#5E6687]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] hover:bg-[#FAFBFD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
