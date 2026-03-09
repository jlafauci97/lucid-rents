"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";

interface ShedRow {
  work_permit: string;
  house_no: string;
  street_name: string;
  borough: string;
  zip_code: string;
  issued_date: string;
  expired_date: string | null;
  days_up: number;
  owner_business_name: string | null;
  permittee_business_name: string | null;
}

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

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

function isExpired(expiredDate: string | null): boolean {
  if (!expiredDate) return false;
  return new Date(expiredDate) < new Date();
}

export function ScaffoldingTable({ data }: { data: ShedRow[] }) {
  const [borough, setBorough] = useState("");
  const [sortBy, setSortBy] = useState<"days_up" | "issued_date">("days_up");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let rows = borough
      ? data.filter((r) => normalizeBorough(r.borough) === borough)
      : data;

    rows = [...rows].sort((a, b) => {
      if (sortBy === "days_up") {
        return sortDir === "desc" ? b.days_up - a.days_up : a.days_up - b.days_up;
      }
      const aDate = new Date(a.issued_date).getTime();
      const bDate = new Date(b.issued_date).getTime();
      return sortDir === "desc" ? bDate - aDate : aDate - bDate;
    });

    return rows;
  }, [data, borough, sortBy, sortDir]);

  function toggleSort(col: "days_up" | "issued_date") {
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
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          }`}
        >
          All Boroughs
        </button>
        {BOROUGHS.map((b) => (
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
                Address
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                Borough
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#F59E0B] uppercase tracking-wide">
                <button
                  onClick={() => toggleSort("days_up")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Duration <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                <button
                  onClick={() => toggleSort("issued_date")}
                  className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                >
                  Issued <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                Expires
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden xl:table-cell">
                Owner
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filtered.map((row) => (
              <tr key={row.work_permit} className="hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E]">
                  {row.house_no} {row.street_name}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                  {normalizeBorough(row.borough)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-right">
                  <span className={row.days_up > 365 ? "text-red-600" : row.days_up > 180 ? "text-[#F59E0B]" : "text-[#0F1D2E]"}>
                    {formatDuration(row.days_up)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] text-right hidden md:table-cell">
                  {new Date(row.issued_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className={`px-4 py-3 text-sm text-right hidden lg:table-cell ${
                  isExpired(row.expired_date) ? "text-red-600 font-semibold" : "text-[#334155]"
                }`}>
                  {row.expired_date
                    ? new Date(row.expired_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                  {isExpired(row.expired_date) && " (expired)"}
                </td>
                <td className="px-4 py-3 text-sm text-[#334155] hidden xl:table-cell max-w-[200px] truncate">
                  {row.owner_business_name || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#94a3b8] mt-3">
        {filtered.length} sheds shown. Data: NYC DOB Permits.
      </p>
    </div>
  );
}
