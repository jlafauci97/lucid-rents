import { ClipboardList, Clock, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { DobPermit } from "@/types";

interface PermitTimelineProps {
  permits: DobPermit[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  "Permit Issued": { bg: "bg-green-50", text: "text-green-700" },
  "Permit Entire": { bg: "bg-blue-50", text: "text-blue-700" },
  "Permit Renewed": { bg: "bg-teal-50", text: "text-teal-700" },
  "Sign-Off": { bg: "bg-gray-50", text: "text-gray-700" },
};

function formatCost(cost: number | null): string | null {
  if (cost == null || cost === 0) return null;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(0)}K`;
  return `$${cost.toLocaleString()}`;
}

export function PermitTimeline({ permits }: PermitTimelineProps) {
  if (permits.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No DOB permits on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {permits.map((p) => {
        const colors = statusColors[p.permit_status || ""] || { bg: "bg-gray-50", text: "text-gray-700" };
        const cost = formatCost(p.estimated_job_costs);

        return (
          <div
            key={p.id}
            className={`rounded-lg border border-[#e2e8f0] p-4 ${colors.bg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <ClipboardList className={`w-5 h-5 mt-0.5 ${colors.text}`} />
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.work_type && (
                      <Badge variant="default">
                        {p.work_type}
                      </Badge>
                    )}
                    {p.filing_reason && (
                      <Badge variant={p.filing_reason === "Initial" ? "success" : "warning"}>
                        {p.filing_reason}
                      </Badge>
                    )}
                    {p.permit_status && (
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {p.permit_status}
                      </span>
                    )}
                  </div>
                  {p.job_description && (
                    <p className="text-sm text-[#0F1D2E] mt-1 line-clamp-2">
                      {p.job_description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#64748b]">
                    {cost && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {cost}
                      </span>
                    )}
                    {p.expired_date && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {formatDate(p.expired_date)}
                      </span>
                    )}
                    {p.owner_business_name && (
                      <span className="hidden sm:inline">
                        Owner: {p.owner_business_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {p.issued_date && (
                <span className="text-xs text-[#64748b] shrink-0">
                  {formatDate(p.issued_date)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
