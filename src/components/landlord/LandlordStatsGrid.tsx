import { AlertTriangle, MessageSquare, Scale, HardHat } from "lucide-react";

interface StatItem {
  label: string;
  value: number;
  cityAvg: number;
  icon: React.ElementType;
  color: string;
  /** per-building normalized value */
  perBuilding: number;
}

interface LandlordStatsGridProps {
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  buildingCount: number;
  /** City average violations per landlord */
  cityAvgViolations: number;
  cityAvgComplaints: number;
  cityAvgLitigations: number;
  cityAvgDob: number;
}

export function LandlordStatsGrid({
  totalViolations,
  totalComplaints,
  totalLitigations,
  totalDobViolations,
  buildingCount,
  cityAvgViolations,
  cityAvgComplaints,
  cityAvgLitigations,
  cityAvgDob,
}: LandlordStatsGridProps) {
  const stats: StatItem[] = [
    {
      label: "HPD Violations",
      value: totalViolations,
      cityAvg: cityAvgViolations,
      icon: AlertTriangle,
      color: "#EF4444",
      perBuilding: buildingCount > 0 ? Math.round(totalViolations / buildingCount) : 0,
    },
    {
      label: "311 Complaints",
      value: totalComplaints,
      cityAvg: cityAvgComplaints,
      icon: MessageSquare,
      color: "#F59E0B",
      perBuilding: buildingCount > 0 ? Math.round(totalComplaints / buildingCount) : 0,
    },
    {
      label: "Litigations",
      value: totalLitigations,
      cityAvg: cityAvgLitigations,
      icon: Scale,
      color: "#8B5CF6",
      perBuilding: buildingCount > 0 ? Math.round(totalLitigations / buildingCount) : 0,
    },
    {
      label: "DOB Violations",
      value: totalDobViolations,
      cityAvg: cityAvgDob,
      icon: HardHat,
      color: "#3B82F6",
      perBuilding: buildingCount > 0 ? Math.round(totalDobViolations / buildingCount) : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const max = Math.max(stat.value, stat.cityAvg, 1);
        const valuePct = Math.min((stat.value / max) * 100, 100);
        const avgPct = Math.min((stat.cityAvg / max) * 100, 100);
        const isAbove = stat.value > stat.cityAvg;

        return (
          <div key={stat.label} className="bg-white border border-[#e2e8f0] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}14` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              </div>
              <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-[#0F1D2E]">
              {stat.value.toLocaleString()}
            </p>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              {stat.perBuilding}/bldg avg
            </p>

            {/* Comparison bars */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748b] w-12">This</span>
                <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${valuePct}%`,
                      backgroundColor: isAbove ? "#EF4444" : "#22c55e",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748b] w-12">City</span>
                <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#94a3b8] rounded-full"
                    style={{ width: `${avgPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
