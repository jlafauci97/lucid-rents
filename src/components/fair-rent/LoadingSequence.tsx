"use client";

import { useState, useEffect } from "react";
import { LOADING_STEPS } from "@/lib/fair-rent/constants";
import { Check, Loader2 } from "lucide-react";

export function LoadingSequence() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= LOADING_STEPS.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 600 + Math.random() * 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1D2E] flex flex-col items-center justify-center gap-8 px-6">
      <p className="text-white text-lg font-semibold tracking-tight">
        Analyzing listing...
      </p>

      <div className="flex flex-col gap-3.5 w-full max-w-sm">
        {LOADING_STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                isDone
                  ? "text-emerald-400"
                  : isActive
                    ? "text-white"
                    : "text-white/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isDone
                    ? "border-emerald-400 bg-emerald-400 text-white"
                    : isActive
                      ? "border-white"
                      : "border-white/15"
                }`}
              >
                {isDone && <Check size={10} strokeWidth={3} />}
                {isActive && <Loader2 size={10} className="animate-spin" />}
              </div>
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
