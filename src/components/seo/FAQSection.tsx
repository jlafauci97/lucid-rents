import { HelpCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQAccordionItem } from "@/components/seo/FAQAccordionItem";
import { T } from "@/lib/design-tokens";
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
      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: T.surface, borderColor: T.border }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${T.blue}14` }}>
            <HelpCircle className="w-5 h-5" style={{ color: T.blue }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: T.text1 }}>{title}</h2>
            <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
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
