import { HardHat } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { DobViolation } from "@/types";

interface DobViolationTimelineProps {
  violations: DobViolation[];
  agencyLabel?: string;
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
}

export function DobViolationTimeline({ violations, agencyLabel = "DOB", viewAllHref, limit = 10, totalCount }: DobViolationTimelineProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No {agencyLabel} violations on record.
      </p>
    );
  }

  const displayed = violations.slice(0, limit);
  const hasMore = violations.length > limit;

  return (
    <div className="space-y-3">
      {displayed.map((v) => (
        <div
          key={v.id}
          className="rounded-lg border p-4 bg-blue-50"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <HardHat className="w-5 h-5 mt-0.5 text-blue-600" />
              <div>
                {v.violation_type && (
                  <Badge variant="default">
                    {v.violation_type}
                  </Badge>
                )}
                {v.description && (
                  <p className="text-sm mt-1" style={{ color: T.text1 }}>
                    {v.description}
                  </p>
                )}
                {v.penalty_amount != null && v.penalty_amount > 0 && (
                  <p className="text-xs mt-1" style={{ color: T.text2 }}>
                    Penalty: ${v.penalty_amount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {v.issue_date && (
                <span className="text-xs block" style={{ color: T.text2 }}>
                  {formatDate(v.issue_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      {hasMore && viewAllHref && (
        <a
          href={viewAllHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-3 px-4 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ color: T.accent, borderColor: T.border }}
        >
          View All {totalCount || violations.length} Violations
        </a>
      )}
    </div>
  );
}
