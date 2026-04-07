import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { Complaint311 } from "@/types";

interface ComplaintTimelineProps {
  complaints: Complaint311[];
  viewAllHref?: string;
  limit?: number;
  totalCount?: number;
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

export function ComplaintTimeline({ complaints, viewAllHref, limit = 10, totalCount }: ComplaintTimelineProps) {
  if (complaints.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No 311 complaints on record.
      </p>
    );
  }

  const displayed = complaints.slice(0, limit);
  const hasMore = complaints.length > limit;

  return (
    <div className="space-y-3">
      {displayed.map((c) => {
        const style = getTypeStyle(c.complaint_type);
        return (
          <div
            key={c.id}
            className={`rounded-lg border p-4 ${style.bg}`}
            style={{ borderColor: T.border }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <MessageSquare className={`w-5 h-5 mt-0.5 ${style.text}`} />
                <div>
                  {c.complaint_type && (
                    <Badge variant="default">
                      {c.complaint_type}
                    </Badge>
                  )}
                  {c.descriptor && (
                    <p className="text-sm mt-1" style={{ color: T.text1 }}>
                      {c.descriptor}
                    </p>
                  )}
                  {c.agency && (
                    <p className="text-xs mt-1" style={{ color: T.text3 }}>
                      Agency: {c.agency}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {c.created_date && (
                  <span className="text-xs block" style={{ color: T.text2 }}>
                    {formatDate(c.created_date)}
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
          View All {totalCount ?? complaints.length} Complaints
        </a>
      )}
    </div>
  );
}
