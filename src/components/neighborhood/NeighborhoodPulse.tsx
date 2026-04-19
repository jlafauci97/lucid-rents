import { AlertTriangle, MessageSquare, ClipboardList, TrendingUp, TrendingDown } from "lucide-react";

export function NeighborhoodPulse({ zipCode, crimeTotal, violationCount, complaintCount, reviewCount, buildingCount }: {
  zipCode: string; crimeTotal: number | null; violationCount: number; complaintCount: number; reviewCount: number; buildingCount: number;
}) {
  const violationsPerBuilding = buildingCount > 0 ? violationCount / buildingCount : 0;
  const complaintsPerBuilding = buildingCount > 0 ? complaintCount / buildingCount : 0;
  const activityLevel = violationsPerBuilding > 10 ? "high" : violationsPerBuilding > 3 ? "moderate" : "low";
  const colors = { high: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" }, moderate: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }, low: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" } }[activityLevel];

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#0F1D2E]">Neighborhood Pulse</h2>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {activityLevel === "high" ? "High Activity" : activityLevel === "moderate" ? "Moderate" : "Low Activity"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Violations/Bldg</span></div>
          <p className="text-lg font-bold text-[#0F1D2E]">{violationsPerBuilding.toFixed(1)}</p>
          <p className="text-[10px] text-[#94a3b8]">{violationsPerBuilding <= 3 ? "Below avg" : violationsPerBuilding <= 10 ? "Average" : "Above avg"}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-[#F59E0B]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Complaints/Bldg</span></div>
          <p className="text-lg font-bold text-[#0F1D2E]">{complaintsPerBuilding.toFixed(1)}</p>
          <p className="text-[10px] text-[#94a3b8]">{complaintsPerBuilding <= 2 ? "Below avg" : complaintsPerBuilding <= 5 ? "Average" : "Above avg"}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-[#3B82F6]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Reviews</span></div>
          <p className="text-lg font-bold text-[#0F1D2E]">{reviewCount.toLocaleString()}</p>
          <p className="text-[10px] text-[#94a3b8]">Tenant reviews</p>
        </div>
        {crimeTotal !== null && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">{crimeTotal > 500 ? <TrendingUp className="w-3.5 h-3.5 text-[#EF4444]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#10B981]" />}<span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Crime (12mo)</span></div>
            <p className="text-lg font-bold text-[#0F1D2E]">{crimeTotal.toLocaleString()}</p>
            <p className="text-[10px] text-[#94a3b8]">Total incidents</p>
          </div>
        )}
      </div>
    </div>
  );
}
