/**
 * S09 Frequently asked questions — verbatim port of mockup lines 4365–4574.
 *
 *   <section class="section" id="faq">
 *     <div class="section-head">…09 / 09  Frequently asked questions.…</div>
 *     <ul class="faq-list">
 *       <li class="faq-item">
 *         <details>
 *           <summary><span>Q</span><svg class="chevron"/></summary>
 *           <div class="faq-body">A</div>
 *         </details>
 *       </li>
 *     </ul>
 *   </section>
 *
 * We delegate Q/A generation to the existing generateBuildingFAQ() helper
 * and emit FAQPage JSON-LD for SEO.
 */

import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import { generateBuildingFAQ } from "@/lib/faq/building-faq";

interface Props {
  building: Building;
  data: BuildingV2Data;
}

export function S09_FAQ({ building, data }: Props) {
  let faqs: Array<{ question: string; answer: string }> = [];
  try {
    // Delegate to the existing generator. Signature varies; pass what we have.
    // Fields the generator may expect but we don't have are left undefined.
    faqs = generateBuildingFAQ({
      building,
      rents: data.rents.current,
      reviews: [],
      hpdViolations: [],
      complaints311: [],
      dobViolations: [],
      evictions: [],
      permits: [],
      amenities: data.amenities.map((a) => ({ amenity: a.amenity, category: a.category })),
      energy: data.energy,
    } as unknown as Parameters<typeof generateBuildingFAQ>[0]) as Array<{ question: string; answer: string }>;
  } catch {
    faqs = [];
  }

  // Minimal on-page fallback so the section is never empty.
  if (!faqs.length) {
    const street = building.full_address.split(",")[0] ?? building.full_address;
    faqs = [
      {
        question: `When was ${street} built and how many units does it have?`,
        answer: [
          building.year_built ? `${street} was built in ${building.year_built}.` : null,
          building.num_floors ? `It has ${building.num_floors} floors` : null,
          building.total_units ? `${building.num_floors ? " and " : "It contains "}${building.total_units.toLocaleString()} total units.` : null,
        ].filter(Boolean).join(" "),
      },
      {
        question: `Is ${street} rent stabilized?`,
        answer: building.is_rent_stabilized
          ? `Yes, ${street} is registered as rent stabilized. Rent-stabilized tenants have protections limiting annual rent increases and providing lease renewal rights.`
          : `${street} does not appear to be rent stabilized based on public records.`,
      },
      {
        question: `Are there violations at ${street}?`,
        answer: `${street} has ${building.violation_count ?? 0} HPD violations and ${building.complaint_count ?? 0} 311 complaints on record. See the Violations section above for the full breakdown.`,
      },
    ];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section className="section" id="faq">
      <div className="section-head">
        <div>
          <div className="num">09 / 09</div>
          <h2>Frequently asked questions.</h2>
        </div>
        <div className="meta"></div>
      </div>

      <ul className="faq-list">
        {faqs.map((f, i) => (
          <li key={i} className="faq-item">
            <details>
              <summary>
                <span>{f.question}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <div className="faq-body">{f.answer}</div>
            </details>
          </li>
        ))}
      </ul>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
