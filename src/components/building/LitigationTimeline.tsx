import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { HpdLitigation } from "@/types";

interface LitigationTimelineProps {
  litigations: HpdLitigation[];
  agencyLabel?: string;
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
}

export function LitigationTimeline({ litigations, agencyLabel = "HPD", viewAllHref, limit = 10, totalCount }: LitigationTimelineProps) {
  if (litigations.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No {agencyLabel} litigations on record.
      </p>
    );
  }

  const displayed = litigations.slice(0, limit);
  const hasMore = litigations.length > limit;

  return (
    <div className="space-y-3">
      {displayed.map((lit) => (
        <div
          key={lit.id}
          className="rounded-lg border p-4 bg-violet-50"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 mt-0.5 text-violet-600" />
              <div>
                {lit.case_type && (
                  <Badge variant="default">
                    {lit.case_type}
                  </Badge>
                )}
                {lit.respondent && (
                  <p className="text-sm mt-1" style={{ color: T.text1 }}>
                    Respondent: {lit.respondent}
                  </p>
                )}
                {lit.case_judgment && (
                  <p className="text-xs mt-1" style={{ color: T.text2 }}>
                    Judgment: {lit.case_judgment}
                  </p>
                )}
                {lit.penalty && (
                  <p className="text-xs mt-1" style={{ color: T.text2 }}>
                    Penalty: {lit.penalty}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {lit.case_open_date && (
                <span className="text-xs block" style={{ color: T.text2 }}>
                  {formatDate(lit.case_open_date)}
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
          View All {totalCount ?? litigations.length} Litigations
        </a>
      )}
    </div>
  );
}
