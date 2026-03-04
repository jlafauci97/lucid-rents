import { getScoreColor, getScoreLabel } from "@/lib/constants";

interface ScoreGaugeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizeClasses = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-20 h-20 text-2xl",
};

export function ScoreGauge({ score, size = "md", showLabel = false }: ScoreGaugeProps) {
  if (score === null) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-100 flex items-center justify-center`}>
        <span className="text-gray-400 text-xs">N/A</span>
      </div>
    );
  }

  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white`}
        style={{ backgroundColor: color }}
      >
        {score.toFixed(1)}
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
