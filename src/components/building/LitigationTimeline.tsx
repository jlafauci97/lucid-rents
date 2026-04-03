import { Scale, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { HpdLitigation } from "@/types";

interface LitigationTimelineProps {
  litigations: HpdLitigation[];
  agencyLabel?: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "bg-red-50", text: "text-red-700" },
  CLOSED: { bg: "bg-green-50", text: "text-green-700" },
  PENDING: { bg: "bg-amber-50", text: "text-amber-700" },
};

function getStatusStyle(status: string | null) {
  if (!status) return { bg: "bg-gray-50", text: "text-gray-700" };
  const upper = status.toUpperCase();
  for (const [key, style] of Object.entries(statusColors)) {
    if (upper.includes(key)) return style;
  }
  return { bg: "bg-gray-50", text: "text-gray-700" };
}

export function LitigationTimeline({ litigations, agencyLabel = "HPD" }: LitigationTimelineProps) {
  if (litigations.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No {agencyLabel} litigations on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {litigations.map((lit) => {
        const style = getStatusStyle(lit.case_status);
        const isClosed = lit.case_status?.toUpperCase().includes("CLOSED");
        return (
          <div
            key={lit.id}
            className={`rounded-lg border border-[#e2e8f0] p-4 ${style.bg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {isClosed ? (
                  <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                ) : (
                  <Scale className={`w-5 h-5 mt-0.5 ${style.text}`} />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {lit.case_type && (
                      <Badge variant="default">
                        {lit.case_type}
                      </Badge>
                    )}
                    <Badge variant={isClosed ? "success" : "danger"}>
                      {lit.case_status || "Unknown"}
                    </Badge>
                  </div>
                  {lit.respondent && (
                    <p className="text-sm text-[#0F1D2E] mt-1">
                      Respondent: {lit.respondent}
                    </p>
                  )}
                  {lit.case_judgment && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Judgment: {lit.case_judgment}
                    </p>
                  )}
                  {lit.penalty && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Penalty: {lit.penalty}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {lit.case_open_date && (
                  <span className="text-xs text-[#64748b] block">
                    Filed: {formatDate(lit.case_open_date)}
                  </span>
                )}
                {lit.case_close_date && isClosed && (
                  <span className="text-xs text-green-600 block mt-0.5">
                    Closed: {formatDate(lit.case_close_date)}
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
