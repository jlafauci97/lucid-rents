"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LOADING_STEPS } from "@/lib/fair-rent/constants";
import { Check, Loader2, Cpu } from "lucide-react";

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
    <div className="min-h-screen bg-[#0a0e17] relative overflow-hidden flex flex-col items-center justify-center gap-8 px-6">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/30 to-transparent"
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Cpu size={20} className="text-[#00D4FF]" />
          <span className="text-[10px] font-mono font-bold tracking-[4px] uppercase text-[#00D4FF]/70">
            Processing
          </span>
        </motion.div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {LOADING_STEPS.map((step, i) => {
            const isDone = i < activeStep;
            const isActive = i === activeStep;

            return (
              <motion.div
                key={i}
                className={`flex items-center gap-3 text-sm font-mono transition-colors duration-300 ${
                  isDone ? "text-[#00D4FF]" : isActive ? "text-white" : "text-white/15"
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isDone
                    ? "border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF]"
                    : isActive
                      ? "border-[#00D4FF]/60 shadow-[0_0_10px_rgba(0,212,255,0.3)]"
                      : "border-white/10"
                }`}>
                  {isDone && <Check size={10} strokeWidth={3} />}
                  {isActive && <Loader2 size={10} className="animate-spin" />}
                </div>
                <span className="text-xs">{step}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-80 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00D4FF]/50 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.min(100, (activeStep / LOADING_STEPS.length) * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
}
