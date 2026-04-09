import { AlertTriangle } from "lucide-react";
import { T } from "@/lib/design-tokens";
import type { LahdViolationSummary } from "@/types";

interface ViolationSummaryTableProps {
  violations: LahdViolationSummary[];
  agencyLabel?: string;
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
}

function titleCase(str: string) {
  return str
    .toLowerCase()
    .split(/[\s/]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ViolationSummaryTable({ violations, agencyLabel = "LAHD", viewAllHref, limit = 10, totalCount }: ViolationSummaryTableProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No {agencyLabel} violations on record.
      </p>
    );
  }

  const sorted = [...violations].sort((a, b) => b.violations_cited - a.violations_cited);
  const displayed = sorted.slice(0, limit);
  const hasMore = sorted.length > limit;

  return (
    <div className="space-y-2">
      {displayed.map((v) => (
        <div
          key={v.id}
          className="rounded-lg border px-4 py-3 bg-white flex items-center gap-3"
          style={{ borderColor: T.border }}
        >
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium" style={{ color: T.text1 }}>
            {titleCase(v.violation_type)}
          </span>
          <span className="text-xs ml-auto shrink-0" style={{ color: T.text2 }}>
            {v.violations_cited} cited
          </span>
        </div>
      ))}

      {hasMore && viewAllHref && (
        <a
          href={viewAllHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-3 px-4 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 mt-3"
          style={{ color: T.accent, borderColor: T.border }}
        >
          View All {totalCount || sorted.length} Violation Types
        </a>
      )}
    </div>
  );
}
