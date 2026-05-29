import type { City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { buildingUrl, canonicalUrl } from "@/lib/seo";

/** Median of a numeric list, or null if empty. */
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Resolve a neighborhood label from a building/rent row. `buildings` has no
 * `neighborhood` column — we derive it from the ZIP, the same way the building
 * pages do, and fall back to the borough/region when the ZIP isn't mapped.
 */
export function neighborhoodOf(
  zip: string | null | undefined,
  fallback: string | null | undefined,
  city: City
): string {
  if (zip) {
    const n = getNeighborhoodNameByCity(zip, city);
    if (n) return n;
  }
  return fallback ?? "the area";
}

/** Canonical on-site link + short address label for a building row. */
export function buildingLink(
  b: { borough: string; slug: string; full_address: string },
  city: City
): { address: string; url: string } {
  return {
    address: b.full_address.split(",")[0]?.trim() || b.full_address,
    url: canonicalUrl(buildingUrl({ borough: b.borough, slug: b.slug }, city)),
  };
}
