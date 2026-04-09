import type { LandlordGrade } from "@/lib/landlord-stats";

interface LandlordVerdictProps {
  grade: LandlordGrade;
  verdict: string;
  avgScore: number;
  cityAvgScore: number;
}

const GRADE_CONFIG: Record<LandlordGrade, { bg: string; border: string; text: string; label: string }> = {
  A: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", label: "Excellent Landlord" },
  B: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", label: "Above Average" },
  C: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", label: "Average" },
  D: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", label: "Below Average" },
  F: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", label: "Poor Track Record" },
};

export function LandlordVerdict({ grade, verdict, avgScore, cityAvgScore }: LandlordVerdictProps) {
  const config = GRADE_CONFIG[grade];

  return (
    <div className={`${config.bg} border-l-4 ${config.border} rounded-xl p-5 mb-8`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-lg font-bold ${config.text}`}>
          Grade {grade} — {config.label}
        </span>
      </div>
      <p className="text-sm text-[#334155] leading-relaxed">{verdict}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">Portfolio Avg:</span>
          <span className="text-sm font-bold text-[#0F1D2E]">{avgScore.toFixed(1)}/10</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">City Avg:</span>
          <span className="text-sm font-bold text-[#0F1D2E]">{cityAvgScore.toFixed(1)}/10</span>
        </div>
      </div>
    </div>
  );
}
