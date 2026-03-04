import { getLetterGrade, getGradeColor } from "@/lib/constants";

interface LetterGradeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm rounded-md",
  md: "w-12 h-12 text-xl rounded-lg",
  lg: "w-16 h-16 text-3xl rounded-xl",
};

export function LetterGrade({ score, size = "md", showScore = false }: LetterGradeProps) {
  if (score === null) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-100 flex items-center justify-center`}>
        <span className="text-gray-400 text-xs font-bold">N/A</span>
      </div>
    );
  }

  const grade = getLetterGrade(score);
  const color = getGradeColor(grade);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses[size]} flex items-center justify-center font-bold text-white`}
        style={{ backgroundColor: color }}
      >
        {grade}
      </div>
      {showScore && (
        <span className="text-xs font-medium text-[#64748b]">
          {score.toFixed(1)}/10
        </span>
      )}
    </div>
  );
}
