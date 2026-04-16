import { TrendBadge } from "@/components/ui/TrendBadge";

interface StatItem {
  label: string;
  value: number;
  cityAvg: number;
  yoyPct: number | null;
  color?: string;
}

interface CrimeStatsGridProps {
  stats: StatItem[];
}

function ComparisonBar({ value, cityAvg }: { value: number; cityAvg: number }) {
  const max = Math.max(value, cityAvg, 1);
  const valuePct = Math.round((value / max) * 100);
  const avgPct = Math.round((cityAvg / max) * 100);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#64748b] w-16 shrink-0">This zip</span>
        <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0F1D2E] rounded-full transition-all"
            style={{ width: `${valuePct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#94a3b8] w-16 shrink-0">City avg</span>
        <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#cbd5e1] rounded-full transition-all"
            style={{ width: `${avgPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function CrimeStatsGrid({ stats }: CrimeStatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p
            className="text-xs font-medium uppercase tracking-wide mb-1"
            style={{ color: stat.color || "#64748b" }}
          >
            {stat.label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#0F1D2E]">
              {stat.value.toLocaleString()}
            </p>
            {stat.yoyPct !== null && (
              <TrendBadge value={stat.yoyPct} />
            )}
          </div>
          <ComparisonBar value={stat.value} cityAvg={stat.cityAvg} />
        </div>
      ))}
    </div>
  );
}
