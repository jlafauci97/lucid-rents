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
    <section className="mt-8">
      <JsonLd data={jsonLd} />
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-2">{title}</h2>
        <div>
          {items.map((item, i) => (
            <FAQAccordionItem
              key={i}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
