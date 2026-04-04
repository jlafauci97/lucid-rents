"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  RotateCcw,
  Percent,
  Scale,
  PiggyBank,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import {
  calculateAffordability,
  formatCurrency,
  CITY_TIPS,
  type AffordabilityInput,
} from "@/lib/affordability";
import { AffordabilityGauge } from "../AffordabilityGauge";
import { BudgetBreakdownChart } from "../BudgetBreakdownChart";
import { NeighborhoodMatchList } from "../NeighborhoodMatchList";
import type { NeighborhoodMatch } from "../NeighborhoodMatchCard";

interface ResultsStepProps {
  input: AffordabilityInput;
  city: City;
  bedrooms: number;
  onBack: () => void;
  onRestart: () => void;
}

export function ResultsStep({
  input,
  city,
  bedrooms,
  onBack,
  onRestart,
}: ResultsStepProps) {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "What If" slider — offset to gross monthly income
  const [incomeAdjust, setIncomeAdjust] = useState(0);

  const adjustedInput = useMemo(
    () => ({
      ...input,
      grossMonthlyIncome: input.grossMonthlyIncome + incomeAdjust,
    }),
    [input, incomeAdjust]
  );

  const result = useMemo(
    () => calculateAffordability(adjustedInput),
    [adjustedInput]
  );

  // Fetch neighborhood data once
  const fetchNeighborhoods = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/rent-affordability-calculator?city=${city}&bedrooms=${bedrooms}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data: NeighborhoodMatch[] = await res.json();
      setNeighborhoods(data);
    } catch {
      setError("Unable to load neighborhood data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [city, bedrooms]);

  useEffect(() => {
    fetchNeighborhoods();
  }, [fetchNeighborhoods]);

  const meta = CITY_META[city];
  const cityTips = CITY_TIPS[city] || [];

  const affordableCount = neighborhoods.filter(
    (n) => n.medianRent <= result.recommendedMax
  ).length;
  const affordablePercent =
    neighborhoods.length > 0
      ? Math.round((affordableCount / neighborhoods.length) * 100)
      : 0;

  const avgRent =
    neighborhoods.length > 0
      ? Math.round(
          neighborhoods.reduce((s, n) => s + n.medianRent, 0) /
            neighborhoods.length
        )
      : 0;

  // "What If" slider range: ±40% of current income, step $100/mo
  const baseIncome = input.grossMonthlyIncome;
  const sliderMin = Math.round(-baseIncome * 0.4);
  const sliderMax = Math.round(baseIncome * 0.4);

  const rules = [
    {
      icon: Percent,
      label: "30% Rule",
      value: result.thirtyPercentRule,
      description: "Rent ≤ 30% of gross income",
    },
    {
      icon: PiggyBank,
      label: "50/30/20 Rule",
      value: result.fiftyThirtyTwentyRule,
      description: "Needs budget minus other essentials",
    },
    {
      icon: Scale,
      label: "Debt-Adjusted",
      value: result.debtAdjustedMax,
      description: "Housing + debt under 43% DTI",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Section A: Affordability Summary ────────────────── */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[#1A1F36] mb-1">
          Your Rent Affordability
        </h2>
        <p className="text-sm text-[#5E6687]">
          Based on expert financial guidelines, here&rsquo;s what you can
          comfortably spend on rent.
        </p>
      </div>

      {/* Gauge */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-4">
        <AffordabilityGauge
          recommendedMax={result.recommendedMax}
          rentToIncomePercent={result.rentToIncomePercent}
        />

        {/* Three rule cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          {rules.map((rule) => {
            const isMin = rule.value === result.recommendedMax;
            return (
              <div
                key={rule.label}
                className={`rounded-lg border px-4 py-3 text-center ${
                  isMin
                    ? "border-[#6366F1] bg-[#6366F1]/5"
                    : "border-[#E2E8F0]"
                }`}
              >
                <rule.icon
                  className={`w-4 h-4 mx-auto mb-1 ${
                    isMin ? "text-[#6366F1]" : "text-[#A3ACBE]"
                  }`}
                />
                <p className="text-xs font-medium text-[#5E6687]">
                  {rule.label}
                </p>
                <p
                  className={`text-lg font-bold ${
                    isMin ? "text-[#6366F1]" : "text-[#1A1F36]"
                  }`}
                >
                  {formatCurrency(rule.value)}
                </p>
                <p className="text-[10px] text-[#A3ACBE] mt-0.5">
                  {rule.description}
                </p>
                {isMin && (
                  <span className="inline-block text-[10px] font-semibold text-[#6366F1] bg-[#6366F1]/10 rounded-full px-2 py-0.5 mt-1">
                    Recommended
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section B: Budget Breakdown ─────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-4">
        <BudgetBreakdownChart breakdown={result.budgetBreakdown} />
      </div>

      {/* ── "What If" Slider ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-4">
        <h3 className="text-sm font-semibold text-[#1A1F36] mb-1">
          &ldquo;What If&rdquo; — Adjust Your Income
        </h3>
        <p className="text-xs text-[#5E6687] mb-4">
          Slide to see how a raise or pay cut would change your options.
        </p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#A3ACBE] w-16 text-right">
            {formatCurrency((baseIncome + sliderMin) * 12)}/yr
          </span>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={100}
            value={incomeAdjust}
            onChange={(e) => setIncomeAdjust(Number(e.target.value))}
            className="flex-1 accent-[#3B82F6] h-2 cursor-pointer"
          />
          <span className="text-xs text-[#A3ACBE] w-16">
            {formatCurrency((baseIncome + sliderMax) * 12)}/yr
          </span>
        </div>
        {incomeAdjust !== 0 && (
          <p className="text-center text-xs text-[#6366F1] font-medium mt-2">
            Adjusted income: {formatCurrency((baseIncome + incomeAdjust) * 12)}
            /yr → Max rent: {formatCurrency(result.recommendedMax)}/mo
          </p>
        )}
      </div>

      {/* ── Section C: City Snapshot ────────────────────────── */}
      {!loading && neighborhoods.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-[#A3ACBE]">Avg Rent in {meta.name}</p>
            <p className="text-lg font-bold text-[#1A1F36]">
              {formatCurrency(avgRent)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-[#A3ACBE]">Neighborhoods That Fit</p>
            <p className="text-lg font-bold text-[#10b981]">
              {affordableCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-4 py-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-[#A3ACBE]">Budget Coverage</p>
            <p className="text-lg font-bold text-[#1A1F36]">
              {affordablePercent}%
            </p>
          </div>
        </div>
      )}

      {/* ── City Tips ───────────────────────────────────────── */}
      {cityTips.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-[#6366F1]" />
            <span className="text-xs font-semibold text-[#6366F1]">
              {meta.name} Tips
            </span>
          </div>
          <ul className="space-y-1">
            {cityTips.map((tip, i) => (
              <li key={i} className="text-xs text-[#6366F1]/80 flex gap-2">
                <span className="text-[#6366F1]/40">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Section D: Neighborhood Matches ─────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#A3ACBE]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading neighborhoods...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#ef4444] mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchNeighborhoods}>
              Try Again
            </Button>
          </div>
        ) : (
          <NeighborhoodMatchList
            matches={neighborhoods}
            recommendedMax={result.recommendedMax}
            city={city}
          />
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Adjust Inputs
        </Button>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
