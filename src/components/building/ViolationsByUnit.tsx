"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Shield } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ViolationSummary {
  apartment: string | null;
  class: string | null;
  status: string | null;
  inspection_date: string | null;
}

interface UnitRef {
  id: string;
  unit_number: string;
}

interface ViolationsByUnitProps {
  violationSummaries: ViolationSummary[];
  units: UnitRef[];
  buildingId: string;
}

interface ApartmentGroup {
  key: string;
  label: string;
  total: number;
  open: number;
  classC: number;
  classB: number;
  classA: number;
  latestDate: string | null;
  unitId: string | null;
}

export function ViolationsByUnit({ violationSummaries, units, buildingId }: ViolationsByUnitProps) {
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    // Build unit lookup (case-insensitive)
    const unitMap = new Map<string, string>();
    for (const u of units) {
      unitMap.set(u.unit_number.trim().toUpperCase(), u.id);
    }

    // Group violations by apartment
    const map = new Map<string, ApartmentGroup>();

    for (const v of violationSummaries) {
      const raw = v.apartment?.trim() || "";
      const key = raw.toUpperCase() || "__COMMON__";
      const label = raw || "Common Areas";

      let group = map.get(key);
      if (!group) {
        group = {
          key,
          label,
          total: 0,
          open: 0,
          classC: 0,
          classB: 0,
          classA: 0,
          latestDate: null,
          unitId: unitMap.get(key) || null,
        };
        map.set(key, group);
      }

      group.total++;
      if (v.status === "Open") group.open++;
      if (v.class === "C") group.classC++;
      else if (v.class === "B") group.classB++;
      else if (v.class === "A") group.classA++;

      if (v.inspection_date) {
        if (!group.latestDate || v.inspection_date > group.latestDate) {
          group.latestDate = v.inspection_date;
        }
      }
    }

    // Sort by total descending
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [violationSummaries, units]);

  if (groups.length === 0) return null;

  const visible = showAll ? groups : groups.slice(0, 10);
  const hasMore = groups.length > 10;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-[#EF4444]" />
        <h2 className="text-xl font-bold text-[#0F1D2E]">
          Violations by Unit
        </h2>
        <span className="text-sm text-[#94a3b8]">
          ({groups.length} {groups.length === 1 ? "unit" : "units"})
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] text-xs font-medium text-[#64748b]">
          <span>Unit</span>
          <span className="text-right">Violations</span>
          <span className="text-right">Open</span>
          <span className="text-right hidden sm:block">Last Inspected</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#f1f5f9]">
          {visible.map((group) => {
            const content = (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3">
                {/* Unit label + class badges */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-[#0F1D2E] truncate">
                    {group.key === "__COMMON__" ? "Common Areas" : `Apt ${group.label}`}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {group.classC > 0 && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                        C:{group.classC}
                      </span>
                    )}
                    {group.classB > 0 && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">
                        B:{group.classB}
                      </span>
                    )}
                    {group.classA > 0 && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700">
                        A:{group.classA}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total */}
                <span className="text-sm font-medium text-[#0F1D2E] text-right tabular-nums">
                  {group.total}
                </span>

                {/* Open count */}
                <span className={`text-sm text-right tabular-nums ${group.open > 0 ? "font-medium text-[#EF4444]" : "text-[#94a3b8]"}`}>
                  {group.open}
                </span>

                {/* Date + chevron */}
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs text-[#94a3b8] hidden sm:block">
                    {group.latestDate ? formatDate(group.latestDate) : "—"}
                  </span>
                  {group.unitId && (
                    <ChevronRight className="w-4 h-4 text-[#e2e8f0] group-hover:text-[#3B82F6] flex-shrink-0" />
                  )}
                </div>
              </div>
            );

            if (group.unitId) {
              return (
                <Link
                  key={group.key}
                  href={`/building/${buildingId}/unit/${group.unitId}`}
                  className="block hover:bg-[#f8fafc] transition-colors group"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={group.key}>
                {content}
              </div>
            );
          })}
        </div>

        {/* Show all toggle */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full px-4 py-3 text-sm font-medium text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors border-t border-[#f1f5f9] flex items-center justify-center gap-1"
          >
            {showAll ? "Show less" : `Show all ${groups.length} units`}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </section>
  );
}
