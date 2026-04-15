import { JsonLd } from "@/components/seo/JsonLd";
import { generateBuildingFAQ } from "@/lib/faq/building-faq";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { Building } from "@/types";
import type { FAQItem } from "@/lib/faq/types";

// ── Accordion item ────────────────────────────────────────────────────────────

function FAQAccordionItem({ item, isLast }: { item: FAQItem; isLast: boolean }) {
  return (
    <details
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--v2-border)",
      }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 0",
          cursor: "pointer",
          listStyle: "none",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: 19,
            fontWeight: 700,
            color: "var(--v2-ink)",
            lineHeight: 1.3,
          }}
        >
          {item.question}
        </span>
        {/* Chevron icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--v2-ink-mute)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
          className="faq-chevron"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>

      <div
        style={{
          paddingBottom: 18,
          paddingRight: 28,
        }}
      >
        <p
          style={{
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            color: "var(--v2-ink-soft)",
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {item.answer}
        </p>
      </div>
    </details>
  );
}

// ── S09: Main export ──────────────────────────────────────────────────────────

interface Props {
  building: Building;
  data: BuildingV2Data;
}

export function S09_FAQ({ building, data }: Props) {
  // Adapt BuildingV2Data into the shape generateBuildingFAQ expects.
  // Fields the generator doesn't get will gracefully produce zero FAQ items
  // for that topic — it already handles empty arrays / null safely.

  const rents = data.rents.current.map((r) => ({
    bedrooms: r.bedrooms,
    min_rent: r.min_rent ?? 0,
    max_rent: r.max_rent ?? 0,
    median_rent: r.median_rent ?? 0,
    listing_count: r.listing_count,
    source: r.source ?? "",
  }));

  // Neighborhood rents: pick most recent entry per bedroom count from historic
  const neighborhoodRentMap = new Map<number, number>();
  for (const r of data.rents.neighborhood) {
    if (r.median_rent !== null && !neighborhoodRentMap.has(0)) {
      // We don't have per-bedroom neighborhood data in v2, so skip — generator
      // will omit the comparison question if empty, which is correct
    }
  }
  const neighborhoodRents: { bedrooms: number; median_rent: number }[] = [];

  const amenities = data.amenities.map((a) => ({
    amenity: a.amenity,
    category: a.category ?? "other",
    source: "building",
  }));

  // Build minimal violation/complaint arrays from recentViolations for the FAQ
  // The generator only uses these for counts/type-checking, and we already have
  // violation_count etc. on the building object for the primary FAQ questions.
  // Pass what we have typed; generator gracefully handles partial data.
  const violations = data.issues.recentViolations
    .filter((v) => v.source === "HPD")
    .map((v) => ({
      id: v.id as unknown as number,
      building_id: building.id,
      inspection_date: v.date || null,
      nov_issue_date: null,
      class: v.class,
      status: v.status,
      nov_description: v.description,
      apartment: null,
    }));

  const dobViolations = data.issues.recentViolations
    .filter((v) => v.source === "DOB")
    .map((v) => ({
      id: v.id as unknown as number,
      building_id: building.id,
      issue_date: v.date || null,
      violation_category: v.category,
      violation_type: v.class,
      description: v.description,
      penalty_amount: null,
      disposition_comments: v.status,
    }));

  const complaints = data.issues.recentViolations
    .filter((v) => v.source === "311")
    .map((v) => ({
      id: v.id as unknown as number,
      building_id: building.id,
      created_date: v.date || null,
      complaint_type: v.category,
      descriptor: v.description,
      status: v.status,
      agency: null,
      resolution_description: null,
    }));

  // Evictions: derive from timeline if present
  const evictions = data.timeline
    .filter((e) => e.type === "eviction")
    .map((e) => ({
      id: e.id as unknown as number,
      building_id: building.id,
      executed_date: e.date || null,
      eviction_apt_num: null,
      eviction_possession: null,
      residential_commercial: null,
    }));

  // Permits: derive from timeline
  const permits = data.timeline
    .filter((e) => e.type === "permit")
    .map((e) => ({
      id: e.id as unknown as number,
      building_id: building.id,
      issued_date: e.date || null,
      work_type: e.meta?.work_type as string | undefined ?? null,
      job_description: e.description,
      permit_status: e.meta?.status as string | undefined ?? null,
      estimated_job_costs: null,
    }));

  // Litigations: derive from timeline
  const litigations = data.timeline
    .filter((e) => e.type === "litigation")
    .map((e) => ({
      id: e.id as unknown as number,
      building_id: building.id,
      case_open_date: e.date || null,
      case_type: e.title,
      case_status: e.meta?.status as string | undefined ?? null,
      case_judgment: e.meta?.judgment as string | undefined ?? null,
      penalty: e.meta?.penalty as number | undefined ?? null,
    }));

  // Reviews: build minimal shape from pull quotes
  const reviews = data.reviews.pullQuotes.map((r) => ({
    id: r.id as unknown as number,
    building_id: building.id,
    overall_rating: r.rating,
    would_recommend: null,
    is_pet_friendly: null,
    pro_tags: [] as string[],
    con_tags: [] as string[],
    body: r.body,
    status: "published" as const,
    created_at: r.created_at,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cast = <T,>(v: unknown): T => v as unknown as T;

  const items = generateBuildingFAQ({
    building,
    rents,
    amenities,
    violations: cast(violations),
    complaints: cast(complaints),
    litigations: cast(litigations),
    dobViolations: cast(dobViolations),
    evictions: cast(evictions),
    permits: cast(permits),
    energy: data.energy,
    reviews: cast(reviews),
    neighborhoodRents,
    nearbySchools: {},
    nearbyTransit: {},
    crimeSummary: null,
  });

  // Hide entire section if no FAQ items generated
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
    <section
      id="faq"
      style={{
        paddingTop: 80,
        borderTop: "1px dashed var(--v2-border)",
        marginTop: 40,
      }}
    >
      {/* JSON-LD structured data */}
      <JsonLd data={jsonLd} />

      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            color: "var(--v2-ink-mute)",
            marginBottom: 8,
          }}
        >
          09 · FAQ
        </div>
        <h2
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Frequently asked questions
        </h2>
      </div>

      {/* Accordion container */}
      <div
        style={{
          background: "var(--v2-paper)",
          border: "1px solid var(--v2-border)",
          borderRadius: "var(--v2-radius-sm)",
          padding: "0 24px",
        }}
      >
        {items.map((item, idx) => (
          <FAQAccordionItem
            key={idx}
            item={item}
            isLast={idx === items.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
