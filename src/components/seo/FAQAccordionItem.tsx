"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQAccordionItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[#e2e8f0] last:border-0">
      <button
        type="button"
        className="flex w-full items-center justify-between py-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[#0F1D2E] pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#94a3b8] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {/* Answer always in DOM for Googlebot crawlability */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-[1000px] pb-4" : "max-h-0"
        }`}
      >
        <p className="text-sm text-[#64748b] leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}
