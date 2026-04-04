"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Info, ArrowRight, ArrowLeft, Users } from "lucide-react";

interface IncomeStepProps {
  grossIncome: number;
  incomeFrequency: "annual" | "monthly";
  hasRoommate: boolean;
  roommateContribution: number;
  onChange: (data: {
    grossIncome: number;
    incomeFrequency: "annual" | "monthly";
    hasRoommate: boolean;
    roommateContribution: number;
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IncomeStep({
  grossIncome,
  incomeFrequency,
  hasRoommate,
  roommateContribution,
  onChange,
  onNext,
  onBack,
}: IncomeStepProps) {
  const [error, setError] = useState("");

  function handleIncomeChange(value: string) {
    const num = Number(value.replace(/[^0-9.]/g, ""));
    onChange({ grossIncome: num, incomeFrequency, hasRoommate, roommateContribution });
    if (num > 0) setError("");
  }

  function handleFrequencyToggle(freq: "annual" | "monthly") {
    onChange({ grossIncome, incomeFrequency: freq, hasRoommate, roommateContribution });
  }

  function handleRoommateToggle(val: boolean) {
    onChange({
      grossIncome,
      incomeFrequency,
      hasRoommate: val,
      roommateContribution: val ? roommateContribution : 0,
    });
  }

  function handleRoommateChange(value: string) {
    const num = Number(value.replace(/[^0-9.]/g, ""));
    onChange({ grossIncome, incomeFrequency, hasRoommate, roommateContribution: num });
  }

  function handleNext() {
    if (grossIncome <= 0) {
      setError("Please enter your income to continue.");
      return;
    }
    onNext();
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1F36] mb-1">
          What&rsquo;s your income?
        </h2>
        <p className="text-sm text-[#5E6687]">
          Enter your gross (pre-tax) income. We use this to calculate how much
          rent you can comfortably afford.
        </p>
      </div>

      {/* Income field */}
      <div className="space-y-4">
        <div>
          <Input
            label="Gross Income *"
            type="text"
            inputMode="numeric"
            placeholder={incomeFrequency === "annual" ? "e.g. 75,000" : "e.g. 6,250"}
            value={grossIncome > 0 ? grossIncome.toLocaleString() : ""}
            onChange={(e) => handleIncomeChange(e.target.value)}
            error={error}
            className="text-lg"
          />
          {/* Frequency toggle */}
          <div className="flex gap-2 mt-2">
            {(["annual", "monthly"] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => handleFrequencyToggle(freq)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  incomeFrequency === freq
                    ? "bg-[#6366F1] text-white border-[#6366F1]"
                    : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
                }`}
              >
                {freq === "annual" ? "Per Year" : "Per Month"}
              </button>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <Info className="w-4 h-4 text-[#6366F1] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#6366F1]/80">
            <span className="font-medium">Gross income</span> is your total
            earnings before taxes and deductions. Include salary, freelance
            income, and any regular income sources.
          </p>
        </div>

        {/* Roommate toggle */}
        <div className="pt-2 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5E6687]" />
              <span className="text-sm font-medium text-[#1A1F36]">
                Splitting rent with someone?
              </span>
            </div>
            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => handleRoommateToggle(val)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    hasRoommate === val
                      ? "bg-[#6366F1] text-white border-[#6366F1]"
                      : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
                  }`}
                >
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>

          {hasRoommate && (
            <Input
              label="Their monthly contribution toward rent"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1,000"
              value={roommateContribution > 0 ? roommateContribution.toLocaleString() : ""}
              onChange={(e) => handleRoommateChange(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
