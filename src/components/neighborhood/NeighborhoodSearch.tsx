"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { getLetterGrade, getGradeColor, type LetterGrade as LetterGradeType } from "@/lib/constants";

export interface NeighborhoodIndexEntry {
  zipCode: string;
  name: string;
  region: string;
  buildingCount: number;
  avgScore: number | null;
  totalViolations: number;
  crimeTotal: number | null;
  safetyGrade: string | null;
  href: string;
}

type SortKey = "name" | "grade" | "buildings" | "safety";

const GRADE_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };

export function NeighborhoodSearch({
  neighborhoods,
  regions,
  regionLabel,
}: {
  neighborhoods: NeighborhoodIndexEntry[];
  regions: string[];
  regionLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    let result = neighborhoods;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.zipCode.includes(q) ||
          n.region.toLowerCase().includes(q)
      );
    }

    if (selectedRegion !== "all") {
      result = result.filter((n) => n.region === selectedRegion);
    }

    if (selectedGrade !== "all") {
      result = result.filter((n) => {
        if (!n.avgScore) return false;
        return getLetterGrade(n.avgScore) === selectedGrade;
      });
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "grade": {
          const aGrade = a.avgScore ? getLetterGrade(a.avgScore) : "F";
          const bGrade = b.avgScore ? getLetterGrade(b.avgScore) : "F";
          return (GRADE_ORDER[aGrade] || 5) - (GRADE_ORDER[bGrade] || 5);
        }
        case "buildings":
          return b.buildingCount - a.buildingCount;
        case "safety": {
          const aOrder = a.safetyGrade ? (GRADE_ORDER[a.safetyGrade] || 5) : 5;
          const bOrder = b.safetyGrade ? (GRADE_ORDER[b.safetyGrade] || 5) : 5;
          return aOrder - bOrder;
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [neighborhoods, query, selectedRegion, selectedGrade, sortBy]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by name or zip code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
          />
        </div>
        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20">
          <option value="all">All {regionLabel}s</option>
          {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20">
          <option value="all">All Grades</option>
          {["A", "B", "C", "D", "F"].map((g) => (<option key={g} value={g}>Grade {g}</option>))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20">
          <option value="name">Sort: Name</option>
          <option value="grade">Sort: Best Grade</option>
          <option value="buildings">Sort: Most Buildings</option>
          <option value="safety">Sort: Safest</option>
        </select>
      </div>

      <p className="text-sm text-[#64748b] mb-4">{filtered.length} neighborhood{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-[#64748b]">No neighborhoods match your search.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <Link key={n.zipCode} href={n.href} className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group">
              <div className="flex items-start gap-3">
                <LetterGrade score={n.avgScore} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors truncate">{n.name}</p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">{n.zipCode}{n.region ? ` · ${n.region}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[#64748b]">
                <span>{n.buildingCount.toLocaleString()} buildings</span>
                <span>{n.totalViolations.toLocaleString()} violations</span>
                {n.safetyGrade && (
                  <span className="flex items-center gap-1">
                    Safety: <span className="font-bold" style={{ color: getGradeColor(n.safetyGrade as LetterGradeType) }}>{n.safetyGrade}</span>
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
