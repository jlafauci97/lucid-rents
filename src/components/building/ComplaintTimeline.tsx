import { MessageSquare, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Complaint311 } from "@/types";

interface ComplaintTimelineProps {
  complaints: Complaint311[];
}

const typeColors: Record<string, { bg: string; text: string }> = {
  "HEAT/HOT WATER": { bg: "bg-red-50", text: "text-red-700" },
  "PLUMBING": { bg: "bg-blue-50", text: "text-blue-700" },
  "PAINT/PLASTER": { bg: "bg-orange-50", text: "text-orange-700" },
  "GENERAL CONSTRUCTION": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "ELECTRIC": { bg: "bg-purple-50", text: "text-purple-700" },
  "ELEVATOR": { bg: "bg-indigo-50", text: "text-indigo-700" },
  "DOOR/WINDOW": { bg: "bg-teal-50", text: "text-teal-700" },
  "SAFETY": { bg: "bg-red-50", text: "text-red-700" },
  "FLOORING/STAIRS": { bg: "bg-amber-50", text: "text-amber-700" },
  "WATER LEAK": { bg: "bg-cyan-50", text: "text-cyan-700" },
};

function getTypeStyle(type: string | null) {
  if (!type) return { bg: "bg-gray-50", text: "text-gray-700" };
  const upper = type.toUpperCase();
  for (const [key, style] of Object.entries(typeColors)) {
    if (upper.includes(key)) return style;
  }
  return { bg: "bg-gray-50", text: "text-gray-700" };
}

export function ComplaintTimeline({ complaints }: ComplaintTimelineProps) {
  if (complaints.length === 0) {
    return (
      <p className="text-sm text-[#64748b] py-4">
        No 311 complaints on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => {
        const style = getTypeStyle(c.complaint_type);
        const isClosed = c.status?.toLowerCase() === "closed";
        return (
          <div
            key={c.id}
            className={`rounded-lg border border-[#e2e8f0] p-4 ${style.bg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {isClosed ? (
                  <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                ) : (
                  <MessageSquare className={`w-5 h-5 mt-0.5 ${style.text}`} />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {c.complaint_type && (
                      <Badge variant="default">
                        {c.complaint_type}
                      </Badge>
                    )}
                    <Badge variant={isClosed ? "success" : "warning"}>
                      {isClosed ? "Closed" : c.status || "Open"}
                    </Badge>
                  </div>
                  {c.descriptor && (
                    <p className="text-sm text-[#0F1D2E] mt-1">
                      {c.descriptor}
                    </p>
                  )}
                  {c.resolution_description && isClosed && (
                    <p className="text-xs text-[#64748b] mt-1">
                      Resolution: {c.resolution_description}
                    </p>
                  )}
                  {c.agency && (
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Agency: {c.agency}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {c.created_date && (
                  <span className="text-xs text-[#64748b] block">
                    {formatDate(c.created_date)}
                  </span>
                )}
                {c.closed_date && isClosed && (
                  <span className="text-xs text-green-600 flex items-center gap-1 mt-0.5 justify-end">
                    <Clock className="w-3 h-3" />
                    {formatDate(c.closed_date)}
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
