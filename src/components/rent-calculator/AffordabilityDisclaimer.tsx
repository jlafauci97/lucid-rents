import { AlertTriangle } from "lucide-react";

export function AffordabilityDisclaimer() {
  return (
    <div className="mt-8 border-t border-[#e2e8f0] pt-6">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-semibold">* Not Financial Advice</p>
          <p>
            This calculator provides estimates based on general financial
            guidelines (the 30% rule, the 50/30/20 budget rule, and debt-to-income
            ratios). Results are for informational purposes only and should not be
            considered financial, legal, or housing advice. Your actual
            affordability may vary based on factors not captured here, including
            credit score, savings, local taxes, and personal circumstances.
            Consult a qualified financial advisor for personalized guidance.
          </p>
        </div>
      </div>
    </div>
  );
}
