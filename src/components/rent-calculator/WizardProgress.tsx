"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface WizardStep {
  name: string;
  completed: boolean;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export function WizardProgress({
  steps,
  currentStep,
  onStepClick,
}: WizardProgressProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function isClickable(index: number) {
    return steps[index].completed || index === currentStep;
  }

  /* ── Desktop sidebar ────────────────────────────────────── */
  const desktop = (
    <aside className="hidden md:flex flex-col w-[220px] shrink-0 bg-[#0F1D2E] rounded-xl p-4 text-white self-start sticky top-24">
      <div className="pb-3 mb-3 border-b border-white/10">
        <p className="text-xs uppercase tracking-wider text-[#94a3b8]">
          Progress
        </p>
        <p className="text-sm font-semibold mt-0.5">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {steps.map((step, i) => {
          const completed = step.completed;
          const active = i === currentStep;
          const future = !completed && !active;
          const clickable = isClickable(i);

          return (
            <button
              key={i}
              type="button"
              onClick={() => clickable && onStepClick(i)}
              disabled={!clickable}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : future
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-white/5 text-white"
              }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                  completed
                    ? "bg-[#10b981] text-white"
                    : active
                    ? "bg-[#3B82F6] text-white"
                    : "bg-white/10 text-[#94a3b8]"
                }`}
              >
                {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="truncate">{step.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );

  /* ── Mobile compact bar ─────────────────────────────────── */
  const mobile = (
    <div className="md:hidden relative mb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="flex items-center gap-2 bg-[#0F1D2E] text-white text-sm font-medium px-3 py-2 rounded-lg"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#3B82F6] text-[10px] font-bold">
            {currentStep + 1}
          </span>
          <span className="truncate max-w-[160px]">
            {steps[currentStep]?.name}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              mobileOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((step, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                step.completed
                  ? "bg-[#10b981]"
                  : i === currentStep
                  ? "bg-[#3B82F6]"
                  : "bg-[#94a3b8]/30"
              }`}
            />
          ))}
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-[#0F1D2E] rounded-lg shadow-xl border border-white/10 py-1">
          {steps.map((step, i) => {
            const completed = step.completed;
            const active = i === currentStep;
            const future = !completed && !active;
            const clickable = isClickable(i);

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (clickable) {
                    onStepClick(i);
                    setMobileOpen(false);
                  }
                }}
                disabled={!clickable}
                className={`flex items-center gap-3 w-full px-3 py-2 text-left text-sm ${
                  active
                    ? "bg-white/10 text-white"
                    : future
                    ? "opacity-40 cursor-not-allowed text-white"
                    : "text-white hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold shrink-0 ${
                    completed
                      ? "bg-[#10b981] text-white"
                      : active
                      ? "bg-[#3B82F6] text-white"
                      : "bg-white/10 text-[#94a3b8]"
                  }`}
                >
                  {completed ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span className="truncate">{step.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {desktop}
      {mobile}
    </>
  );
}
