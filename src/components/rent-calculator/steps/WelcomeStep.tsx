"use client";

import { Button } from "@/components/ui/Button";
import { DollarSign, MapPin, BarChart3, ArrowRight } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

const features = [
  {
    icon: DollarSign,
    title: "Expert Budget Rules",
    description:
      "We apply the 30% rule, 50/30/20 rule, and debt-to-income analysis to find your true comfort zone.",
  },
  {
    icon: BarChart3,
    title: "Real Rent Data",
    description:
      "Powered by live market data from multiple sources across 5 major U.S. cities.",
  },
  {
    icon: MapPin,
    title: "Neighborhood Matches",
    description:
      "Discover exactly which neighborhoods fit your budget — ranked from best to tightest fit.",
  },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Hero */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6366F1]/10 mb-4">
          <DollarSign className="w-8 h-8 text-[#6366F1]" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1F36] mb-3">
          Can I Afford to Live Here?
        </h2>
        <p className="text-[#5E6687] text-base sm:text-lg max-w-lg mx-auto">
          Answer a few questions about your finances, pick a city, and
          we&rsquo;ll show you exactly which neighborhoods fit your budget.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider font-semibold text-[#A3ACBE] mb-4">
          How It Works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl border border-[#E2E8F0] p-5 text-left hover:shadow-md hover:border-[#E2E8F0] transition-all"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#6366F1]/10 mb-3">
                <f.icon className="w-5 h-5 text-[#6366F1]" />
              </div>
              <h3 className="text-sm font-semibold text-[#1A1F36] mb-1">
                {f.title}
              </h3>
              <p className="text-xs text-[#5E6687] leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps preview */}
      <div className="mb-8 flex items-center justify-center gap-2 text-xs text-[#A3ACBE]">
        {["Your Income", "Expenses", "City & Preferences", "Results"].map(
          (label, i) => (
            <span key={label} className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0F1D2E]/5 text-[10px] font-semibold text-[#5E6687]">
                {i + 1}
              </span>
              <span>{label}</span>
              {i < 3 && <ArrowRight className="w-3 h-3 text-[#A3ACBE]" />}
            </span>
          )
        )}
      </div>

      {/* CTA */}
      <Button size="lg" onClick={onNext} className="px-8">
        Let&rsquo;s Find Out
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      <p className="mt-4 text-xs text-[#A3ACBE]">
        Takes about 2 minutes · No sign-up required
      </p>
    </div>
  );
}
