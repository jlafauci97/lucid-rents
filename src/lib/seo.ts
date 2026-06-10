import { type City, DEFAULT_CITY, CITY_META } from "./cities";
import { normalizeScore } from "./constants";
import { neighborhoodPageSlugByCity, buildingNeighborhood } from "./neighborhoods";

const BASE_URL = "https://lucidrents.com";

/** Slugify a region/borough name for URLs */
export function regionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Build an ILIKE pattern that treats spaces and hyphens as interchangeable.
 * Borough lookups must accept both "Mid City" and "Mid-City" because the DB
 * has both forms — `regionFromSlug("mid-city")` returns "Mid City" (space)
 * but the row may store "Mid-City" (hyphen). `_` is the LIKE single-char
 * wildcard, so "Mid_City" matches both.
 */
export function boroughIlikePattern(name: string): string {
  return name.replace(/[\s-]/g, "_");
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
  const bSlug = b.borough ? regionSlug(b.borough) : "unknown";
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

export function neighborhoodsUrl(city: City = DEFAULT_CITY): string {
  return `/${CITY_META[city].urlPrefix}/neighborhoods`;
}

export function canonicalUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function generateBuildingSlug(fullAddress: string): string {
  // Use only the street address (before first comma) to keep slugs
  // consistent across all cities. City/state suffixes are not needed
  // since queries always filter by metro as well.
  const streetOnly = fullAddress.split(",")[0].trim();
  return streetOnly
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
    name?: string | null;
    updated_at?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    bbl?: string | null;
    bin?: string | null;
    apn?: string | null;
    pin?: string | null;
    folio_number?: string | null;
    owner_name?: string | null;
    management_company?: string | null;
    is_rent_stabilized?: boolean;
    stabilized_units?: number | null;
    violation_count?: number;
    dob_violation_count?: number;
    complaint_count?: number;
    eviction_count?: number;
  },
  city: City = DEFAULT_CITY
) {
  const url = canonicalUrl(buildingUrl(building, city));
  const meta = CITY_META[city];

  // Prefer the building's proper name for SEO when available (e.g., "Carnegie Mews");
  // fall back to the address otherwise.
  const hasProperName = building.name && !/^\d/.test(building.name.trim()) && building.name.trim().length > 3;

  const { name: addressLocality } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    city
  );

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: hasProperName ? building.name : building.full_address,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.full_address.split(",")[0]?.trim(),
      addressLocality,
      addressRegion: meta.stateCode,
      postalCode: building.zip_code,
      addressCountry: "US",
    },
  };
  if (hasProperName) {
    schema.alternateName = building.full_address;
  }

  if (building.latitude != null && building.longitude != null) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: building.latitude,
      longitude: building.longitude,
    };
  }

  if (building.year_built) {
    schema.yearBuilt = building.year_built;
  }
  if (building.total_units) {
    schema.numberOfAccommodationUnits = building.total_units;
  }
  if (building.updated_at) {
    schema.dateModified = building.updated_at;
  }
  if (building.review_count > 0 && building.overall_score != null) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: normalizeScore(building.overall_score),
      bestRating: 5,
      worstRating: 1,
      ratingCount: building.review_count,
    };
  }

  // additionalProperty: proprietary identifiers and per-building data points
  // that vary across the network. Each one is a unique semantic signal Google
  // can index even if it doesn't surface in rich results.
  const additionalProperty: Array<{ "@type": "PropertyValue"; name: string; value: string | number | boolean }> = [];
  const propertyId = building.bbl || building.bin || building.apn || building.pin || building.folio_number;
  if (propertyId) {
    const idLabel = building.bbl ? "BBL" : building.bin ? "BIN" : building.apn ? "APN" : building.pin ? "PIN" : "Folio Number";
    additionalProperty.push({ "@type": "PropertyValue", name: idLabel, value: propertyId });
  }
  const ownerLabel = building.owner_name ?? building.management_company;
  if (ownerLabel) {
    additionalProperty.push({ "@type": "PropertyValue", name: "Owner", value: ownerLabel });
  }
  if (building.is_rent_stabilized) {
    additionalProperty.push({ "@type": "PropertyValue", name: "Rent Stabilized", value: true });
    if (building.stabilized_units != null && building.stabilized_units > 0) {
      additionalProperty.push({ "@type": "PropertyValue", name: "Stabilized Units", value: building.stabilized_units });
    }
  }
  const openHpd = building.violation_count ?? 0;
  if (openHpd > 0) {
    additionalProperty.push({ "@type": "PropertyValue", name: "HPD Violations", value: openHpd });
  }
  const openDob = building.dob_violation_count ?? 0;
  if (openDob > 0) {
    additionalProperty.push({ "@type": "PropertyValue", name: "DOB Violations", value: openDob });
  }
  const complaints = building.complaint_count ?? 0;
  if (complaints > 0) {
    additionalProperty.push({ "@type": "PropertyValue", name: "311 Complaints", value: complaints });
  }
  const evictions = building.eviction_count ?? 0;
  if (evictions > 0) {
    additionalProperty.push({ "@type": "PropertyValue", name: "Evictions Filed", value: evictions });
  }
  if (additionalProperty.length > 0) {
    schema.additionalProperty = additionalProperty;
  }

  return schema;
}

export interface LandlordReviewExcerpt {
  rating: number;
  text: string;
  building_address: string;
  region: string;
  created_at: string;
}

export interface LandlordRatingInput {
  /** Portfolio LucidIQ score (0-5). */
  lucidIqScore: number;
  /** Total published tenant reviews across the portfolio. */
  reviewCount: number;
  /** Up to ~3 representative review excerpts for review-snippet eligibility. */
  excerpts?: LandlordReviewExcerpt[];
}

export function landlordJsonLd(
  name: string,
  buildingCount: number,
  city: City = DEFAULT_CITY,
  updatedAt?: string,
  totalIssues?: number,
  rating?: LandlordRatingInput | null
) {
  const meta = CITY_META[city];
  const issueClause =
    totalIssues != null && totalIssues > 0
      ? ` with ${totalIssues.toLocaleString("en-US")} issues filed`
      : "";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonicalUrl(landlordUrl(name, city)),
    description: `Property owner managing ${buildingCount.toLocaleString("en-US")} building${buildingCount !== 1 ? "s" : ""}${issueClause} in ${meta.fullName}`,
  };
  if (updatedAt) {
    ld.dateModified = updatedAt;
  }
  if (rating && rating.reviewCount > 0 && Number.isFinite(rating.lucidIqScore)) {
    // LucidIQ is a 0–5 composite; clamp to [1, 5] for Google's expected scale
    // (matches the convention used by buildingJsonLd above).
    const ratingValue = Math.max(1, Math.min(5, rating.lucidIqScore));
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(ratingValue.toFixed(1)),
      bestRating: 5,
      worstRating: 1,
      reviewCount: rating.reviewCount,
    };
    if (rating.excerpts && rating.excerpts.length > 0) {
      ld.review = rating.excerpts.map((r) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: Number(Math.max(1, Math.min(5, r.rating)).toFixed(1)),
          bestRating: 5,
          worstRating: 1,
        },
        author: { "@type": "Person", name: "Verified Tenant" },
        reviewBody: r.text,
        datePublished: r.created_at,
        itemReviewed: {
          "@type": "ApartmentComplex",
          name: r.building_address,
          address: {
            "@type": "PostalAddress",
            addressLocality: r.region,
            addressRegion: meta.stateCode,
            addressCountry: "US",
          },
        },
      }));
    }
  }
  return ld;
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
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

export function newsArticleJsonLd(article: {
  slug: string;
  title: string;
  excerpt?: string | null;
  published_at: string;
  updated_at?: string | null;
  image_url?: string | null;
}) {
  const url = canonicalUrl(`/news/${article.slug}`);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: article.published_at,
    author: {
      "@type": "Organization",
      name: "Lucid Rents",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Lucid Rents",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/lucid-rents-logo.png`,
      },
    },
  };
  if (article.excerpt) {
    schema.description = article.excerpt;
  }
  if (article.updated_at) {
    schema.dateModified = article.updated_at;
  }
  if (article.image_url) {
    schema.image = article.image_url;
  }
  return schema;
}

/** Build a standard [Home, {City}, ...trail] breadcrumb array for city pages */
export function cityBreadcrumbs(
  city: City,
  ...trail: { label: string; href: string }[]
): { label: string; href: string }[] {
  return [
    { label: "Home", href: "/" },
    { label: CITY_META[city].name, href: cityPath("", city) },
    ...trail,
  ];
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
