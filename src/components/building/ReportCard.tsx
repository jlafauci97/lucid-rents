import { T, gradeColor } from "@/lib/design-tokens";
import { GradeBar } from "@/components/ui/GradeBar";
import { SectionTitle } from "@/components/ui/SectionTitle";

interface GradeDimension {
  label: string;
  grade: string;
  score: number;
}

interface ReportCardProps {
  overallGrade: string;
  overallScore: number;
  summary: string;
  grades: GradeDimension[];
}

export function ReportCard({ overallGrade, overallScore, summary, grades }: ReportCardProps) {
  if (grades.length === 0) return null;

  return (
    <section id="report-card" className="scroll-mt-28">
      <SectionTitle subtitle="Composite scores based on tenant reviews, public records, and complaint data">
        Building Report Card
      </SectionTitle>

      <div
        className="rounded-2xl border p-6 sm:p-8 shadow-sm"
        style={{ backgroundColor: T.surface, borderColor: T.border }}
      >
        {/* Overall grade hero */}
        <div className="flex items-center gap-6 mb-8 pb-8" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div
            className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-sm shrink-0"
            style={{ backgroundColor: `${gradeColor(overallGrade)}10` }}
          >
            <span
              className="text-3xl font-bold"
              style={{ color: gradeColor(overallGrade), fontFamily: "var(--font-display)" }}
            >
              {overallGrade}
            </span>
            <span
              className="text-[10px] -mt-0.5 tabular-nums"
              style={{ color: T.text3, fontFamily: "var(--font-mono)" }}
            >
              {overallScore.toFixed(1)}/5
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
              Overall Grade: {overallGrade}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: T.text2 }}>
              {summary}
            </p>
          </div>
        </div>

        {/* Grade bars */}
        <div className="space-y-4">
          {grades.map(({ label, grade, score }, i) => (
            <GradeBar key={label} label={label} grade={grade} score={score} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}
