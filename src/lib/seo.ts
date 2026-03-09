const BASE_URL = "https://lucidrents.com";

export const BOROUGH_SLUGS: Record<string, string> = {
  Manhattan: "manhattan",
  Brooklyn: "brooklyn",
  Queens: "queens",
  Bronx: "bronx",
  "Staten Island": "staten-island",
};

export const SLUG_TO_BOROUGH: Record<string, string> = Object.fromEntries(
  Object.entries(BOROUGH_SLUGS).map(([name, slug]) => [slug, name])
);

export function buildingUrl(b: { borough: string; slug: string }): string {
  const boroughSlug = BOROUGH_SLUGS[b.borough] || b.borough.toLowerCase().replace(/\s+/g, "-");
  return `/building/${boroughSlug}/${b.slug}`;
}

export function landlordSlug(ownerName: string): string {
  return ownerName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function landlordUrl(ownerName: string): string {
  return `/landlord/${landlordSlug(ownerName)}`;
}

export function canonicalUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function generateBuildingSlug(fullAddress: string): string {
  return fullAddress
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

// --- JSON-LD generators ---

export function buildingJsonLd(building: {
  full_address: string;
  borough: string;
  zip_code: string | null;
  year_built: number | null;
  total_units: number | null;
  overall_score: number | null;
  review_count: number;
  slug: string;
}) {
  const url = canonicalUrl(buildingUrl(building));

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: building.full_address,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.full_address.split(",")[0]?.trim(),
      addressLocality: building.borough,
      addressRegion: "NY",
      postalCode: building.zip_code,
      addressCountry: "US",
    },
  };

  if (building.year_built) {
    schema.yearBuilt = building.year_built;
  }
  if (building.total_units) {
    schema.numberOfRooms = building.total_units;
  }
  if (building.review_count > 0 && building.overall_score != null) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: building.overall_score,
      bestRating: 10,
      worstRating: 0,
      ratingCount: building.review_count,
    };
  }

  return schema;
}

export function landlordJsonLd(name: string, buildingCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonicalUrl(landlordUrl(name)),
    description: `Property owner managing ${buildingCount} building${buildingCount !== 1 ? "s" : ""} in New York City`,
  };
}

export function newsCollectionJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "NYC Housing News",
    description:
      "Latest NYC rental market news, tenant rights updates, and housing guides for New York City renters.",
    url: canonicalUrl("/news"),
    publisher: {
      "@type": "Organization",
      name: "Lucid Rents",
      url: BASE_URL,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.url),
    })),
  };
}
