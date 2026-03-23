/**
 * City-dispatching layer for neighborhood lookups.
 * Routes to the appropriate city-specific module.
 */
import type { City } from "./cities";
import {
  searchNeighborhoods as searchNYCNeighborhoods,
  getNeighborhoodName as getNYCNeighborhoodName,
  neighborhoodPageSlug as nycNeighborhoodPageSlug,
  type NeighborhoodMatch as NYCNeighborhoodMatch,
} from "./nyc-neighborhoods";
import {
  searchLANeighborhoods,
  getLANeighborhoodName,
  laNeighborhoodPageSlug,
} from "./la-neighborhoods";
import {
  searchChicagoNeighborhoods,
  getChicagoNeighborhoodName,
  chicagoNeighborhoodPageSlug,
} from "./chicago-neighborhoods";

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
  return null;
}

/** Build the neighborhood page slug for the given city */
export function neighborhoodPageSlugByCity(
  zipCode: string,
  city: City
): string {
  if (city === "nyc") return nycNeighborhoodPageSlug(zipCode);
  if (city === "los-angeles") return laNeighborhoodPageSlug(zipCode);
  if (city === "chicago") return chicagoNeighborhoodPageSlug(zipCode);
  return zipCode;
}
