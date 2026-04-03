import { HardHat, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { DobViolation } from "@/types";

interface DobViolationTimelineProps {
  violations: DobViolation[];
  agencyLabel?: string;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  "V*-DOB VIOLATION - ACTIVE": { bg: "bg-red-50", text: "text-red-700" },
  "V-DOB VIOLATION - DISMISSED": { bg: "bg-green-50", text: "text-green-700" },
  "V-DOB VIOLATION - RESOLVE": { bg: "bg-green-50", text: "text-green-700" },
};

function getCategoryStyle(category: string | null) {
  if (!category) return { bg: "bg-gray-50", text: "text-gray-700" };
  const upper = category.toUpperCase();
  for (const [key, style] of Object.entries(categoryColors)) {
    if (upper.includes(key)) return style;
  }
  if (upper.includes("ACTIVE") || upper.includes("FAIL")) {
    return { bg: "bg-red-50", text: "text-red-700" };
  }
  if (upper.includes("DISMISS") || upper.includes("RESOLVE") || upper.includes("CLOSED")) {
    return { bg: "bg-green-50", text: "text-green-700" };
  }
  return { bg: "bg-orange-50", text: "text-orange-700" };
}

export function DobViolationTimeline({ violations, agencyLabel = "DOB" }: DobViolationTimelineProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No {agencyLabel} violations on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map((v) => {
        const style = getCategoryStyle(v.violation_category);
        const isResolved = v.disposition_date != null;
        return (
          <div
            key={v.id}
            className={`rounded-lg border border-[#e2e8f0] p-4 ${style.bg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {isResolved ? (
                  <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                ) : (
                  <HardHat className={`w-5 h-5 mt-0.5 ${style.text}`} />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {v.violation_type && (
                      <Badge variant="default">
                        {v.violation_type}
                      </Badge>
                    )}
                    <Badge variant={isResolved ? "success" : "warning"}>
                      {isResolved ? "Resolved" : "Open"}
                    </Badge>
                  </div>
                  {v.description && (
                    <p className="text-sm text-[#0F1D2E] mt-1">
                      {v.description}
                    </p>
                  )}
                  {v.disposition_comments && isResolved && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Disposition: {v.disposition_comments}
                    </p>
                  )}
                  {v.penalty_amount != null && v.penalty_amount > 0 && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Penalty: ${v.penalty_amount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {v.issue_date && (
                  <span className="text-xs text-[#64748b] block">
                    {formatDate(v.issue_date)}
                  </span>
                )}
                {v.disposition_date && isResolved && (
                  <span className="text-xs text-green-600 block mt-0.5">
                    Resolved: {formatDate(v.disposition_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
