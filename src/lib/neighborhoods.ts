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
  NYC_ZIP_NEIGHBORHOODS,
  NYC_ZIP_BOROUGHS,
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

/** Get all neighborhoods for a city as an array of {zipCode, name, region} */
export function getAllNeighborhoodsByCity(city: City): NeighborhoodResult[] {
  const zipMap = getZipMap(city);
  const regionMap = getRegionMap(city);
  if (!zipMap) return [];
  return Object.entries(zipMap).map(([zipCode, name]) => ({
    zipCode,
    name,
    region: regionMap?.[zipCode] || "",
  }));
}

function getZipMap(city: City): Record<string, string> | null {
  if (city === "nyc") return NYC_ZIP_NEIGHBORHOODS;
  if (city === "los-angeles") return LA_ZIP_NEIGHBORHOODS;
  if (city === "chicago") return CHICAGO_ZIP_NEIGHBORHOODS;
  if (city === "miami") return MIAMI_ZIP_NEIGHBORHOODS;
  if (city === "houston") return HOUSTON_ZIP_NEIGHBORHOODS;
  return null;
}

function getRegionMap(city: City): Record<string, string> | null {
  if (city === "nyc") return NYC_ZIP_BOROUGHS;
  if (city === "los-angeles") return LA_ZIP_REGIONS;
  if (city === "chicago") return CHICAGO_ZIP_REGIONS;
  if (city === "miami") return MIAMI_ZIP_REGIONS;
  if (city === "houston") return HOUSTON_ZIP_REGIONS;
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
  if (city === "miami") return miamiNeighborhoodPageSlug(zipCode);
  if (city === "houston") return houstonNeighborhoodPageSlug(zipCode);
  return zipCode;
}
