import { TrendingUp } from "lucide-react";

const STATS_LABELS = [
  "Housing Violations",
  "311 Complaints",
  "Litigations",
  "Building Violations",
  "Buildings Tracked",
];

export function FeedStatsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <h3 className="text-sm font-bold text-[#0F1D2E]">Data Snapshot</h3>
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {STATS_LABELS.map((label) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3" aria-hidden>
            <div className="w-8 h-8 rounded-lg bg-[#f1f5f9]" />
            <div className="flex-1">
              <p className="text-xs text-[#64748b]">{label}</p>
              <div className="h-4 w-16 bg-[#f1f5f9] rounded mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendingBuildingsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <h3 className="text-sm font-bold text-[#0F1D2E] flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          Most Flagged Buildings
        </h3>
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3" aria-hidden>
            <span className="text-xs font-bold text-[#94a3b8] mt-0.5 w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="h-4 w-3/4 bg-[#f1f5f9] rounded" />
              <div className="h-3 w-1/2 bg-[#f1f5f9] rounded mt-1.5" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-[#f1f5f9]">
        <div className="h-4 w-32 bg-[#f1f5f9] rounded" />
      </div>
    </div>
  );
}
