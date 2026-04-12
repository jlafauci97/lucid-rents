"use client";

import { motion } from "framer-motion";
import type { CrimeSignal } from "./types";
import { gradeColor } from "@/lib/design-tokens";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface NeighborhoodSafetyCardProps {
  crime: CrimeSignal | null;
}

function GradeRing({ grade, size = 80 }: { grade: string; size?: number }) {
  const color = gradeColor(grade);
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const gradeMap: Record<string, number> = { A: 0.95, B: 0.75, C: 0.55, D: 0.35, F: 0.15 };
  const fill = gradeMap[grade] ?? 0.5;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <motion.circle
          cx={size/2}
          cy={size/2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fill) }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-2xl font-black"
          style={{ color }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.8 }}
        >
          {grade}
        </motion.span>
      </div>
    </div>
  );
}

export function NeighborhoodSafetyCard({ crime }: NeighborhoodSafetyCardProps) {
  if (!crime) {
    return (
      <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-3">
          Neighborhood Safety
        </p>
        <p className="text-sm text-gray-300 italic">Data unavailable</p>
      </div>
    );
  }

  const TrendIcon = crime.trend_label === "improving" ? TrendingDown : crime.trend_label === "worsening" ? TrendingUp : Minus;
  const trendColor = crime.trend_label === "improving" ? "text-emerald-600" : crime.trend_label === "worsening" ? "text-red-600" : "text-gray-500";
  const levelWord = ["A", "B"].includes(crime.safety_grade) ? "low" : crime.safety_grade === "C" ? "moderate" : "high";

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      {crime.trend_label === "worsening" && crime.yoy_violent_trend > 10 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-red-700 font-medium">
          <AlertTriangle size={14} />
          Violent crime up {Math.round(crime.yoy_violent_trend)}% year over year
        </div>
      )}

      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-5">
        Neighborhood Safety
      </p>

      <div className="flex items-center gap-6">
        <GradeRing grade={crime.safety_grade} />
        <div className="flex-1">
          <p className="text-sm text-gray-700 font-medium mb-1">
            {levelWord.charAt(0).toUpperCase() + levelWord.slice(1)} crime area compared to NYC
          </p>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
            <TrendIcon size={14} />
            {crime.trend_label.charAt(0).toUpperCase() + crime.trend_label.slice(1)} year over year
            {crime.yoy_violent_trend !== 0 && ` (${crime.yoy_violent_trend > 0 ? "+" : ""}${Math.round(crime.yoy_violent_trend)}%)`}
          </div>

          {/* Crime breakdown */}
          <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
            <span>Felony: {crime.violent_count}</span>
            <span>Misdemeanor: {crime.property_count}</span>
            <span>Violation: {crime.qol_count}</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-300 mt-5">
        NYC Open Data — NYPD Complaint Data (last 12 months)
      </p>
    </div>
  );
}
