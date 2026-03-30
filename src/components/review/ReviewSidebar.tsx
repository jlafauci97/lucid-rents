"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, ChevronDown } from "lucide-react";

interface SidebarStep {
  name: string;
  completed: boolean;
}

interface ReviewSidebarProps {
  steps: SidebarStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
  buildingName?: string;
  lastSaved?: Date | null;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return "Just saved";
  if (diffSec < 60) return `Saved ${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Saved ${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  return `Saved ${diffHr}h ago`;
}

export default function ReviewSidebar({
  steps,
  currentStep,
  onStepClick,
  buildingName,
  lastSaved,
}: ReviewSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  const updateSavedLabel = useCallback(() => {
    if (lastSaved) {
      setSavedLabel(formatRelativeTime(lastSaved));
    } else {
      setSavedLabel(null);
    }
  }, [lastSaved]);

  useEffect(() => {
    updateSavedLabel();
    const interval = setInterval(updateSavedLabel, 10_000);
    return () => clearInterval(interval);
  }, [updateSavedLabel]);

  function isClickable(index: number) {
    return steps[index].completed || index === currentStep;
  }

  function handleStepClick(index: number) {
    if (!isClickable(index)) return;
    onStepClick(index);
  }

  function handleMobileStepClick(index: number) {
    if (!isClickable(index)) return;
    onStepClick(index);
    setMobileOpen(false);
  }

  // ── Desktop sidebar ──────────────────────────────────────────────
  const desktop = (
    <aside className="hidden md:flex flex-col w-[240px] shrink-0 bg-[#0F1D2E] rounded-xl p-4 text-white self-start">
      {/* Building name header */}
      {buildingName && (
        <div className="pb-3 mb-3 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-[#94a3b8]">
            Reviewing
          </p>
          <p className="text-sm font-semibold truncate mt-0.5">
            {buildingName}
          </p>
        </div>
      )}

      {/* Step list */}
      <nav className="flex flex-col gap-1 flex-1">
        {steps.map((step, i) => {
          const completed = step.completed;
          const active = i === currentStep;
          const future = !completed && !active;
          const clickable = isClickable(i);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleStepClick(i)}
              disabled={!clickable}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : future
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-white/5 text-white"
              }`}
            >
              {/* Number / check circle */}
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

      {/* Auto-saved indicator */}
      {savedLabel && (
        <div className="mt-4 pt-3 border-t border-white/10 text-xs text-[#94a3b8] flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          {savedLabel}
        </div>
      )}
    </aside>
  );

  // ── Mobile compact bar ───────────────────────────────────────────
  const mobile = (
    <div className="md:hidden relative">
      <div className="flex items-center gap-2">
        {/* Current step button */}
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
          {steps.map((step, i) => {
            const active = i === currentStep;
            return (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  step.completed
                    ? "bg-[#10b981]"
                    : active
                    ? "bg-[#3B82F6]"
                    : "bg-[#94a3b8]/30"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Dropdown */}
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
                onClick={() => handleMobileStepClick(i)}
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
