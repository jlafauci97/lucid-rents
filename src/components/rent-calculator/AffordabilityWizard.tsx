"use client";

import { useState, useEffect, useCallback } from "react";
import { type City } from "@/lib/cities";
import type { AffordabilityInput } from "@/lib/affordability";
import { WizardProgress, type WizardStep } from "./WizardProgress";
import { WelcomeStep } from "./steps/WelcomeStep";
import { IncomeStep } from "./steps/IncomeStep";
import { ExpensesStep, type ExpensesData } from "./steps/ExpensesStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { ResultsStep } from "./steps/ResultsStep";

const STEP_NAMES = [
  "Welcome",
  "Income",
  "Expenses",
  "Preferences",
  "Results",
];

const DRAFT_KEY = "rent-calculator-draft";

interface WizardDraft {
  grossIncome: number;
  incomeFrequency: "annual" | "monthly";
  hasRoommate: boolean;
  roommateContribution: number;
  expenses: ExpensesData;
  city: City | "";
  bedrooms: number;
}

const defaultExpenses: ExpensesData = {
  studentLoans: 0,
  carPayment: 0,
  creditCards: 0,
  otherDebt: 0,
  utilities: 150,
  rentersInsurance: 20,
};

const defaultDraft: WizardDraft = {
  grossIncome: 0,
  incomeFrequency: "annual",
  hasRoommate: false,
  roommateContribution: 0,
  expenses: { ...defaultExpenses },
  city: "",
  bedrooms: 1,
};

function loadDraft(): WizardDraft {
  if (typeof window === "undefined") return defaultDraft;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultDraft;
    return { ...defaultDraft, ...JSON.parse(raw) };
  } catch {
    return defaultDraft;
  }
}

function saveDraft(draft: WizardDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable
  }
}

export function AffordabilityWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(defaultDraft);
  const [mounted, setMounted] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    setDraft(loadDraft());
    setMounted(true);
  }, []);

  // Auto-save draft on change
  useEffect(() => {
    if (mounted) saveDraft(draft);
  }, [draft, mounted]);

  // Step completion tracking
  const steps: WizardStep[] = STEP_NAMES.map((name, i) => ({
    name,
    completed: i < step,
  }));

  const goTo = useCallback((s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Build AffordabilityInput for the results step
  const grossMonthly =
    draft.incomeFrequency === "annual"
      ? draft.grossIncome / 12
      : draft.grossIncome;

  const totalDebt =
    draft.expenses.studentLoans +
    draft.expenses.carPayment +
    draft.expenses.creditCards +
    draft.expenses.otherDebt;

  const affordabilityInput: AffordabilityInput = {
    grossMonthlyIncome: grossMonthly,
    additionalIncome: draft.roommateContribution,
    monthlyDebtPayments: totalDebt,
    estimatedUtilities: draft.expenses.utilities,
    rentersInsurance: draft.expenses.rentersInsurance,
  };

  function handleRestart() {
    setDraft({ ...defaultDraft });
    localStorage.removeItem(DRAFT_KEY);
    goTo(0);
  }

  // Don't render with stale SSR defaults — wait for localStorage load
  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar / progress (hide on welcome & results) */}
      {step > 0 && step < 4 && (
        <WizardProgress
          steps={steps}
          currentStep={step}
          onStepClick={goTo}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Step transition wrapper */}
        <div className="transition-opacity duration-200">
          {step === 0 && <WelcomeStep onNext={() => goTo(1)} />}

          {step === 1 && (
            <IncomeStep
              grossIncome={draft.grossIncome}
              incomeFrequency={draft.incomeFrequency}
              hasRoommate={draft.hasRoommate}
              roommateContribution={draft.roommateContribution}
              onChange={(data) => setDraft((d) => ({ ...d, ...data }))}
              onNext={() => goTo(2)}
              onBack={() => goTo(0)}
            />
          )}

          {step === 2 && (
            <ExpensesStep
              expenses={draft.expenses}
              onChange={(expenses) => setDraft((d) => ({ ...d, expenses }))}
              onNext={() => goTo(3)}
              onBack={() => goTo(1)}
            />
          )}

          {step === 3 && (
            <PreferencesStep
              city={draft.city}
              bedrooms={draft.bedrooms}
              onChange={(data) => setDraft((d) => ({ ...d, ...data }))}
              onNext={() => goTo(4)}
              onBack={() => goTo(2)}
            />
          )}

          {step === 4 && draft.city && (
            <ResultsStep
              input={affordabilityInput}
              city={draft.city as City}
              bedrooms={draft.bedrooms}
              onBack={() => goTo(3)}
              onRestart={handleRestart}
            />
          )}
        </div>
      </div>
    </div>
  );
}
