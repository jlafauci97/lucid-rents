/**
 * Miami-Dade zip code -> primary neighborhood name mapping.
 * Covers the main residential zip codes in Miami-Dade County.
 */
export const MIAMI_ZIP_NEIGHBORHOODS: Record<string, string> = {
  // ── Downtown / Brickell ─────────────────────────────────────────
  "33128": "Downtown Miami",
  "33130": "Downtown Miami",
  "33131": "Brickell",
  "33132": "Downtown Miami",

  // ── Midtown / Wynwood / Edgewater ───────────────────────────────
  "33127": "Wynwood",
  "33137": "Edgewater",
  "33138": "Upper East Side",

  // ── Miami Beach ─────────────────────────────────────────────────
  "33139": "South Beach",
  "33140": "Mid-Beach",
  "33141": "North Beach",
  "33109": "Fisher Island",
  "33154": "Surfside",

  // ── Central Miami ───────────────────────────────────────────────
  "33125": "Little Havana",
  "33126": "Flagami",
  "33129": "Brickell",
  "33133": "Coconut Grove",
  "33135": "Flagami",
  "33136": "Overtown",
  "33142": "Allapattah",
  "33144": "Coral Way",
  "33145": "Coral Way",
  "33150": "Little Haiti",

  // ── Coral Gables / South Miami ──────────────────────────────────
  "33134": "Coral Gables",
  "33143": "South Miami",
  "33146": "Coral Gables",

  // ── Northwest Miami ─────────────────────────────────────────────
  "33147": "Liberty City",
  "33148": "Liberty City",

  // ── North Miami / Aventura ──────────────────────────────────────
  "33160": "Sunny Isles Beach",
  "33161": "North Miami",
  "33162": "North Miami Beach",
  "33167": "North Miami",
  "33168": "Miami Gardens",
  "33169": "Miami Gardens",
  "33179": "Aventura",
  "33180": "Aventura",
  "33181": "North Miami Beach",

  // ── Doral / Sweetwater ──────────────────────────────────────────
  "33122": "Doral",
  "33166": "Doral",
  "33172": "Doral",
  "33174": "Sweetwater",
  "33175": "Fontainebleau",
  "33178": "Doral",
  "33184": "Sweetwater",

  // ── Hialeah ─────────────────────────────────────────────────────
  "33010": "Hialeah",
  "33012": "Hialeah",
  "33013": "Hialeah",
  "33014": "Hialeah",
  "33015": "Hialeah Gardens",
  "33016": "Hialeah",
  "33018": "Hialeah Gardens",

  // ── Kendall / South Dade ────────────────────────────────────────
  "33155": "West Miami",
  "33156": "Pinecrest",
  "33157": "Cutler Bay",
  "33158": "Palmetto Bay",
  "33173": "Kendall",
  "33176": "Kendall",
  "33177": "Kendall",
  "33182": "West Kendall",
  "33183": "Kendall",
  "33185": "West Kendall",
  "33186": "Kendall",
  "33187": "West Kendall",
  "33189": "Cutler Bay",
  "33193": "Kendale Lakes",
  "33196": "West Kendall",

  // ── Key Biscayne ────────────────────────────────────────────────
  "33149": "Key Biscayne",

  // ── Bal Harbour ─────────────────────────────────────────────────
  "33153": "Bal Harbour",

  // ── Homestead / Florida City ────────────────────────────────────
  "33030": "Homestead",
  "33031": "Homestead",
  "33033": "Homestead",
  "33034": "Florida City",
  "33035": "Homestead",
};

/** Neighborhood -> region mapping for Miami-Dade areas */
const MIAMI_REGION_MAP: Record<string, string> = {
  "Downtown Miami": "Central Miami",
  "Brickell": "Central Miami",
  "Wynwood": "Central Miami",
  "Edgewater": "Central Miami",
  "Overtown": "Central Miami",
  "Upper East Side": "Central Miami",
  "Little Havana": "Central Miami",
  "Little Haiti": "Central Miami",
  "Allapattah": "Central Miami",
  "Coral Way": "Central Miami",
  "Flagami": "Central Miami",
  "Liberty City": "Central Miami",
  "South Beach": "Miami Beach",
  "Mid-Beach": "Miami Beach",
  "North Beach": "Miami Beach",
  "Fisher Island": "Miami Beach",
  "Surfside": "Miami Beach",
  "Bal Harbour": "Miami Beach",
  "Coconut Grove": "South Miami",
  "Coral Gables": "South Miami",
  "South Miami": "South Miami",
  "Pinecrest": "South Miami",
  "Palmetto Bay": "South Miami",
  "Cutler Bay": "South Miami",
  "Key Biscayne": "South Miami",
  "West Miami": "South Miami",
  "Kendall": "South Dade",
  "West Kendall": "South Dade",
  "Kendale Lakes": "South Dade",
  "Homestead": "South Dade",
  "Florida City": "South Dade",
  "Fontainebleau": "West Miami-Dade",
  "Sweetwater": "West Miami-Dade",
  "Doral": "West Miami-Dade",
  "Hialeah": "Northwest Miami-Dade",
  "Hialeah Gardens": "Northwest Miami-Dade",
  "North Miami": "North Miami-Dade",
  "North Miami Beach": "North Miami-Dade",
  "Aventura": "North Miami-Dade",
  "Sunny Isles Beach": "North Miami-Dade",
  "Miami Gardens": "North Miami-Dade",
};

/** Zip code -> region mapping for Miami */
export const MIAMI_ZIP_REGIONS: Record<string, string> = {};
for (const [zip, name] of Object.entries(MIAMI_ZIP_NEIGHBORHOODS)) {
  MIAMI_ZIP_REGIONS[zip] = MIAMI_REGION_MAP[name] || "Miami-Dade";
}

export interface MiamiNeighborhoodMatch {
  zipCode: string;
  name: string;
  region: string;
}

/** Search Miami neighborhoods by zip prefix or name substring */
export function searchMiamiNeighborhoods(query: string, limit = 3): MiamiNeighborhoodMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: MiamiNeighborhoodMatch[] = [];
  const isDigits = /^\d+$/.test(q);

  for (const [zip, name] of Object.entries(MIAMI_ZIP_NEIGHBORHOODS)) {
    if (results.length >= limit) break;

    const match = isDigits
      ? zip.startsWith(q)
      : name.toLowerCase().includes(q);

    if (match) {
      results.push({
        zipCode: zip,
        name,
        region: MIAMI_ZIP_REGIONS[zip] || "Miami-Dade",
      });
    }
  }

  return results;
}

/** Get the neighborhood name for a Miami zip code, or null if unknown */
export function getMiamiNeighborhoodName(zipCode: string): string | null {
  return MIAMI_ZIP_NEIGHBORHOODS[zipCode] ?? null;
}

/** Build the URL slug for a Miami neighborhood page. */
export function miamiNeighborhoodPageSlug(zipCode: string): string {
  const name = getMiamiNeighborhoodName(zipCode);
  if (!name) return zipCode;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${slug}-${zipCode}`;
}
