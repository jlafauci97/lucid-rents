import { Bug } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { BedBugReport } from "@/types";

interface BedBugTimelineProps {
  reports: BedBugReport[];
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
}

export function BedBugTimeline({ reports, viewAllHref, limit = 10, totalCount }: BedBugTimelineProps) {
  if (reports.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No bedbug reports on record.
      </p>
    );
  }

  const displayed = reports.slice(0, limit);
  const hasMore = reports.length > limit;

  return (
    <div className="space-y-3">
      {displayed.map((r) => {
        const hasInfestation = r.infested_dwelling_unit_count != null && r.infested_dwelling_unit_count > 0;
        return (
          <div
            key={r.id}
            className={`rounded-lg border p-4 ${hasInfestation ? "bg-purple-50" : "bg-gray-50"}`}
            style={{ borderColor: T.border }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <Bug className={`w-5 h-5 mt-0.5 ${hasInfestation ? "text-purple-600" : "text-gray-500"}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {hasInfestation && (
                      <Badge variant="danger">
                        {r.infested_dwelling_unit_count} unit{r.infested_dwelling_unit_count !== 1 ? "s" : ""} infested
                      </Badge>
                    )}
                    {r.eradicated_unit_count != null && r.eradicated_unit_count > 0 && (
                      <Badge variant="success">
                        {r.eradicated_unit_count} eradicated
                      </Badge>
                    )}
                  </div>
                  {r.total_dwelling_units != null && (
                    <p className="text-xs mt-1" style={{ color: T.text2 }}>
                      Building total: {r.total_dwelling_units} dwelling units
                    </p>
                  )}
                  {r.filing_period_start_date && r.filing_period_end_date && (
                    <p className="text-xs mt-1" style={{ color: T.text2 }}>
                      Period: {formatDate(r.filing_period_start_date)} &ndash; {formatDate(r.filing_period_end_date)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {r.filing_date && (
                  <span className="text-xs block" style={{ color: T.text2 }}>
                    {formatDate(r.filing_date)}
                  </span>
                )}
              </div>
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
          View All {totalCount || reports.length} Reports
        </a>
      )}
    </div>
  );
}
