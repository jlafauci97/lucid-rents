"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getRegions, getRegionLabel, VIOLATION_AGENCIES } from "@/lib/constants";
import { useCity } from "@/lib/city-context";
import { buildingUrl } from "@/lib/seo";

interface PermitRow {
  work_permit: string;
  house_no: string | null;
  street_name: string | null;
  borough: string | null;
  zip_code: string | null;
  work_type: string | null;
  permit_status: string | null;
  filing_reason: string | null;
  issued_date: string | null;
  expired_date: string | null;
  job_description: string | null;
  estimated_job_costs: number | null;
  owner_business_name: string | null;
  building_slug: string | null;
  building_borough: string | null;
}

function formatCost(cost: number | null): string {
  if (cost == null || cost === 0) return "\u2014";
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(0)}K`;
  return `$${cost.toLocaleString()}`;
}

const PAGE_SIZE = 50;

export function PermitTable({ data }: { data: PermitRow[] }) {
  const city = useCity();
  const regionLabel = getRegionLabel(city);
  const dataSource = VIOLATION_AGENCIES[city].building;

  const [borough, setBorough] = useState("");
  const [workType, setWorkType] = useState("");
  const [sortBy, setSortBy] = useState<"issued_date" | "estimated_job_costs">("issued_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Extract unique work types for filter
  const workTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach((r) => {
      if (r.work_type) types.add(r.work_type);
    });
    return [...types].sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (borough) {
      rows = rows.filter((r) => r.borough === borough);
    }
    if (workType) {
      rows = rows.filter((r) => r.work_type === workType);
    }

    rows = [...rows].sort((a, b) => {
      if (sortBy === "issued_date") {
        const aDate = new Date(a.issued_date || "").getTime() || 0;
        const bDate = new Date(b.issued_date || "").getTime() || 0;
        return sortDir === "desc" ? bDate - aDate : aDate - bDate;
      }
      const aCost = a.estimated_job_costs || 0;
      const bCost = b.estimated_job_costs || 0;
      return sortDir === "desc" ? bCost - aCost : aCost - bCost;
    });

    return rows;
  }, [data, borough, workType, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  function toggleSort(col: "issued_date" | "estimated_job_costs") {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No permit data available yet.
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleFilterChange(setBorough)("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !borough
              ? "bg-[#0F1D2E] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          }`}
        >
          All {regionLabel}s
        </button>
        {getRegions(city).map((b) => (
          <button
            key={b}
            onClick={() => handleFilterChange(setBorough)(b)}
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

      {/* Work type filter */}
      <div className="mb-4">
        <select
          value={workType}
          onChange={(e) => handleFilterChange(setWorkType)(e.target.value)}
          className="text-sm border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#0F1D2E] bg-white"
        >
          <option value="">All Work Types</option>
          {workTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                Address
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                Work Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                {regionLabel}
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#0D9488] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("issued_date")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Issued <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                <button
                  onClick={() => toggleSort("estimated_job_costs")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Est. Cost <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden xl:table-cell">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {paginated.map((row) => (
              <tr key={row.work_permit} className="hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E]">
                  {row.building_slug && row.building_borough ? (
                    <Link
                      href={buildingUrl({ borough: row.building_borough, slug: row.building_slug }, city)}
                      className="text-[#0D9488] hover:text-[#0F766E] hover:underline"
                    >
                      {row.house_no} {row.street_name}
                    </Link>
                  ) : (
                    <>{row.house_no} {row.street_name}</>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                  {row.work_type || "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden md:table-cell">
                  {row.borough || "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] text-right">
                  {row.issued_date
                    ? new Date(row.issued_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] text-right hidden lg:table-cell">
                  {formatCost(row.estimated_job_costs)}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden xl:table-cell max-w-[250px] truncate">
                  {row.job_description || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-[#94a3b8]">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} permits. Data: {dataSource} Permits.
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Previous
            </button>
            <span className="text-xs text-[#64748b]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
