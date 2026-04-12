import type { CrimeSignal } from "./types";
import { gradeColor } from "@/lib/design-tokens";

interface NeighborhoodSafetyCardProps {
  crime: CrimeSignal | null;
}

export function NeighborhoodSafetyCard({ crime }: NeighborhoodSafetyCardProps) {
  if (!crime) {
    return (
      <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-3">
          Neighborhood Safety
        </p>
        <p className="text-sm text-gray-300">Data unavailable</p>
      </div>
    );
  }

  const trendIcon =
    crime.trend_label === "improving" ? "\u2191" : crime.trend_label === "worsening" ? "\u2193" : "\u2192";
  const trendColor =
    crime.trend_label === "improving"
      ? "text-emerald-600"
      : crime.trend_label === "worsening"
        ? "text-red-600"
        : "text-gray-500";

  const levelWord = ["A", "B"].includes(crime.safety_grade)
    ? "low"
    : crime.safety_grade === "C"
      ? "moderate"
      : "high";

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      {crime.trend_label === "worsening" && crime.yoy_violent_trend > 10 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-5 text-xs text-red-700 font-medium">
          Violent crime increased {Math.round(crime.yoy_violent_trend)}% year over year in this area.
        </div>
      )}

      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-5">
        Neighborhood Safety
      </p>

      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold text-white"
          style={{ backgroundColor: gradeColor(crime.safety_grade) }}
        >
          {crime.safety_grade}
        </div>
        <div>
          <p className="text-sm text-gray-700 font-medium">
            {levelWord.charAt(0).toUpperCase() + levelWord.slice(1)} crime area compared to NYC median
          </p>
          <p className={`text-sm font-medium ${trendColor}`}>
            {trendIcon}{" "}
            {crime.trend_label.charAt(0).toUpperCase() + crime.trend_label.slice(1)} year over year
          </p>
        </div>
      </div>

      <p className="text-[13px] text-gray-500 leading-relaxed">{crime.summary}</p>

      <p className="text-[10px] text-gray-300 mt-5">
        NYC Open Data — NYPD Complaint Data (last 12 months)
      </p>
    </div>
  );
}
