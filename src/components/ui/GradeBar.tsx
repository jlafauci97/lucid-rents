"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { T, gradeColor } from "@/lib/design-tokens";

interface GradeBarProps {
  label: string;
  grade: string;
  score: number;
  maxScore?: number;
  delay?: number;
}

export function GradeBar({ label, grade, score, maxScore = 5, delay = 0 }: GradeBarProps) {
  const pct = (score / maxScore) * 100;
  const color = gradeColor(grade);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="flex items-center gap-3 sm:gap-4 group">
      <span
        className="w-[110px] sm:w-[130px] text-sm tracking-wide shrink-0"
        style={{ color: T.text2, fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      <span
        className="w-8 text-sm font-bold shrink-0"
        style={{ color, fontFamily: "var(--font-mono)" }}
      >
        {grade}
      </span>
      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <span
        className="w-10 text-right text-xs tabular-nums shrink-0"
        style={{ color: T.text3, fontFamily: "var(--font-mono)" }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}
