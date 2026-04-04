import { Building2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { deriveScore } from "@/lib/constants";

interface Building {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  overall_score: number | null;
  violation_count: number;
  complaint_count: number;
  total_units?: number | null;
}

interface LandlordPortfolioSummaryProps {
  buildings: Building[];
  cityAvgScore: number;
}

export function LandlordPortfolioSummary({
  buildings,
  cityAvgScore,
}: LandlordPortfolioSummaryProps) {
  const totalBuildings = buildings.length;
  const totalUnits = buildings.reduce(
    (sum, b) => sum + (b.total_units || 0),
    0
  );
  const totalViolations = buildings.reduce(
    (sum, b) => sum + (b.violation_count || 0),
    0
  );
  const avgScore =
    buildings.reduce(
      (sum, b) =>
        sum +
        (b.overall_score ??
          deriveScore(b.violation_count || 0, b.complaint_count || 0)),
      0
    ) / totalBuildings;

  const diff = avgScore - cityAvgScore;
  const isAboveAverage = diff > 0;
  const diffFormatted = Math.abs(diff).toFixed(1);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
        Portfolio Summary
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="text-center">
          <Building2 className="w-5 h-5 text-[#3B82F6] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalBuildings}
          </p>
          <p className="text-xs text-[#94a3b8]">Buildings</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#0F1D2E] mt-6">
            {totalUnits > 0 ? totalUnits.toLocaleString() : "---"}
          </p>
          <p className="text-xs text-[#94a3b8]">Total Units</p>
        </div>
        <div className="text-center">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalViolations.toLocaleString()}
          </p>
          <p className="text-xs text-[#94a3b8]">Total Violations</p>
        </div>
        <div className="text-center">
          <div className="flex justify-center mb-1">
            <LetterGrade score={avgScore} size="sm" />
          </div>
          <p className="text-xs text-[#94a3b8]">Avg Score</p>
        </div>
      </div>

      {/* City comparison */}
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-3 ${
          isAboveAverage
            ? "bg-emerald-50 border border-emerald-200"
            : "bg-red-50 border border-red-200"
        }`}
      >
        {isAboveAverage ? (
          <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-600 flex-shrink-0" />
        )}
        <p className="text-sm">
          <span className="text-[#64748b]">
            This landlord&apos;s buildings average{" "}
          </span>
          <span
            className={`font-bold ${isAboveAverage ? "text-emerald-700" : "text-red-700"}`}
          >
            {avgScore.toFixed(1)}/10
          </span>
          <span className="text-[#64748b]">, compared to the city average of </span>
          <span className="font-bold text-[#0F1D2E]">
            {cityAvgScore.toFixed(1)}/10
          </span>
          <span className="text-[#64748b]"> (</span>
          <span
            className={`font-semibold ${isAboveAverage ? "text-emerald-700" : "text-red-700"}`}
          >
            {isAboveAverage ? "+" : "-"}
            {diffFormatted}
          </span>
          <span className="text-[#64748b]">)</span>
        </p>
      </div>
    </div>
  );
}
