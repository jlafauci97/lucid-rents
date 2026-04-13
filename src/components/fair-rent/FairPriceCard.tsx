"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PricingResult, ListingData } from "./types";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

function fmt(n: number): string { return "$" + Math.round(n).toLocaleString(); }
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function FairPriceCard({ listing, pricing }: { listing: ListingData; pricing: PricingResult }) {
  const [expanded, setExpanded] = useState(false);
  const p25 = percentile(pricing.comp_prices, 25);
  const p50 = percentile(pricing.comp_prices, 50);
  const p75 = percentile(pricing.comp_prices, 75);
  const rangeMin = Math.min(pricing.fair_range_low, listing.asking_price) * 0.9;
  const rangeMax = Math.max(pricing.fair_range_high, listing.asking_price) * 1.1;
  const span = rangeMax - rangeMin;
  const fairLowPct = ((pricing.fair_range_low - rangeMin) / span) * 100;
  const fairHighPct = ((pricing.fair_range_high - rangeMin) / span) * 100;
  const askingPct = ((listing.asking_price - rangeMin) / span) * 100;
  const fairMidPct = ((pricing.fair_price - rangeMin) / span) * 100;
  const isOverpriced = listing.asking_price > pricing.fair_range_high;

  const steps = [
    { label: "Base price", detail: pricing.comp_count > 0 ? `${pricing.comp_count} comps. Median = ${fmt(pricing.base_price)}` : `ZORI base = ${fmt(pricing.base_price)}` },
    { label: "ZORI check", detail: pricing.zori_blend_triggered ? `Blended to ${fmt(pricing.blended_base)}` : `${pricing.zori_current ? fmt(pricing.zori_current) + " — validated" : "Skipped"}` },
    { label: "Amenities", detail: `${pricing.amenity_adjustments.map((a) => `${a.name} ${a.value > 0 ? "+" : ""}${(a.value * 100).toFixed(0)}%`).join(", ") || "None"} = ${pricing.amenity_multiplier.toFixed(2)}x` },
    { label: "Season", detail: `${pricing.seasonal_factor.toFixed(2)}x — ${pricing.seasonal_label}` },
    { label: "Quality", detail: `${(pricing.quality_adjustment * 100).toFixed(1)}% from ${pricing.quality_factors.length} building/area signals` },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gray-400">Fair Market Price</p>
        {pricing.fallback_triggered && (
          <div className="flex items-center gap-1.5 text-amber-600 text-[10px]"><AlertTriangle size={11} /> {pricing.comp_count} comps</div>
        )}
      </div>
      <div className="px-6 sm:px-8 py-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Fair Range</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{fmt(pricing.fair_range_low)} — {fmt(pricing.fair_range_high)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Asking</p>
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${isOverpriced ? "text-red-600" : "text-emerald-600"}`}>{fmt(listing.asking_price)}</p>
          </div>
        </div>

        <div className="relative mb-10">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
            <motion.div className="absolute top-0 h-full rounded-full" style={{ left: `${fairLowPct}%`, background: "linear-gradient(90deg, #bbf7d0, #86efac, #bbf7d0)" }}
              initial={{ width: 0 }} animate={{ width: `${fairHighPct - fairLowPct}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} />
          </div>
          <motion.div className="absolute top-0" style={{ left: `${fairMidPct}%` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <div className="w-0.5 h-3 bg-emerald-600 mx-auto" /><p className="text-[8px] text-emerald-600 font-semibold mt-1 -translate-x-1/2 whitespace-nowrap">{fmt(pricing.fair_price)}</p>
          </motion.div>
          <motion.div className="absolute -top-1" style={{ left: `${askingPct}%` }} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.8 }}>
            <div className={`w-5 h-5 rounded-full border-[3px] border-white shadow-lg -translate-x-1/2 ${isOverpriced ? "bg-red-500" : "bg-emerald-500"}`} />
            <p className={`text-[8px] font-bold mt-1.5 -translate-x-1/2 whitespace-nowrap ${isOverpriced ? "text-red-600" : "text-emerald-600"}`}>{fmt(listing.asking_price)}</p>
          </motion.div>
        </div>

        {pricing.comp_prices.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[{ label: "25th", value: fmt(p25) }, { label: "Median", value: fmt(p50) }, { label: "75th", value: fmt(p75) }, { label: "This unit", value: fmt(listing.asking_price), highlight: true }].map((s) => (
              <div key={s.label} className={`text-center py-2.5 rounded-xl ${s.highlight ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
                <div className={`text-sm font-bold ${s.highlight ? "text-white" : "text-gray-700"}`}>{s.value}</div>
                <div className={`text-[8px] uppercase tracking-wide mt-0.5 ${s.highlight ? "text-white/50" : "text-gray-400"}`}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-blue-600 transition-colors cursor-pointer w-full justify-center">
          <span className="h-px flex-1 bg-gray-100" />Methodology {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}<span className="h-px flex-1 bg-gray-100" />
        </button>
        {expanded && (
          <motion.div className="mt-4 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center text-[9px] font-bold text-blue-600 flex-shrink-0">{i + 1}</div>
                <div><p className="text-[10px] font-semibold text-gray-600">{step.label}</p><p className="text-[10px] text-gray-400">{step.detail}</p></div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
