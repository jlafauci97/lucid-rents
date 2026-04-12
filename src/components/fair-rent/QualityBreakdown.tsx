"use client";

import { motion } from "framer-motion";
import type { PricingResult } from "./types";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

function fmt(n: number): string {
  return (n >= 0 ? "+$" : "-$") + Math.abs(Math.round(n)).toLocaleString();
}

function pctFmt(n: number): string {
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

export function QualityBreakdown({ pricing }: { pricing: PricingResult }) {
  const factors = pricing.quality_factors;
  if (factors.length === 0) return null;

  const totalAdj = pricing.quality_adjustment;
  const totalDollar = factors.reduce((sum, f) => sum + f.dollar_impact, 0);

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 sm:px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[#00D4FF]" />
          <p className="text-[10px] font-mono font-bold tracking-[2px] uppercase text-[#00D4FF]/50">
            Quality Factor Breakdown
          </p>
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold font-mono ${totalAdj < 0 ? "text-red-400" : totalAdj > 0 ? "text-[#00D4FF]" : "text-white/30"}`}>
            {pctFmt(totalAdj)}
          </span>
          <span className="text-[9px] font-mono text-white/20 ml-2">net adjustment</span>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-4">
        {/* Visual bar showing all factor contributions */}
        <div className="mb-6">
          <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden bg-white/[0.04]">
            {factors.map((f, i) => {
              if (f.adjustment === 0) return null;
              const width = Math.max(2, Math.abs(f.adjustment) / 0.15 * 100);
              const isDiscount = f.adjustment < 0;
              return (
                <motion.div
                  key={f.name}
                  className={`h-full flex items-center justify-center text-[8px] font-mono font-bold ${
                    isDiscount ? "bg-red-500/30 text-red-300" : "bg-[#00D4FF]/30 text-[#00D4FF]"
                  }`}
                  style={{ minWidth: `${width}%`, flex: `${width} 0 0` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }}
                  title={f.name}
                >
                  {Math.abs(f.adjustment) >= 0.02 && (
                    <span className="truncate px-1">{pctFmt(f.adjustment)}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-white/15 mt-1">
            <span>Discounts</span>
            <span>Premiums</span>
          </div>
        </div>

        {/* Factor rows */}
        <div className="space-y-3">
          {factors.map((factor, i) => {
            const DirIcon = factor.direction === "premium" ? TrendingUp : factor.direction === "discount" ? TrendingDown : Minus;
            const color = factor.direction === "premium" ? "text-[#00D4FF]" : factor.direction === "discount" ? "text-red-400" : "text-white/30";
            const bgColor = factor.direction === "premium" ? "bg-[#00D4FF]/[0.06]" : factor.direction === "discount" ? "bg-red-500/[0.06]" : "bg-white/[0.02]";

            return (
              <motion.div
                key={factor.name}
                className={`${bgColor} rounded-xl px-4 py-3 border border-white/[0.04]`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 + 0.2 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <DirIcon size={13} className={color} />
                    <span className="text-xs font-mono font-semibold text-white/60">{factor.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold ${color}`}>
                      {pctFmt(factor.adjustment)}
                    </span>
                    <span className={`text-xs font-mono ${color}`}>
                      {fmt(factor.dollar_impact)}/mo
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-white/25 leading-relaxed">{factor.detail}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-white/15 bg-white/[0.04] px-2 py-0.5 rounded">
                    {factor.signal}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Total */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-wider">Net Quality Adjustment</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold font-mono ${totalAdj < 0 ? "text-red-400" : totalAdj > 0 ? "text-[#00D4FF]" : "text-white/30"}`}>
              {pctFmt(totalAdj)}
            </span>
            <span className={`text-sm font-mono ${totalAdj < 0 ? "text-red-400" : totalAdj > 0 ? "text-[#00D4FF]" : "text-white/30"}`}>
              {fmt(totalDollar)}/mo
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-3 border-t border-white/[0.04]">
        <p className="text-[8px] font-mono text-white/10 text-center">
          Each factor adjusts the base fair price. Discounts reflect risk; premiums reflect quality above area averages.
        </p>
      </div>
    </div>
  );
}
