"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { Sparkline } from "@/components/ui/Sparkline";
import { CRIME_CATEGORY_COLORS, CRIME_CATEGORY_LABELS } from "@/lib/crime-categories";
import type { SafetyGrade, ZipCrimeRanked } from "@/lib/crime-stats";

const GRADE_SCORES: Record<SafetyGrade, number> = {
  A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.5,
};

interface CrimeRankingTableProps {
  rows: ZipCrimeRanked[];
  trendData: Record<string, number[]>;
  /** Pre-computed city path prefix, e.g. "/nyc" or "/CA/Los-Angeles" */
  cityPathPrefix: string;
  regionLabel: string;
  areas: string[];
}

type SortKey = "rank" | "total" | "violent" | "property" | "yoy_total_pct";

export function CrimeRankingTable({
  rows,
  trendData,
  cityPathPrefix,
  regionLabel,
  areas,
}: CrimeRankingTableProps) {
  const buildPath = (path: string) => `${cityPathPrefix}${path}`;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterArea, setFilterArea] = useState("");

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.zip_code.includes(q) ||
          (r.neighborhood && r.neighborhood.toLowerCase().includes(q)) ||
          r.borough.toLowerCase().includes(q)
      );
    }
    if (filterArea) {
      result = result.filter(
        (r) => r.borough.toLowerCase() === filterArea.toLowerCase()
      );
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [rows, search, filterArea, sortBy, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(key === "rank"); }
  }

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by neighborhood or zip..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e2e8f0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterArea("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filterArea ? "bg-[#0F1D2E] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            All
          </button>
          {areas.map((area) => (
            <button
              key={area}
              onClick={() => setFilterArea(area)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterArea.toLowerCase() === area.toLowerCase()
                  ? "bg-[#0F1D2E] text-white"
                  : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#94a3b8] mb-3">
        {filtered.length} zip code{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide w-12">
                  <button onClick={() => toggleSort("rank")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E]">
                    # <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  Grade
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  Neighborhood / Zip
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                  {regionLabel}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  <button onClick={() => toggleSort("total")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Total <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#EF4444] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("violent")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Violent <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("yoy_total_pct")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    YoY <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                  Trend
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((row) => (
                <tr key={row.zip_code} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#94a3b8] font-mono">
                    {row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <LetterGrade score={GRADE_SCORES[row.grade]} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={buildPath(`/crime/${row.zip_code}`)}
                      className="group"
                    >
                      {row.neighborhood ? (
                        <>
                          <span className="text-sm font-semibold text-[#2563EB] group-hover:underline">
                            {row.neighborhood}
                          </span>
                          <span className="text-xs text-[#94a3b8] ml-1.5">{row.zip_code}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-[#2563EB] group-hover:underline">
                          {row.zip_code}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                    {row.borough}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E] text-right">
                    {row.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#EF4444] text-right hidden md:table-cell">
                    {row.violent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {row.yoy_total_pct !== null && (
                      <TrendBadge value={row.yoy_total_pct} />
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {trendData[row.zip_code] && (
                      <Sparkline
                        data={trendData[row.zip_code]}
                        color={row.yoy_total_pct !== null && row.yoy_total_pct < 0 ? "#22c55e" : "#EF4444"}
                        width={80}
                        height={24}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: CRIME_CATEGORY_COLORS[row.dominant_category] }}
                    >
                      {CRIME_CATEGORY_LABELS[row.dominant_category]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
