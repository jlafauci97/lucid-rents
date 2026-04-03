import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LahdViolationSummary } from "@/types";

interface ViolationSummaryTableProps {
  violations: LahdViolationSummary[];
  agencyLabel?: string;
}

function titleCase(str: string) {
  return str
    .toLowerCase()
    .split(/[\s/]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ViolationSummaryTable({ violations, agencyLabel = "LAHD" }: ViolationSummaryTableProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No {agencyLabel} violations on record.
      </p>
    );
  }

  const sorted = [...violations].sort((a, b) => b.violations_cited - a.violations_cited);
  const totalCited = sorted.reduce((sum, v) => sum + v.violations_cited, 0);
  const totalCleared = sorted.reduce((sum, v) => sum + v.violations_cleared, 0);
  const totalOpen = totalCited - totalCleared;
  const overallPct = totalCited > 0 ? Math.round((totalCleared / totalCited) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#e2e8f0] bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{totalCited.toLocaleString()}</p>
          <p className="text-xs text-red-600">Cited</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{totalCleared.toLocaleString()}</p>
          <p className="text-xs text-emerald-600">Cleared</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{totalOpen.toLocaleString()}</p>
          <p className="text-xs text-amber-600">Outstanding</p>
        </div>
      </div>

      {/* Overall progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-red-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-[#64748b] shrink-0">{overallPct}% cleared</span>
      </div>

      {/* Per-type breakdown */}
      <div className="space-y-2">
        {sorted.map((v) => {
          const pct = v.violations_cited > 0 ? Math.round((v.violations_cleared / v.violations_cited) * 100) : 100;
          const open = v.violations_cited - v.violations_cleared;
          const allCleared = open === 0;
          return (
            <div
              key={v.id}
              className="rounded-lg border border-[#e2e8f0] px-4 py-3 bg-white"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {allCleared ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-[#0F1D2E] truncate">
                    {titleCase(v.violation_type)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#64748b] shrink-0">
                  <span>{v.violations_cited} cited</span>
                  <span>{v.violations_cleared} cleared</span>
                  {open > 0 && (
                    <span className="text-red-600 font-medium">{open} open</span>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
