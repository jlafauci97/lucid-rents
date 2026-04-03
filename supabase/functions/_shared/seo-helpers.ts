import { CITY_META, type City } from "shared/cities.ts";

/** Slugify a region/borough name for URLs */
export function regionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function buildingUrl(
  b: { borough: string; slug: string },
  city: City = "nyc"
): string {
  const bSlug = b.borough ? regionSlug(b.borough) : "unknown";
  return `/${CITY_META[city].urlPrefix}/building/${bSlug}/${b.slug}`;
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
