import { type City, DEFAULT_CITY, CITY_META } from "./cities";
import { neighborhoodPageSlugByCity } from "./neighborhoods";

const BASE_URL = "https://lucidrents.com";

/** Slugify a region/borough name for URLs */
export function regionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/** Reverse-lookup: slug → display name. Works for any city's regions. */
export function regionFromSlug(slug: string, city: City = DEFAULT_CITY): string {
  const regions = CITY_META[city].regions;
  for (const r of regions) {
    if (regionSlug(r) === slug) return r;
  }
  // Fallback: title-case the slug
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Keep legacy exports for backward compatibility with existing NYC code
export const BOROUGH_SLUGS: Record<string, string> = Object.fromEntries(
  CITY_META.nyc.regions.map((r) => [r, regionSlug(r)])
);

// Maps region slug → display name for ALL cities (NYC boroughs + LA areas)
export const SLUG_TO_BOROUGH: Record<string, string> = Object.fromEntries(
  Object.values(CITY_META).flatMap((meta) =>
    meta.regions.map((r) => [regionSlug(r), r])
  )
);

/** Prefix a path with the city's external URL prefix */
export function cityPath(path: string, city: City = DEFAULT_CITY): string {
  return `/${CITY_META[city].urlPrefix}${path}`;
}

export function buildingUrl(
  b: { borough: string; slug: string },
  city: City = DEFAULT_CITY
): string {
  const bSlug = regionSlug(b.borough);
  return `/${CITY_META[city].urlPrefix}/building/${bSlug}/${b.slug}`;
}

export function landlordSlug(ownerName: string): string {
  return ownerName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function landlordUrl(
  ownerName: string,
  city: City = DEFAULT_CITY
): string {
  return `/${CITY_META[city].urlPrefix}/landlord/${landlordSlug(ownerName)}`;
}

export function neighborhoodUrl(
  zipCode: string,
  city: City = DEFAULT_CITY
): string {
  return `/${CITY_META[city].urlPrefix}/neighborhood/${neighborhoodPageSlugByCity(zipCode, city)}`;
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

export function buildingJsonLd(
  building: {
    full_address: string;
    borough: string;
    zip_code: string | null;
    year_built: number | null;
    total_units: number | null;
    overall_score: number | null;
    review_count: number;
    slug: string;
  },
  city: City = DEFAULT_CITY
) {
  const url = canonicalUrl(buildingUrl(building, city));
  const meta = CITY_META[city];

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: building.full_address,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.full_address.split(",")[0]?.trim(),
      addressLocality: building.borough,
      addressRegion: meta.stateCode,
      postalCode: building.zip_code,
      addressCountry: "US",
    },
  };

  if (building.year_built) {
    schema.yearBuilt = building.year_built;
  }
  if (building.total_units) {
    schema.numberOfAccommodationUnits = building.total_units;
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

export function landlordJsonLd(
  name: string,
  buildingCount: number,
  city: City = DEFAULT_CITY
) {
  const meta = CITY_META[city];
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonicalUrl(landlordUrl(name, city)),
    description: `Property owner managing ${buildingCount} building${buildingCount !== 1 ? "s" : ""} in ${meta.fullName}`,
  };
}

export function newsCollectionJsonLd(city: City = DEFAULT_CITY) {
  const meta = CITY_META[city];
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.name} Housing News`,
    description: `Latest ${meta.name} rental market news, tenant rights updates, and housing guides for ${meta.fullName} renters.`,
    url: canonicalUrl(cityPath("/news", city)),
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
