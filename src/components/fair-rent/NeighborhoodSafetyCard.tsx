"use client";

import { motion } from "framer-motion";
import type { CrimeSignal } from "./types";
import { gradeColor } from "@/lib/design-tokens";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

function GradeRing({ grade, size = 80 }: { grade: string; size?: number }) {
  const color = gradeColor(grade);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill: Record<string, number> = { A: 0.95, B: 0.75, C: 0.55, D: 0.35, F: 0.15 };
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - (fill[grade] ?? 0.5)) }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span className="text-2xl font-black font-mono" style={{ color }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.8 }}>
          {grade}
        </motion.span>
      </div>
    </div>
  );
}

export function NeighborhoodSafetyCard({ crime }: { crime: CrimeSignal | null }) {
  if (!crime) return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
      <p className="text-[10px] font-mono font-bold tracking-[2px] uppercase text-white/15 mb-3">Neighborhood Safety</p>
      <p className="text-xs font-mono text-white/15 italic">No data</p>
    </div>
  );

  const TrendIcon = crime.trend_label === "improving" ? TrendingDown : crime.trend_label === "worsening" ? TrendingUp : Minus;
  const trendColor = crime.trend_label === "improving" ? "text-[#00D4FF]" : crime.trend_label === "worsening" ? "text-red-400" : "text-white/30";
  const level = ["A", "B"].includes(crime.safety_grade) ? "Low" : crime.safety_grade === "C" ? "Moderate" : "High";

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
      {crime.trend_label === "worsening" && crime.yoy_violent_trend > 10 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 mb-5 text-[10px] font-mono text-red-400 font-medium">
          <AlertTriangle size={13} /> Violent crime +{Math.round(crime.yoy_violent_trend)}% YoY
        </div>
      )}
      <p className="text-[10px] font-mono font-bold tracking-[2px] uppercase text-[#00D4FF]/50 mb-5">Neighborhood Safety</p>
      <div className="flex items-center gap-6">
        <GradeRing grade={crime.safety_grade} />
        <div className="flex-1">
          <p className="text-sm font-mono text-white/60">{level} crime vs NYC</p>
          <div className={`flex items-center gap-1.5 text-xs font-mono font-medium ${trendColor} mt-1`}>
            <TrendIcon size={13} />{crime.trend_label.charAt(0).toUpperCase() + crime.trend_label.slice(1)} YoY
            {crime.yoy_violent_trend !== 0 && ` (${crime.yoy_violent_trend > 0 ? "+" : ""}${Math.round(crime.yoy_violent_trend)}%)`}
          </div>
          <div className="flex gap-4 mt-3 text-[9px] font-mono text-white/15">
            <span>Felony: {crime.violent_count}</span><span>Misdem: {crime.property_count}</span><span>Viol: {crime.qol_count}</span>
          </div>
        </div>
      </div>
      <p className="text-[8px] font-mono text-white/10 mt-5">NYC Open Data — NYPD (12mo)</p>
    </div>
  );
}
