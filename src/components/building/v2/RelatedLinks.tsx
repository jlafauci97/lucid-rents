import Link from "next/link";
import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { cityPath, landlordUrl, neighborhoodUrl, regionSlug } from "@/lib/seo";
import { buildingNeighborhood } from "@/lib/neighborhoods";

interface RelatedContext {
  sameStreetCount: number;
  ownerWorstCount: number;
  sameEraCount: number;
  neighborhoodMedian1BR: number | null;
  neighborhoodTrackedRentsCount: number;
}

interface Props {
  building: Building;
  landlord: BuildingV2Data["landlord"];
  context: RelatedContext;
  city: City;
}

interface Anchor {
  href: string;
  text: string;
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function streetDisplay(streetName: string | null | undefined): string {
  if (!streetName) return "";
  return streetName
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function RelatedLinks({ building, landlord, context, city }: Props) {
  const meta = CITY_META[city];
  const cityName = meta.name;
  const { name: neighborhoodName, isFallback: neighborhoodIsFallback } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    city
  );
  const boroughSlug = regionSlug(building.borough);

  const anchors: Anchor[] = [];

  // Owner / portfolio
  if (landlord.name && landlord.portfolioSize > 1) {
    anchors.push({
      href: landlordUrl(landlord.name, city),
      text: `Other buildings owned by ${landlord.name} — ${plural(landlord.portfolioSize, "property", "properties")} in ${cityName}`,
    });

    // Worst-scoring buildings in this owner's portfolio
    if (context.ownerWorstCount > 0) {
      anchors.push({
        href: landlordUrl(landlord.name, city),
        text: `Worst-scoring buildings in ${landlord.name}'s portfolio (${context.ownerWorstCount})`,
      });
    }
  }

  // Same street / block
  if (context.sameStreetCount > 0 && building.street_name) {
    const street = streetDisplay(building.street_name);
    anchors.push({
      href: cityPath(`/buildings/${boroughSlug}`, city),
      text: `Other buildings on ${street} (${context.sameStreetCount})`,
    });
  }

  // Same-era buildings in this borough
  if (context.sameEraCount > 0 && building.year_built) {
    const startYear = building.year_built - 10;
    const endYear = building.year_built + 10;
    anchors.push({
      href: cityPath(`/buildings/${boroughSlug}`, city),
      text: `Same-era ${building.borough} buildings (built ${startYear}–${endYear}, ${context.sameEraCount.toLocaleString()})`,
    });
  }

  // Neighborhood
  if (building.zip_code && !neighborhoodIsFallback) {
    anchors.push({
      href: neighborhoodUrl(building.zip_code, city),
      text: `Buildings, rent data, and risks in ${neighborhoodName}`,
    });
  }

  // Comparable price-band: neighborhood median 1BR + count of tracked rentals
  if (
    building.zip_code &&
    context.neighborhoodMedian1BR != null &&
    context.neighborhoodTrackedRentsCount > 0
  ) {
    const priceBand = Math.round(context.neighborhoodMedian1BR / 100) * 100;
    anchors.push({
      href: neighborhoodUrl(building.zip_code, city),
      text: `Comparable ${neighborhoodIsFallback ? building.borough : neighborhoodName} rentals — 1BR median around $${priceBand.toLocaleString()} (${context.neighborhoodTrackedRentsCount.toLocaleString()} tracked)`,
    });
  }

  // Borough
  anchors.push({
    href: cityPath(`/buildings/${boroughSlug}`, city),
    text: `Browse rental buildings in ${building.borough}`,
  });

  // Rent stabilization context (NYC + LA primarily)
  if (building.is_rent_stabilized) {
    anchors.push({
      href: cityPath("/rent-stabilization", city),
      text: `Rent-stabilized buildings in ${cityName} — coverage map and tenant rights`,
    });
  }

  // Problem-landlord rail (only for buildings with notable issue volume)
  const totalIssues = building.violation_count + building.dob_violation_count + building.complaint_count;
  if (totalIssues > 50) {
    anchors.push({
      href: cityPath("/problem-landlords", city),
      text: `${cityName}'s most-violated landlords — ranked by tenant complaints`,
    });
  }

  // Worst-rated context (only if building scored low)
  if (building.overall_score != null && building.overall_score <= 2.5) {
    anchors.push({
      href: cityPath("/worst-rated-buildings", city),
      text: `Lowest-rated buildings in ${cityName} by LucidIQ score`,
    });
  }

  // Era-based rail (data-driven anchor text)
  if (building.year_built && building.year_built < 1940) {
    anchors.push({
      href: cityPath(`/buildings/${boroughSlug}`, city),
      text: `Other prewar buildings in ${building.borough} (built before 1940)`,
    });
  }

  if (anchors.length < 2) return null;

  return (
    <aside
      className="related-links"
      id="related"
      style={{
        marginTop: 40,
        padding: 20,
        borderTop: "1px solid var(--v2-line, rgba(0,0,0,0.08))",
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, opacity: 0.7 }}>
        Related coverage
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {anchors.slice(0, 6).map((a) => (
          <li key={a.href + a.text}>
            <Link
              href={a.href}
              style={{
                fontSize: 14,
                color: "var(--v2-link, #2563eb)",
                textDecoration: "none",
                borderBottom: "1px solid transparent",
              }}
            >
              {a.text}
              <span aria-hidden="true" style={{ marginLeft: 4 }}>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
