"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQAccordionItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`group border-b border-[#e2e8f0] last:border-0 ${
        open ? "bg-[#f8fafc]" : ""
      } transition-colors duration-200`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 py-4 px-4 text-left hover:bg-[#f8fafc] transition-colors rounded-lg"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#EFF6FF] text-[#3B82F6] text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <span className="text-sm font-semibold text-[#0F1D2E] flex-1 pr-2">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#94a3b8] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[#3B82F6]" : ""
          }`}
        />
      </button>
      {/* Answer always in DOM for Googlebot crawlability */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-[1000px] pb-4" : "max-h-0"
        }`}
      >
        <p className="text-sm text-[#64748b] leading-relaxed pl-[52px] pr-4">
          {answer}
        </p>
      </div>
    </div>
  );
}
