"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Building2 } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import type { LandlordRanked, LandlordGrade } from "@/lib/landlord-stats";

const GRADE_SCORES: Record<LandlordGrade, number> = {
  A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.5,
};

interface LandlordRankingTableProps {
  rows: LandlordRanked[];
  cityPathPrefix: string;
}

type SortKey = "rank" | "avg_score" | "total_violations" | "building_count" | "violations_per_building" | "total_litigations";

export function LandlordRankingTable({
  rows,
  cityPathPrefix,
}: LandlordRankingTableProps) {
  const buildPath = (path: string) => `${cityPathPrefix}${path}`;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterGrade, setFilterGrade] = useState<LandlordGrade | "">("");

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (filterGrade) {
      result = result.filter((r) => r.grade === filterGrade);
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [rows, search, filterGrade, sortBy, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(key === "rank");
    }
  }

  return (
    <div>
      {/* Search + grade filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by landlord name..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e2e8f0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterGrade("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filterGrade ? "bg-[#0F1D2E] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            All
          </button>
          {(["A", "B", "C", "D", "F"] as LandlordGrade[]).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGrade(g)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterGrade === g ? "bg-[#0F1D2E] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              }`}
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#94a3b8] mb-3">
        {filtered.length} landlord{filtered.length !== 1 ? "s" : ""}
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
                  Landlord
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  <button onClick={() => toggleSort("building_count")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Buildings <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#EF4444] uppercase tracking-wide">
                  <button onClick={() => toggleSort("total_violations")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Violations <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("violations_per_building")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Per Bldg <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8B5CF6] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("total_litigations")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Litigations <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                  <button onClick={() => toggleSort("avg_score")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Score <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((row) => (
                <tr key={row.slug} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#94a3b8] font-mono">
                    {row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <LetterGrade score={GRADE_SCORES[row.grade]} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={buildPath(`/landlord/${row.slug}`)} className="group">
                      <span className="text-sm font-semibold text-[#2563EB] group-hover:underline">
                        {row.name}
                      </span>
                      {row.worst_building_address && (
                        <span className="block text-xs text-[#94a3b8] mt-0.5 truncate max-w-[200px]">
                          Worst: {row.worst_building_address}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] text-right">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {row.building_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">
                    <span className={row.total_violations > 100 ? "text-[#EF4444]" : row.total_violations > 20 ? "text-[#F59E0B]" : "text-[#64748b]"}>
                      {row.total_violations.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] text-right hidden md:table-cell">
                    {row.violations_per_building}
                  </td>
                  <td className="px-4 py-3 text-sm text-right hidden md:table-cell">
                    <span className={row.total_litigations > 0 ? "text-[#8B5CF6] font-semibold" : "text-[#64748b]"}>
                      {row.total_litigations}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E] text-right hidden lg:table-cell">
                    {row.avg_score.toFixed(1)}
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
