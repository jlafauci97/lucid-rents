import { DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { Eviction } from "@/types";

interface EvictionTimelineProps {
  evictions: Eviction[];
}

export function EvictionTimeline({ evictions }: EvictionTimelineProps) {
  if (evictions.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: T.text2 }}>
        No eviction records on file.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {evictions.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border p-4 bg-pink-50"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <DoorOpen className="w-5 h-5 mt-0.5 text-pink-600" />
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {e.residential_commercial && (
                    <Badge variant="default">
                      {e.residential_commercial}
                    </Badge>
                  )}
                  {e.eviction_possession && (
                    <Badge variant="warning">
                      {e.eviction_possession}
                    </Badge>
                  )}
                </div>
                {e.eviction_apt_num && (
                  <p className="text-sm mt-1" style={{ color: T.text1 }}>
                    Unit: {e.eviction_apt_num}
                  </p>
                )}
                {e.marshal_first_name && e.marshal_last_name && (
                  <p className="text-xs mt-1" style={{ color: T.text2 }}>
                    Marshal: {e.marshal_first_name} {e.marshal_last_name}
                  </p>
                )}
                {e.court_index_number && (
                  <p className="text-xs mt-1" style={{ color: T.text2 }}>
                    Court Index: {e.court_index_number}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {e.executed_date && (
                <span className="text-xs block" style={{ color: T.text2 }}>
                  {formatDate(e.executed_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
