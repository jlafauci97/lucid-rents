import { ShieldCheck } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { GradeBar } from "@/components/ui/GradeBar";
import { getLetterGrade } from "@/lib/constants";
import {
  computeNeighborhoodRiskGrade,
  type RiskGradeInput,
} from "@/lib/neighborhood-risks/composite";

interface Props {
  neighborhoodName: string;
  input: RiskGradeInput;
}

/**
 * Server-rendered composite "Livability Risk Grade" card. Pure presentation
 * over computeNeighborhoodRiskGrade — fed entirely by aggregates the
 * neighborhood page already fetches.
 */
export function RiskGradeCard({ neighborhoodName, input }: Props) {
  const result = computeNeighborhoodRiskGrade(input);
  if (!result) return null;

  return (
    <section
      id="risk-grade"
      className="scroll-mt-28 bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck aria-hidden="true" className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">
          Livability Risk Grade
        </h2>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <LetterGrade score={result.score / 20} size="lg" />
          <div>
            <p className="text-2xl font-bold text-[#0F1D2E]">
              {result.score.toFixed(0)}
              <span className="text-sm font-medium text-[#94a3b8]">/100</span>
            </p>
            <p className="text-xs text-[#94a3b8]">{neighborhoodName}</p>
          </div>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {result.components.map((c, i) => (
            <GradeBar
              key={c.key}
              label={c.label}
              grade={getLetterGrade(c.score / 20)}
              score={c.score}
              maxScore={100}
              delay={i * 0.08}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-[#94a3b8] mt-4">
        Composite of crime, building violations, and nearby-concern density —
        lower risk scores higher.
      </p>
    </section>
  );
}
