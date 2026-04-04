"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

interface PreferencesStepProps {
  city: City | "";
  bedrooms: number;
  onChange: (data: { city: City | ""; bedrooms: number }) => void;
  onNext: () => void;
  onBack: () => void;
}

const cityOptions = VALID_CITIES.map((c) => ({
  value: c,
  label: CITY_META[c].fullName,
}));

const bedroomOptions = [
  { label: "Studio", value: 0 },
  { label: "1 BR", value: 1 },
  { label: "2 BR", value: 2 },
  { label: "3 BR", value: 3 },
  { label: "4+ BR", value: 4 },
];

export function PreferencesStep({
  city,
  bedrooms,
  onChange,
  onNext,
  onBack,
}: PreferencesStepProps) {
  const [error, setError] = useState("");

  function handleNext() {
    if (!city) {
      setError("Please select a city to continue.");
      return;
    }
    onNext();
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#0F1D2E] mb-1">
          Where do you want to live?
        </h2>
        <p className="text-sm text-[#64748b]">
          Pick a city and your ideal apartment size. We&rsquo;ll match you with
          neighborhoods that fit your budget.
        </p>
      </div>

      <div className="space-y-6">
        {/* City selector */}
        <Select
          label="City *"
          placeholder="Select a city..."
          options={cityOptions}
          value={city}
          onChange={(e) => {
            onChange({ city: e.target.value as City | "", bedrooms });
            if (e.target.value) setError("");
          }}
          error={error}
        />

        {/* Bedrooms */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#0F1D2E]">
            Bedrooms *
          </label>
          <div className="flex flex-wrap gap-2">
            {bedroomOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ city, bedrooms: opt.value })}
                className={`rounded-full px-5 py-2 text-sm font-medium border transition-colors ${
                  bedrooms === opt.value
                    ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                    : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* City preview card */}
        {city && (
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-4 py-3">
            <p className="text-xs text-[#94a3b8] uppercase tracking-wider font-semibold mb-1">
              Searching in
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              {CITY_META[city].fullName}, {CITY_META[city].stateCode}
            </p>
            <p className="text-xs text-[#64748b] mt-0.5">
              {CITY_META[city].regions.length}{" "}
              {CITY_META[city].regionLabel.toLowerCase()}s available ·{" "}
              {bedroomOptions.find((o) => o.value === bedrooms)?.label}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={handleNext}>
          See My Results
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
