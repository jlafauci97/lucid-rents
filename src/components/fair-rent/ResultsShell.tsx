"use client";

import { motion, type Variants } from "framer-motion";
import type { AnalyzeResponse } from "./types";
import { ListingHeader } from "./ListingHeader";
import { PricingVerdict } from "./PricingVerdict";
import { FairPriceCard } from "./FairPriceCard";
import { SeasonalSignalCard } from "./SeasonalSignalCard";
import { BuildingScorecardGrid } from "./BuildingScorecardGrid";
import { NeighborhoodSafetyCard } from "./NeighborhoodSafetyCard";
import { TenantRightsCallout } from "./TenantRightsCallout";
import { ComparablesCard } from "./ComparablesCard";
import { QualityBreakdown } from "./QualityBreakdown";
import { ArrowLeft, Cpu } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } }),
} satisfies Variants;

export function ResultsShell({ result, onBack }: { result: AnalyzeResponse; onBack: () => void }) {
  const redFlagCount = countRedFlags(result);
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 sm:px-12 py-3.5">
        <div className="max-w-[820px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-600" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-blue-600/70">Fair Rent Engine</span>
          </div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
            <ArrowLeft size={12} /> New analysis
          </button>
        </div>
      </div>
      <div className="max-w-[820px] mx-auto px-5 py-10 sm:py-14">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}><ListingHeader listing={result.listing} /></motion.div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}><TenantRightsCallout result={result} /></motion.div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <PricingVerdict askingVsFairPct={result.pricing.asking_vs_fair_pct} fairPrice={result.pricing.fair_price} askingPrice={result.listing.asking_price} redFlagCount={redFlagCount} />
        </motion.div>
        <div className="flex flex-col gap-5 mt-5">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}><FairPriceCard listing={result.listing} pricing={result.pricing} /></motion.div>
          {result.pricing.quality_factors.length > 0 && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3.5}><QualityBreakdown pricing={result.pricing} /></motion.div>
          )}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}><SeasonalSignalCard pricing={result.pricing} listing={result.listing} /></motion.div>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5}>
            <BuildingScorecardGrid violations={result.violations} complaints={result.complaints} stabilization={result.stabilization} litigations={result.litigations} />
          </motion.div>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}><NeighborhoodSafetyCard crime={result.crime} /></motion.div>
          {result.comparables.length > 0 && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={7}><ComparablesCard comparables={result.comparables} currentZip={result.listing.zip_code} /></motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function countRedFlags(result: AnalyzeResponse): number {
  let count = 0;
  if (result.violations?.classification === "above_average") count++;
  if (result.litigations?.has_harassment_case) count++;
  if (result.litigations?.active_litigations && result.litigations.active_litigations > 0) count++;
  if (result.stabilization?.yoy_unit_change_pct != null && result.stabilization.yoy_unit_change_pct < -10) count++;
  if (result.crime?.safety_grade === "F") count++;
  return count;
}
