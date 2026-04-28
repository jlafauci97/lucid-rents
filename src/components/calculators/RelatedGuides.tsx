import Link from "next/link";
import { ScrollText } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { CALCULATOR_RELATED_TOPICS } from "@/lib/calculator-related-topics";
import type { City } from "@/lib/cities";

interface Props {
  calculatorSlug: keyof typeof CALCULATOR_RELATED_TOPICS;
}

export function RelatedGuides({ calculatorSlug }: Props) {
  const topics = CALCULATOR_RELATED_TOPICS[calculatorSlug];
  if (!topics || topics.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 border-t border-[#e2e8f0] mt-12">
      <h3 className="font-medium text-[#0F1D2E] mb-3">Related guides</h3>
      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={`${t.city}/${t.slug}`}>
            <Link
              href={cityPath(`/tenant-rights/${t.slug}`, t.city as City)}
              className="flex items-center gap-2 text-sm text-[#0F1D2E] hover:text-[#3B82F6]"
            >
              <ScrollText aria-hidden="true" className="w-4 h-4 text-[#3B82F6]" />
              <span>{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
