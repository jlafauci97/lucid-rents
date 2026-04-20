/**
 * City-dispatching layer for neighborhood lookups.
 * Routes to the appropriate city-specific module.
 */
import type { City } from "./cities";
import {
  searchNeighborhoods as searchNYCNeighborhoods,
  getNeighborhoodName as getNYCNeighborhoodName,
  neighborhoodPageSlug as nycNeighborhoodPageSlug,
  NYC_ZIP_NEIGHBORHOODS,
  NYC_ZIP_BOROUGHS,
  type NeighborhoodMatch as NYCNeighborhoodMatch,
} from "./nyc-neighborhoods";
import {
  searchLANeighborhoods,
  getLANeighborhoodName,
  laNeighborhoodPageSlug,
  LA_ZIP_NEIGHBORHOODS,
  LA_ZIP_REGIONS,
} from "./la-neighborhoods";
import {
  searchChicagoNeighborhoods,
  getChicagoNeighborhoodName,
  chicagoNeighborhoodPageSlug,
  CHICAGO_ZIP_NEIGHBORHOODS,
  CHICAGO_ZIP_REGIONS,
} from "./chicago-neighborhoods";
import {
  searchMiamiNeighborhoods,
  getMiamiNeighborhoodName,
  miamiNeighborhoodPageSlug,
  MIAMI_ZIP_NEIGHBORHOODS,
  MIAMI_ZIP_REGIONS,
} from "./miami-neighborhoods";
import {
  searchHoustonNeighborhoods,
  getHoustonNeighborhoodName,
  houstonNeighborhoodPageSlug,
  HOUSTON_ZIP_NEIGHBORHOODS,
  HOUSTON_ZIP_REGIONS,
} from "./houston-neighborhoods";

export interface NeighborhoodResult {
  zipCode: string;
  name: string;
  /** Borough (NYC) or region (LA) */
  region: string;
}

/** Search neighborhoods across the given city */
export function searchNeighborhoodsByCity(
  query: string,
  city: City,
  limit = 3
): NeighborhoodResult[] {
  if (city === "nyc") {
    return searchNYCNeighborhoods(query, limit).map((m) => ({
      zipCode: m.zipCode,
      name: m.name,
      region: m.borough,
    }));
  }
  if (city === "los-angeles") {
    return searchLANeighborhoods(query, limit).map((m) => ({
      zipCode: m.zipCode,
      name: m.name,
      region: m.region,
    }));
  }
  if (city === "chicago") {
    return searchChicagoNeighborhoods(query, limit).map((m) => ({
      zipCode: m.zipCode,
      name: m.name,
      region: m.region,
    }));
  }
  if (city === "miami") {
    return searchMiamiNeighborhoods(query, limit).map((m) => ({
      zipCode: m.zipCode,
      name: m.name,
      region: m.region,
    }));
  }
  if (city === "houston") {
    return searchHoustonNeighborhoods(query, limit).map((m) => ({
      zipCode: m.zipCode,
      name: m.name,
      region: m.region,
    }));
  }
  return [];
}

/** Get the neighborhood name for a zip code in the given city */
export function getNeighborhoodNameByCity(
  zipCode: string,
  city: City
): string | null {
  if (city === "nyc") return getNYCNeighborhoodName(zipCode);
  if (city === "los-angeles") return getLANeighborhoodName(zipCode);
  if (city === "chicago") return getChicagoNeighborhoodName(zipCode);
  if (city === "miami") return getMiamiNeighborhoodName(zipCode);
  if (city === "houston") return getHoustonNeighborhoodName(zipCode);
  return null;
}

export interface BuildingNeighborhood {
  name: string;
  isFallback: boolean;
}

/**
 * Resolve a building's neighborhood from its ZIP code, with borough fallback.
 * Single source of truth — all SEO metadata, H1, breadcrumbs, and JSON-LD
 * should call this instead of touching the ZIP tables directly.
 */
export function buildingNeighborhood(
  building: { zip_code: string | null; borough: string },
  city: City
): BuildingNeighborhood {
  if (building.zip_code) {
    const resolved = getNeighborhoodNameByCity(building.zip_code, city);
    if (resolved) return { name: resolved, isFallback: false };
  }
  return { name: building.borough, isFallback: true };
}

/** Get all neighborhoods for a city */
export function getAllNeighborhoodsByCity(city: City): NeighborhoodResult[] {
  const mapToResults = (
    zips: Record<string, string>,
    regions: Record<string, string>,
    defaultRegion: string
  ): NeighborhoodResult[] =>
    Object.entries(zips).map(([zipCode, name]) => ({
      zipCode,
      name,
      region: regions[zipCode] || defaultRegion,
    }));

  if (city === "nyc") return mapToResults(NYC_ZIP_NEIGHBORHOODS, NYC_ZIP_BOROUGHS, "Unknown");
  if (city === "los-angeles") return mapToResults(LA_ZIP_NEIGHBORHOODS, LA_ZIP_REGIONS, "Los Angeles");
  if (city === "chicago") return mapToResults(CHICAGO_ZIP_NEIGHBORHOODS, CHICAGO_ZIP_REGIONS, "Chicago");
  if (city === "miami") return mapToResults(MIAMI_ZIP_NEIGHBORHOODS, MIAMI_ZIP_REGIONS, "Miami-Dade");
  if (city === "houston") return mapToResults(HOUSTON_ZIP_NEIGHBORHOODS, HOUSTON_ZIP_REGIONS, "Greater Houston");
  return [];
}

/** Build the neighborhood page slug for the given city */
export function neighborhoodPageSlugByCity(
  zipCode: string,
  city: City
): string {
  if (city === "nyc") return nycNeighborhoodPageSlug(zipCode);
  if (city === "los-angeles") return laNeighborhoodPageSlug(zipCode);
  if (city === "chicago") return chicagoNeighborhoodPageSlug(zipCode);
  if (city === "miami") return miamiNeighborhoodPageSlug(zipCode);
  if (city === "houston") return houstonNeighborhoodPageSlug(zipCode);
  return zipCode;
}
