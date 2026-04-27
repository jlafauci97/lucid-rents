"use client";

import { useState } from "react";
import { HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { FAQAccordionItem } from "@/components/seo/FAQAccordionItem";

interface FAQItem {
  question: string;
  answer: string;
}

const ITEMS_PER_PAGE = 10;

export function PaginatedFAQSection({
  items,
  title = "Frequently Asked Questions",
}: {
  items: FAQItem[];
  title?: string;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const start = page * ITEMS_PER_PAGE;
  const visible = items.slice(start, start + ITEMS_PER_PAGE);

  if (items.length === 0) return null;

  return (
    <section className="mt-8" id="faq">
      {/* ALL answers in DOM for Googlebot (hidden visually when not on current page) */}
      {items.map((item, i) => (
        <div
          key={i}
          className={i >= start && i < start + ITEMS_PER_PAGE ? "" : "hidden"}
          aria-hidden={i < start || i >= start + ITEMS_PER_PAGE}
        />
      ))}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#e2e8f0]">
          <div className="p-1.5 rounded-lg bg-[#EFF6FF]">
            <HelpCircle className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-[#0F1D2E]">{title}</h2>
            <p className="text-xs mt-0.5 text-[#94a3b8]">
              {items.length} questions answered
            </p>
          </div>
          {/* Page indicator */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous FAQ page"
              >
                <ChevronLeft className="w-4 h-4 text-[#64748b]" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                    i === page
                      ? "bg-[#0F1D2E] text-white"
                      : "text-[#64748b] hover:bg-[#f1f5f9]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next FAQ page"
              >
                <ChevronRight className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>
          )}
        </div>

        {/* Questions — visible page */}
        <div className="px-2 py-1">
          {visible.map((item, i) => (
            <FAQAccordionItem
              key={start + i}
              question={item.question}
              answer={item.answer}
              index={start + i}
            />
          ))}
        </div>

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-[#e2e8f0] flex items-center justify-between">
            <p className="text-xs text-[#94a3b8]">
              Showing {start + 1}–{Math.min(start + ITEMS_PER_PAGE, items.length)} of {items.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#64748b]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#64748b]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
