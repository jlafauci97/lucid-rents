"use client";

import { motion } from "framer-motion";
import type { AnalyzeResponse } from "./types";
import { ListingHeader } from "./ListingHeader";
import { PricingVerdict } from "./PricingVerdict";
import { FairPriceCard } from "./FairPriceCard";
import { SeasonalSignalCard } from "./SeasonalSignalCard";
import { BuildingScorecardGrid } from "./BuildingScorecardGrid";
import { NeighborhoodSafetyCard } from "./NeighborhoodSafetyCard";
import { TenantRightsCallout } from "./TenantRightsCallout";
import { ArrowLeft } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

interface ResultsShellProps {
  result: AnalyzeResponse;
  onBack: () => void;
}

export function ResultsShell({ result, onBack }: ResultsShellProps) {
  const redFlagCount = countRedFlags(result);

  return (
    <div className="min-h-screen bg-[#f5f4f1]">
      {/* Sticky nav */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 sm:px-12 py-4">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <span className="text-[#0F1D2E] font-bold text-base tracking-tight">
            Fair Rent Engine
          </span>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <ArrowLeft size={12} /> New analysis
          </button>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-5 py-10 sm:py-14">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <ListingHeader listing={result.listing} />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <TenantRightsCallout result={result} />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <PricingVerdict
            askingVsFairPct={result.pricing.asking_vs_fair_pct}
            fairPrice={result.pricing.fair_price}
            askingPrice={result.listing.asking_price}
            redFlagCount={redFlagCount}
          />
        </motion.div>

        <div className="flex flex-col gap-6 mt-6">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <FairPriceCard listing={result.listing} pricing={result.pricing} />
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
            <SeasonalSignalCard pricing={result.pricing} listing={result.listing} />
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5}>
            <BuildingScorecardGrid
              violations={result.violations}
              complaints={result.complaints}
              stabilization={result.stabilization}
              litigations={result.litigations}
            />
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}>
            <NeighborhoodSafetyCard crime={result.crime} />
          </motion.div>
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
