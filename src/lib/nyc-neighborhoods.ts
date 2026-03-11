/**
 * NYC zip code -> primary neighborhood name mapping.
 * Covers all active residential zip codes across the 5 boroughs.
 */
export const NYC_ZIP_NEIGHBORHOODS: Record<string, string> = {
  // ── Manhattan ──────────────────────────────────────────────────────
  "10001": "Chelsea",
  "10002": "Lower East Side",
  "10003": "East Village",
  "10004": "Financial District",
  "10005": "Financial District",
  "10006": "Financial District",
  "10007": "Tribeca",
  "10009": "East Village",
  "10010": "Gramercy Park",
  "10011": "Chelsea",
  "10012": "SoHo",
  "10013": "Tribeca",
  "10014": "West Village",
  "10016": "Murray Hill",
  "10017": "Midtown East",
  "10018": "Midtown",
  "10019": "Midtown West",
  "10020": "Midtown",
  "10021": "Upper East Side",
  "10022": "Midtown East",
  "10023": "Upper West Side",
  "10024": "Upper West Side",
  "10025": "Upper West Side",
  "10026": "Harlem",
  "10027": "Harlem",
  "10028": "Upper East Side",
  "10029": "East Harlem",
  "10030": "Harlem",
  "10031": "Hamilton Heights",
  "10032": "Washington Heights",
  "10033": "Washington Heights",
  "10034": "Inwood",
  "10035": "East Harlem",
  "10036": "Midtown West",
  "10037": "Harlem",
  "10038": "Financial District",
  "10039": "Harlem",
  "10040": "Washington Heights",
  "10044": "Roosevelt Island",
  "10065": "Upper East Side",
  "10069": "Upper West Side",
  "10075": "Upper East Side",
  "10128": "Upper East Side",
  "10280": "Battery Park City",
  "10281": "Battery Park City",
  "10282": "Battery Park City",

  // ── Bronx ──────────────────────────────────────────────────────────
  "10451": "Mott Haven",
  "10452": "Highbridge",
  "10453": "Morris Heights",
  "10454": "Mott Haven",
  "10455": "Hunts Point",
  "10456": "Morrisania",
  "10457": "Tremont",
  "10458": "Fordham",
  "10459": "Longwood",
  "10460": "West Farms",
  "10461": "Pelham Bay",
  "10462": "Parkchester",
  "10463": "Kingsbridge",
  "10464": "City Island",
  "10465": "Throgs Neck",
  "10466": "Wakefield",
  "10467": "Norwood",
  "10468": "University Heights",
  "10469": "Williamsbridge",
  "10470": "Woodlawn",
  "10471": "Riverdale",
  "10472": "Soundview",
  "10473": "Clason Point",
  "10474": "Hunts Point",
  "10475": "Co-op City",

  // ── Brooklyn ───────────────────────────────────────────────────────
  "11201": "Brooklyn Heights",
  "11203": "East Flatbush",
  "11204": "Bensonhurst",
  "11205": "Fort Greene",
  "11206": "Williamsburg",
  "11207": "East New York",
  "11208": "East New York",
  "11209": "Bay Ridge",
  "11210": "Flatbush",
  "11211": "Williamsburg",
  "11212": "Brownsville",
  "11213": "Crown Heights",
  "11214": "Bensonhurst",
  "11215": "Park Slope",
  "11216": "Bedford-Stuyvesant",
  "11217": "Park Slope",
  "11218": "Kensington",
  "11219": "Borough Park",
  "11220": "Sunset Park",
  "11221": "Bushwick",
  "11222": "Greenpoint",
  "11223": "Gravesend",
  "11224": "Coney Island",
  "11225": "Crown Heights",
  "11226": "Flatbush",
  "11228": "Dyker Heights",
  "11229": "Sheepshead Bay",
  "11230": "Midwood",
  "11231": "Carroll Gardens",
  "11232": "Sunset Park",
  "11233": "Bedford-Stuyvesant",
  "11234": "Canarsie",
  "11235": "Brighton Beach",
  "11236": "Canarsie",
  "11237": "Bushwick",
  "11238": "Prospect Heights",
  "11239": "East New York",

  // ── Queens ─────────────────────────────────────────────────────────
  "11101": "Long Island City",
  "11102": "Astoria",
  "11103": "Astoria",
  "11104": "Sunnyside",
  "11105": "Astoria",
  "11106": "Astoria",
  "11354": "Flushing",
  "11355": "Flushing",
  "11356": "College Point",
  "11357": "Whitestone",
  "11358": "Auburndale",
  "11360": "Bayside",
  "11361": "Bayside",
  "11362": "Little Neck",
  "11363": "Douglaston",
  "11364": "Oakland Gardens",
  "11365": "Fresh Meadows",
  "11366": "Fresh Meadows",
  "11367": "Kew Gardens Hills",
  "11368": "Corona",
  "11369": "East Elmhurst",
  "11370": "East Elmhurst",
  "11372": "Jackson Heights",
  "11373": "Elmhurst",
  "11374": "Rego Park",
  "11375": "Forest Hills",
  "11377": "Woodside",
  "11378": "Maspeth",
  "11379": "Middle Village",
  "11385": "Ridgewood",
  "11411": "Cambria Heights",
  "11412": "St. Albans",
  "11413": "Springfield Gardens",
  "11414": "Howard Beach",
  "11415": "Kew Gardens",
  "11416": "Ozone Park",
  "11417": "Ozone Park",
  "11418": "Richmond Hill",
  "11419": "South Richmond Hill",
  "11420": "South Ozone Park",
  "11421": "Woodhaven",
  "11422": "Rosedale",
  "11423": "Hollis",
  "11426": "Bellerose",
  "11427": "Queens Village",
  "11428": "Queens Village",
  "11429": "Queens Village",
  "11432": "Jamaica",
  "11433": "Jamaica",
  "11434": "Jamaica",
  "11435": "Briarwood",
  "11436": "South Ozone Park",
  "11691": "Far Rockaway",
  "11692": "Arverne",
  "11693": "Far Rockaway",
  "11694": "Rockaway Park",
  "11697": "Breezy Point",

  // ── Staten Island ──────────────────────────────────────────────────
  "10301": "St. George",
  "10302": "Port Richmond",
  "10303": "Mariners Harbor",
  "10304": "Stapleton",
  "10305": "Rosebank",
  "10306": "New Dorp",
  "10307": "Tottenville",
  "10308": "Great Kills",
  "10309": "Charleston",
  "10310": "West Brighton",
  "10312": "Eltingville",
  "10314": "Bulls Head",
};

/** Zip code -> borough mapping */
export const NYC_ZIP_BOROUGHS: Record<string, string> = {};
for (const zip of Object.keys(NYC_ZIP_NEIGHBORHOODS)) {
  if (zip >= "10001" && zip <= "10282") NYC_ZIP_BOROUGHS[zip] = "Manhattan";
  else if (zip >= "10301" && zip <= "10314") NYC_ZIP_BOROUGHS[zip] = "Staten Island";
  else if (zip >= "10451" && zip <= "10475") NYC_ZIP_BOROUGHS[zip] = "Bronx";
  else if (zip >= "11201" && zip <= "11239") NYC_ZIP_BOROUGHS[zip] = "Brooklyn";
  else NYC_ZIP_BOROUGHS[zip] = "Queens";
}

export interface NeighborhoodMatch {
  zipCode: string;
  name: string;
  borough: string;
}

/** Search neighborhoods by zip prefix or name substring */
export function searchNeighborhoods(query: string, limit = 3): NeighborhoodMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: NeighborhoodMatch[] = [];
  const isDigits = /^\d+$/.test(q);

  for (const [zip, name] of Object.entries(NYC_ZIP_NEIGHBORHOODS)) {
    if (results.length >= limit) break;

    const match = isDigits
      ? zip.startsWith(q)
      : name.toLowerCase().includes(q);

    if (match) {
      results.push({
        zipCode: zip,
        name,
        borough: NYC_ZIP_BOROUGHS[zip] || "Unknown",
      });
    }
  }

  return results;
}

/** Slugify a neighborhood name: "Lower East Side" -> "lower-east-side" */
export function neighborhoodSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

/** Get the neighborhood name for a zip code, or null if unknown */
export function getNeighborhoodName(zipCode: string): string | null {
  return NYC_ZIP_NEIGHBORHOODS[zipCode] ?? null;
}

/**
 * Build the URL slug for a neighborhood page.
 * Known zip: "chelsea-10001"
 * Unknown zip: "10048"
 */
export function neighborhoodPageSlug(zipCode: string): string {
  const name = getNeighborhoodName(zipCode);
  if (!name) return zipCode;
  return `${neighborhoodSlug(name)}-${zipCode}`;
}

/**
 * Parse a neighborhood page slug back to its zip code.
 * "chelsea-10001" -> "10001"
 * "10001" -> "10001"
 */
export function parseNeighborhoodSlug(slug: string): string {
  const match = slug.match(/(\d{5})$/);
  return match ? match[1] : slug;
}
