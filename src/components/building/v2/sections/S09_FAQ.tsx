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
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import { generateBuildingFAQ } from "@/lib/faq/building-faq";

interface Props {
  building: Building;
  data: BuildingV2Data;
}

export function S09_FAQ({ building, data }: Props) {
  let faqs: Array<{ question: string; answer: string }> = [];
  try {
    // Map BuildingV2Data into the shapes generateBuildingFAQ expects so every
    // eligible question fires (previously all source arrays were passed empty,
    // which meant only ~4 FAQs appeared per building).
    const hpdViolations = data.issues.hpdViolations.map((v) => ({
      id: typeof v.id === "number" ? v.id : parseInt(String(v.id), 10) || 0,
      building_id: building.id,
      apartment: v.apartment,
      class: v.class,
      status: v.status,
      inspection_date: v.inspection_date,
      nov_description: v.nov_description,
    }));
    const complaints311 = data.issues.recentViolations
      .filter((r) => r.source === "311")
      .map((r) => ({
        id: r.id,
        building_id: building.id,
        created_date: r.date,
        complaint_type: r.category,
        descriptor: r.description,
        status: r.status,
      }));
    const dobViolations = data.issues.recentViolations
      .filter((r) => r.source === "DOB")
      .map((r) => ({
        id: r.id,
        building_id: building.id,
        issue_date: r.date,
        violation_type: r.class,
        violation_category: r.category,
        description: r.description,
        disposition_comments: r.status,
      }));
    const reviews = data.reviews.pullQuotes.map((q) => ({
      id: q.id,
      building_id: building.id,
      overall_rating: q.rating,
      body: q.body,
      created_at: q.created_at,
      pro_tags: [],
      con_tags: [],
      is_pet_friendly: null,
      is_rent_stabilized: null,
      is_doorman: null,
      has_laundry: null,
      has_gym: null,
    }));
    // Neighborhood rents: latest month per bedroom, collapsed to { bedrooms, median_rent }
    const latestNbhMonth = data.rents.neighborhood[0]?.month?.slice(0, 7);
    const neighborhoodRents = latestNbhMonth
      ? data.rents.neighborhood
          .filter((r) => r.month?.startsWith(latestNbhMonth) && r.median_rent)
          .map((r) => ({ bedrooms: r.beds ?? 0, median_rent: r.median_rent as number }))
      : [];
    // Shape nearby data for generateBuildingFAQ: it expects `distance` as a
    // formatted string and transit stops keyed by `routes`, not `lines`. Keys
    // map to the generator's label switch (subway/bus/...) and to a readable
    // school-type summary.
    const miles = (n: number) => `${n.toFixed(2)} mi`;
    const nearbySchools = {
      "public school": data.nearby.schoolsPublic.map((s) => ({ name: s.name, distance: miles(s.distMiles), walkMin: s.walkMin, grades: s.grades })),
      "charter school": data.nearby.schoolsCharter.map((s) => ({ name: s.name, distance: miles(s.distMiles), walkMin: s.walkMin, grades: s.grades })),
      "private school": data.nearby.schoolsPrivate.map((s) => ({ name: s.name, distance: miles(s.distMiles), walkMin: s.walkMin, grades: s.grades })),
    };
    const nearbyTransit = {
      subway: data.nearby.transitSubway.map((s) => ({ name: s.name, routes: s.lines, distance: miles(s.distMiles), walkMin: s.walkMin })),
      bus: data.nearby.transitBus.map((s) => ({ name: s.name, routes: s.lines, distance: miles(s.distMiles), walkMin: s.walkMin })),
    };
    const crimeSummary = {
      total: data.crime.total12mo,
      violent: data.crime.violent,
      property: data.crime.property,
      quality_of_life: data.crime.qualityOfLife,
    };

    // rentHistory: aggregate historic median rents into a single building-wide
    // value per month (weighted by listing_count when present). Earliest /
    // latest feed the rent-trend FAQ; covidLow adds the dip-and-recovery note.
    const monthAgg = new Map<string, { weighted: number; weight: number }>();
    for (const row of data.rents.historic) {
      if (row.median_rent == null || row.median_rent <= 0) continue;
      const key = row.month.slice(0, 7);
      const cur = monthAgg.get(key) ?? { weighted: 0, weight: 0 };
      const w = row.listing_count > 0 ? row.listing_count : 1;
      monthAgg.set(key, { weighted: cur.weighted + row.median_rent * w, weight: cur.weight + w });
    }
    const monthly = Array.from(monthAgg.entries())
      .map(([month, agg]) => ({ month, rent: Math.round(agg.weighted / agg.weight) }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const covidWindow = monthly.filter((m) => m.month >= "2020-04" && m.month <= "2021-06");
    const covidLow =
      covidWindow.length > 0
        ? covidWindow.reduce((min, m) => (m.rent < min.rent ? m : min))
        : undefined;
    const rentHistory =
      monthly.length >= 2
        ? { earliest: monthly[0], latest: monthly[monthly.length - 1], covidLow }
        : undefined;

    // seasonalData: average rent_index across bedroom types per month_of_year.
    // Cheapest vs most-expensive month + percent savings powers the
    // "when's the cheapest time to rent" FAQ.
    const seasonalAgg = new Map<number, { sum: number; n: number }>();
    for (const row of data.seasonalIndex) {
      const cur = seasonalAgg.get(row.month_of_year) ?? { sum: 0, n: 0 };
      seasonalAgg.set(row.month_of_year, { sum: cur.sum + row.rent_index, n: cur.n + 1 });
    }
    const seasonalMonths = Array.from(seasonalAgg.entries()).map(([m, agg]) => ({
      m,
      idx: agg.sum / agg.n,
    }));
    const seasonalData =
      seasonalMonths.length >= 2 && seasonalMonths.some((s) => s.idx > 0)
        ? (() => {
            const cheapest = seasonalMonths.reduce((a, b) => (a.idx < b.idx ? a : b));
            const expensive = seasonalMonths.reduce((a, b) => (a.idx > b.idx ? a : b));
            return expensive.idx > 0
              ? {
                  cheapestMonth: cheapest.m,
                  expensiveMonth: expensive.m,
                  savingsPercent: Math.round(((expensive.idx - cheapest.idx) / expensive.idx) * 100),
                }
              : undefined;
          })()
        : undefined;

    // evictions: the generator only reads `.length` and `executed_date` of the
    // first record. building.eviction_count is the source of truth for the
    // total; the timeline gives us the most recent date.
    const evictionCount = building.eviction_count ?? 0;
    const recentEvictionDate = data.timeline.find((e) => e.type === "eviction")?.date ?? null;
    const evictions =
      evictionCount > 0
        ? Array.from({ length: evictionCount }, (_, i) => ({
            executed_date: i === 0 ? recentEvictionDate : null,
          }))
        : [];

    faqs = generateBuildingFAQ({
      building,
      rents: data.rents.current,
      reviews,
      hpdViolations,
      complaints311,
      dobViolations,
      evictions,
      permits: [],
      amenities: data.amenities.map((a) => ({ amenity: a.amenity, category: a.category, source: "public-records" })),
      energy: data.energy,
      neighborhoodRents,
      nearbySchools,
      nearbyTransit,
      crimeSummary,
      rentHistory,
      seasonalData,
      violations: hpdViolations,
      complaints: complaints311,
      litigations: [],
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

  // Drop any entries that didn't produce a real answer — an empty string
  // serialises as `acceptedAnswer.text: ""` and trips Search Console's
  // "Missing field text" warning on the FAQPage schema.
  faqs = faqs.filter((f) => f.question.trim() !== "" && f.answer.trim() !== "");

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
