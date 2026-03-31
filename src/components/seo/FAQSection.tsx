import { HelpCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQAccordionItem } from "@/components/seo/FAQAccordionItem";
import type { FAQItem } from "@/lib/faq/types";

export function FAQSection({
  items,
  title = "Frequently Asked Questions",
}: {
  items: FAQItem[];
  title?: string;
}) {
  if (items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="mt-8" id="faq">
      <JsonLd data={jsonLd} />
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
          <div className="p-1.5 bg-[#EFF6FF] rounded-lg">
            <HelpCircle className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0F1D2E]">{title}</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              {items.length} question{items.length !== 1 ? "s" : ""} answered
            </p>
          </div>
        </div>

        {/* Questions */}
        <div className="px-2 py-1">
          {items.map((item, i) => (
            <FAQAccordionItem
              key={i}
              question={item.question}
              answer={item.answer}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
