import { Paintbrush, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { HpdLeadViolation } from "@/types";

interface LeadViolationTimelineProps {
  violations: HpdLeadViolation[];
}

export function LeadViolationTimeline({ violations }: LeadViolationTimelineProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No lead paint violations on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map((v) => {
        const isResolved = v.current_status?.toUpperCase().includes("CLOSE") || v.violation_status?.toUpperCase().includes("CLOSE");
        return (
          <div
            key={v.id}
            className={`rounded-lg border border-[#e2e8f0] p-4 ${isResolved ? "bg-green-50" : "bg-teal-50"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {isResolved ? (
                  <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                ) : (
                  <Paintbrush className="w-5 h-5 mt-0.5 text-teal-600" />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={isResolved ? "success" : "danger"}>
                      {isResolved ? "Closed" : "Open"}
                    </Badge>
                    {v.violation_status && (
                      <Badge variant="default">
                        {v.violation_status}
                      </Badge>
                    )}
                  </div>
                  {v.nov_description && (
                    <p className="text-sm text-[#0F1D2E] mt-1">
                      {v.nov_description}
                    </p>
                  )}
                  {v.apartment && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Apt: {v.apartment}{v.story ? `, Floor ${v.story}` : ""}
                    </p>
                  )}
                  {v.order_number && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Order: {v.order_number}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {v.nov_issued_date && (
                  <span className="text-xs text-[#64748b] block">
                    {formatDate(v.nov_issued_date)}
                  </span>
                )}
                {v.inspection_date && (
                  <span className="text-xs text-[#64748b] block mt-0.5">
                    Inspected: {formatDate(v.inspection_date)}
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
