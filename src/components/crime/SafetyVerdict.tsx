import { LetterGrade } from "@/components/ui/LetterGrade";
import type { SafetyGrade } from "@/lib/crime-stats";

const GRADE_SCORES: Record<SafetyGrade, number> = {
  A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.5,
};
const GRADE_LABELS: Record<SafetyGrade, string> = {
  A: "Very Safe", B: "Moderately Safe", C: "Average Safety",
  D: "Below Average Safety", F: "High Crime Area",
};
const GRADE_COLORS: Record<SafetyGrade, string> = {
  A: "bg-emerald-50 border-emerald-200",
  B: "bg-blue-50 border-blue-200",
  C: "bg-amber-50 border-amber-200",
  D: "bg-orange-50 border-orange-200",
  F: "bg-red-50 border-red-200",
};

interface SafetyVerdictProps {
  grade: SafetyGrade;
  displayName: string;
  verdictText: string;
}

export function SafetyVerdict({ grade, displayName, verdictText }: SafetyVerdictProps) {
  return (
    <div className={`rounded-xl border-2 p-6 mb-8 ${GRADE_COLORS[grade]}`}>
      <div className="flex items-start gap-4">
        <LetterGrade score={GRADE_SCORES[grade]} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#64748b] uppercase tracking-wide mb-1">
            Safety Verdict
          </p>
          <h2 className="text-xl font-bold text-[#0F1D2E] mb-2">
            {displayName}: {GRADE_LABELS[grade]}
          </h2>
          <p className="text-sm text-[#334155] leading-relaxed">
            {verdictText}
          </p>
        </div>
      </div>
    </div>
  );
}
