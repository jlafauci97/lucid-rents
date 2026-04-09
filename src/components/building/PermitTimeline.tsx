import { ClipboardList, Clock, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { DobPermit } from "@/types";

interface PermitTimelineProps {
  permits: DobPermit[];
  agencyLabel?: string;
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
}

function formatCost(cost: number | null): string | null {
  if (cost == null || cost === 0) return null;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(0)}K`;
  return `$${cost.toLocaleString()}`;
}

export function PermitTimeline({ permits, agencyLabel = "DOB", viewAllHref, limit = 10, totalCount }: PermitTimelineProps) {
  if (permits.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No {agencyLabel} permits on record.
      </p>
    );
  }

  const displayed = permits.slice(0, limit);
  const hasMore = permits.length > limit;

  return (
    <div className="space-y-3">
      {displayed.map((p) => {
        const cost = formatCost(p.estimated_job_costs);
        return (
          <div
            key={p.id}
            className="rounded-lg border p-4 bg-teal-50"
            style={{ borderColor: T.border }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-5 h-5 mt-0.5 text-teal-600" />
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
                  </div>
                  {p.job_description && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: T.text1 }}>
                      {p.job_description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: T.text2 }}>
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
                <span className="text-xs shrink-0" style={{ color: T.text2 }}>
                  {formatDate(p.issued_date)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && viewAllHref && (
        <a
          href={viewAllHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-3 px-4 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ color: T.accent, borderColor: T.border }}
        >
          View All {totalCount || permits.length} Permits
        </a>
      )}
    </div>
  );
}
