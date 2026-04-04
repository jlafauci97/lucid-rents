import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { HpdViolation } from "@/types";

interface ViolationTimelineProps {
  violations: HpdViolation[];
  agencyLabel?: string;
}

const classColors: Record<string, { bg: string; text: string; label: string }> = {
  C: { bg: "bg-red-50", text: "text-red-700", label: "Immediately Hazardous" },
  B: { bg: "bg-orange-50", text: "text-orange-700", label: "Hazardous" },
  A: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Non-Hazardous" },
  I: { bg: "bg-blue-50", text: "text-blue-700", label: "Info" },
};

export function ViolationTimeline({ violations, agencyLabel = "HPD" }: ViolationTimelineProps) {
  if (violations.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No {agencyLabel} violations on record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map((v) => {
        const cls = classColors[v.class] || classColors.A;
        const isOpen = v.status === "Open";
        return (
          <div
            key={v.id}
            className={`rounded-lg border p-4 ${cls.bg}`}
            style={{ borderColor: T.border }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {isOpen ? (
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${cls.text}`} />
                ) : (
                  <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={
                        v.class === "C"
                          ? "danger"
                          : v.class === "B"
                          ? "warning"
                          : "default"
                      }
                    >
                      Class {v.class} - {cls.label}
                    </Badge>
                    <Badge variant={isOpen ? "danger" : "success"}>
                      {v.status}
                    </Badge>
                  </div>
                  {v.nov_description && (
                    <p className="text-sm mt-1" style={{ color: T.text1 }}>
                      {v.nov_description}
                    </p>
                  )}
                  {v.apartment && (
                    <p className="text-xs mt-1" style={{ color: T.text2 }}>
                      Apt: {v.apartment}
                    </p>
                  )}
                </div>
              </div>
              {v.inspection_date && (
                <span className="text-xs shrink-0" style={{ color: T.text2 }}>
                  {formatDate(v.inspection_date)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
