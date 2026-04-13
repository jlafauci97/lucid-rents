"use client";

import { motion } from "framer-motion";
import type { PricingResult } from "./types";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

function fmt(n: number): string { return (n >= 0 ? "+$" : "-$") + Math.abs(Math.round(n)).toLocaleString(); }
function pctFmt(n: number): string { return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%"; }

export function QualityBreakdown({ pricing }: { pricing: PricingResult }) {
  const factors = pricing.quality_factors;
  if (factors.length === 0) return null;
  const totalAdj = pricing.quality_adjustment;
  const totalDollar = factors.reduce((sum, f) => sum + f.dollar_impact, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2"><Activity size={14} className="text-blue-600" /><p className="text-xs font-semibold uppercase tracking-[2px] text-gray-400">Quality Factor Breakdown</p></div>
        <div className="text-right">
          <span className={`text-sm font-bold ${totalAdj < 0 ? "text-red-600" : totalAdj > 0 ? "text-emerald-600" : "text-gray-400"}`}>{pctFmt(totalAdj)}</span>
          <span className="text-[9px] text-gray-400 ml-2">net adjustment</span>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-4">
        <div className="mb-6">
          <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden bg-gray-50">
            {factors.map((f, i) => {
              if (f.adjustment === 0) return null;
              const width = Math.max(3, Math.abs(f.adjustment) / 0.12 * 100);
              const isDiscount = f.adjustment < 0;
              return (
                <motion.div key={f.name} className={`h-full flex items-center justify-center text-[8px] font-bold ${isDiscount ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}
                  style={{ minWidth: `${width}%`, flex: `${width} 0 0` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }} title={f.name}>
                  {Math.abs(f.adjustment) >= 0.02 && <span className="truncate px-1">{pctFmt(f.adjustment)}</span>}
                </motion.div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-300 mt-1"><span>Discounts</span><span>Premiums</span></div>
        </div>

        <div className="space-y-3">
          {factors.map((factor, i) => {
            const DirIcon = factor.direction === "premium" ? TrendingUp : factor.direction === "discount" ? TrendingDown : Minus;
            const color = factor.direction === "premium" ? "text-emerald-600" : factor.direction === "discount" ? "text-red-600" : "text-gray-400";
            const bgColor = factor.direction === "premium" ? "bg-emerald-50" : factor.direction === "discount" ? "bg-red-50" : "bg-gray-50";
            return (
              <motion.div key={factor.name} className={`${bgColor} rounded-xl px-4 py-3 border border-gray-100`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 + 0.2 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2"><DirIcon size={13} className={color} /><span className="text-xs font-semibold text-gray-700">{factor.name}</span></div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${color}`}>{pctFmt(factor.adjustment)}</span>
                    <span className={`text-xs ${color}`}>{fmt(factor.dollar_impact)}/mo</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{factor.detail}</p>
                <div className="mt-2"><span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{factor.signal}</span></div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Net Quality Adjustment</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${totalAdj < 0 ? "text-red-600" : totalAdj > 0 ? "text-emerald-600" : "text-gray-400"}`}>{pctFmt(totalAdj)}</span>
            <span className={`text-sm ${totalAdj < 0 ? "text-red-600" : totalAdj > 0 ? "text-emerald-600" : "text-gray-400"}`}>{fmt(totalDollar)}/mo</span>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-3 border-t border-gray-100 bg-gray-50"><p className="text-[8px] text-gray-400 text-center">Each factor adjusts the base fair price. Discounts reflect risk; premiums reflect quality above area averages.</p></div>
    </div>
  );
}
