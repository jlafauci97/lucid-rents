"use client";

import type { AnalyzeResponse } from "./types";
import { ListingHeader } from "./ListingHeader";
import { PricingVerdict } from "./PricingVerdict";
import { FairPriceCard } from "./FairPriceCard";
import { SeasonalSignalCard } from "./SeasonalSignalCard";
import { BuildingScorecardGrid } from "./BuildingScorecardGrid";
import { NeighborhoodSafetyCard } from "./NeighborhoodSafetyCard";
import { TenantRightsCallout } from "./TenantRightsCallout";
import { ArrowLeft } from "lucide-react";

interface ResultsShellProps {
  result: AnalyzeResponse;
  onBack: () => void;
}

export function ResultsShell({ result, onBack }: ResultsShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="bg-white border-b border-[#e8e6e1] px-6 sm:px-12 py-5">
        <span className="text-[#0F1D2E] font-bold text-lg tracking-tight">
          Fair Rent Engine
        </span>
      </div>

      <div className="max-w-[760px] mx-auto px-5 py-10 sm:py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft size={14} /> Check another listing
        </button>

        <ListingHeader listing={result.listing} />
        <TenantRightsCallout result={result} />
        <PricingVerdict
          askingVsFairPct={result.pricing.asking_vs_fair_pct}
          redFlagCount={countRedFlags(result)}
        />

        <div className="flex flex-col gap-5">
          <FairPriceCard listing={result.listing} pricing={result.pricing} />
          <SeasonalSignalCard pricing={result.pricing} listing={result.listing} />
          <BuildingScorecardGrid
            violations={result.violations}
            complaints={result.complaints}
            stabilization={result.stabilization}
            litigations={result.litigations}
          />
          <NeighborhoodSafetyCard crime={result.crime} />
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
