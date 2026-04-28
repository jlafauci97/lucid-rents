import Link from "next/link";
import { Wrench, Calculator } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { TEMPLATES } from "@/lib/tenant-templates-data";
import { TOPIC_RELATED_TOOLS } from "@/lib/tenant-rights-data";
import type { City } from "@/lib/cities";

const CALCULATOR_LABELS: Record<string, string> = {
  "rent-affordability-calculator": "Rent affordability calculator",
  "rent-timing-calculator": "Rent timing calculator",
};

interface Props {
  city: City;
  topicSlug: string;
}

export function RelatedTools({ city, topicSlug }: Props) {
  const map = TOPIC_RELATED_TOOLS[topicSlug];
  if (!map) return null;
  if (map.templates.length === 0 && map.calculators.length === 0) return null;

  const templateLabels = new Map(TEMPLATES.map((t) => [t.slug, t.title ?? t.slug]));

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <h3 className="font-medium text-[#0F1D2E] mb-3">Related tools</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {map.templates.map((slug) => (
          <Link
            key={slug}
            href={cityPath(`/tenant-tools/templates/${slug}`, city)}
            className="flex items-start gap-2 rounded border border-[#e2e8f0] px-3 py-2 hover:border-[#3B82F6]"
          >
            <Wrench aria-hidden="true" className="w-4 h-4 text-[#3B82F6] mt-0.5 shrink-0" />
            <span className="text-sm text-[#0F1D2E]">{templateLabels.get(slug) ?? slug}</span>
          </Link>
        ))}
        {map.calculators.map((slug) => (
          <Link
            key={slug}
            href={`/${slug}`}
            className="flex items-start gap-2 rounded border border-[#e2e8f0] px-3 py-2 hover:border-[#3B82F6]"
          >
            <Calculator aria-hidden="true" className="w-4 h-4 text-[#3B82F6] mt-0.5 shrink-0" />
            <span className="text-sm text-[#0F1D2E]">{CALCULATOR_LABELS[slug] ?? slug}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
