"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LOADING_STEPS } from "@/lib/fair-rent/constants";
import { Check, Loader2, Cpu } from "lucide-react";

export function LoadingSequence() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => { if (prev >= LOADING_STEPS.length) { clearInterval(interval); return prev; } return prev + 1; });
    }, 600 + Math.random() * 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-8 px-6">
      <div className="flex items-center gap-2">
        <Cpu size={20} className="text-blue-600" />
        <span className="text-xs font-semibold tracking-[3px] uppercase text-blue-600/70">Processing</span>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {LOADING_STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          return (
            <motion.div key={i} className={`flex items-center gap-3 text-sm transition-colors duration-300 ${isDone ? "text-blue-600" : isActive ? "text-gray-900" : "text-gray-300"}`}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                isDone ? "border-blue-500 bg-blue-500 text-white" : isActive ? "border-blue-400 shadow-sm" : "border-gray-200"
              }`}>
                {isDone && <Check size={10} strokeWidth={3} />}
                {isActive && <Loader2 size={10} className="animate-spin" />}
              </div>
              <span className="text-xs">{step}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="w-80 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: "0%" }}
          animate={{ width: `${Math.min(100, (activeStep / LOADING_STEPS.length) * 100)}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}
