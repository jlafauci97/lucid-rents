import { AlertTriangle, MessageSquareWarning } from "lucide-react";
import { T } from "@/lib/design-tokens";

interface CommonIssuesProps {
  topViolations: { type: string; count: number }[];
  topComplaints: { type: string; count: number }[];
}

export function CommonIssues({ topViolations, topComplaints }: CommonIssuesProps) {
  if (topViolations.length === 0 && topComplaints.length === 0) return null;

  const maxV = Math.max(...topViolations.map(v => v.count), 1);
  const maxC = Math.max(...topComplaints.map(c => c.count), 1);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      {topViolations.length > 0 && (
        <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: T.danger }} />
            <h4 className="text-sm font-semibold" style={{ color: T.text1 }}>Top Violations</h4>
          </div>
          <div className="space-y-2.5">
            {topViolations.map(v => (
              <div key={v.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: T.text2 }}>{v.type}</span>
                  <span className="text-xs tabular-nums font-medium" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>{v.count}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: T.danger, width: `${(v.count / maxV) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topComplaints.length > 0 && (
        <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquareWarning className="w-4 h-4" style={{ color: T.gold }} />
            <h4 className="text-sm font-semibold" style={{ color: T.text1 }}>Top 311 Complaints</h4>
          </div>
          <div className="space-y-2.5">
            {topComplaints.map(c => (
              <div key={c.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: T.text2 }}>{c.type}</span>
                  <span className="text-xs tabular-nums font-medium" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>{c.count}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: T.gold, width: `${(c.count / maxC) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
