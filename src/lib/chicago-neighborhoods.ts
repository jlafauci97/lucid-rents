/**
 * Chicago zip code -> primary neighborhood name mapping.
 * Covers the main residential zip codes in the City of Chicago.
 */
export const CHICAGO_ZIP_NEIGHBORHOODS: Record<string, string> = {
  // ── Loop / Downtown ──────────────────────────────────────────────
  "60601": "South Loop",
  "60602": "Loop",
  "60603": "Loop",
  "60604": "Loop",
  "60605": "South Loop",
  "60606": "West Loop",
  "60607": "West Loop",
  "60661": "West Loop",

  // ── Near North ───────────────────────────────────────────────────
  "60610": "Old Town",
  "60611": "Streeterville",
  "60642": "Goose Island",
  "60654": "River North",

  // ── North Side ───────────────────────────────────────────────────
  "60613": "Lakeview",
  "60614": "Lincoln Park",
  "60618": "Avondale",
  "60625": "Lincoln Square",
  "60657": "Lakeview",

  // ── Far North ────────────────────────────────────────────────────
  "60626": "Rogers Park",
  "60640": "Uptown",
  "60645": "West Ridge",
  "60659": "West Rogers Park",
  "60660": "Edgewater",

  // ── Northwest ────────────────────────────────────────────────────
  "60630": "Jefferson Park",
  "60631": "Edison Park",
  "60634": "Portage Park",
  "60639": "Belmont Cragin",
  "60641": "Irving Park",
  "60646": "Norwood Park",
  "60656": "O'Hare",

  // ── West Side ────────────────────────────────────────────────────
  "60612": "Near West Side",
  "60622": "Wicker Park",
  "60623": "North Lawndale",
  "60624": "Garfield Park",
  "60644": "Austin",
  "60647": "Logan Square",
  "60651": "Humboldt Park",

  // ── Southwest ────────────────────────────────────────────────────
  "60608": "Pilsen",
  "60609": "Back of the Yards",
  "60616": "Chinatown",
  "60629": "Chicago Lawn",
  "60632": "Brighton Park",
  "60636": "West Englewood",
  "60638": "Clearing",
  "60652": "Ashburn",

  // ── South Side ───────────────────────────────────────────────────
  "60615": "Hyde Park",
  "60617": "South Chicago",
  "60619": "Chatham",
  "60620": "Auburn Gresham",
  "60621": "Englewood",
  "60628": "Roseland",
  "60637": "Woodlawn",
  "60649": "South Shore",
  "60653": "Bronzeville",
  "60655": "Hegewisch",

  // ── Far South ────────────────────────────────────────────────────
  "60643": "Beverly",
};

/** Neighborhood -> region mapping for Chicago community areas */
const CHICAGO_REGION_MAP: Record<string, string> = {
  "Loop": "Central",
  "South Loop": "Central",
  "West Loop": "Central",
  "Near West Side": "Central",
  "River North": "Central",
  "Streeterville": "Central",
  "Old Town": "Central",
  "Goose Island": "Central",
  "Lincoln Park": "North Side",
  "Lakeview": "North Side",
  "Lincoln Square": "North Side",
  "Avondale": "North Side",
  "Rogers Park": "Far North Side",
  "Uptown": "Far North Side",
  "Edgewater": "Far North Side",
  "West Ridge": "Far North Side",
  "West Rogers Park": "Far North Side",
  "Wicker Park": "West Side",
  "Logan Square": "West Side",
  "Humboldt Park": "West Side",
  "Garfield Park": "West Side",
  "Austin": "West Side",
  "North Lawndale": "West Side",
  "Pilsen": "Southwest Side",
  "Bridgeport": "Southwest Side",
  "Back of the Yards": "Southwest Side",
  "Brighton Park": "Southwest Side",
  "Chinatown": "Southwest Side",
  "Chicago Lawn": "Southwest Side",
  "West Englewood": "Southwest Side",
  "Clearing": "Southwest Side",
  "Ashburn": "Southwest Side",
  "Hyde Park": "South Side",
  "Woodlawn": "South Side",
  "South Shore": "South Side",
  "Bronzeville": "South Side",
  "Chatham": "South Side",
  "Auburn Gresham": "South Side",
  "Englewood": "South Side",
  "South Chicago": "Far South Side",
  "Roseland": "Far South Side",
  "Beverly": "Far South Side",
  "Hegewisch": "Far South Side",
  "Jefferson Park": "Northwest Side",
  "Edison Park": "Northwest Side",
  "Portage Park": "Northwest Side",
  "Irving Park": "Northwest Side",
  "Norwood Park": "Northwest Side",
  "Belmont Cragin": "Northwest Side",
  "O'Hare": "Northwest Side",
};

/** Zip code -> region mapping for Chicago */
export const CHICAGO_ZIP_REGIONS: Record<string, string> = {};
for (const [zip, name] of Object.entries(CHICAGO_ZIP_NEIGHBORHOODS)) {
  CHICAGO_ZIP_REGIONS[zip] = CHICAGO_REGION_MAP[name] || "Chicago";
}

export interface ChicagoNeighborhoodMatch {
  zipCode: string;
  name: string;
  region: string;
}

/** Search Chicago neighborhoods by zip prefix or name substring */
export function searchChicagoNeighborhoods(query: string, limit = 3): ChicagoNeighborhoodMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: ChicagoNeighborhoodMatch[] = [];
  const isDigits = /^\d+$/.test(q);

  for (const [zip, name] of Object.entries(CHICAGO_ZIP_NEIGHBORHOODS)) {
    if (results.length >= limit) break;

    const match = isDigits
      ? zip.startsWith(q)
      : name.toLowerCase().includes(q);

    if (match) {
      results.push({
        zipCode: zip,
        name,
        region: CHICAGO_ZIP_REGIONS[zip] || "Chicago",
      });
    }
  }

  return results;
}

/** Get the neighborhood name for a Chicago zip code, or null if unknown */
export function getChicagoNeighborhoodName(zipCode: string): string | null {
  return CHICAGO_ZIP_NEIGHBORHOODS[zipCode] ?? null;
}

/** Build the URL slug for a Chicago neighborhood page. */
export function chicagoNeighborhoodPageSlug(zipCode: string): string {
  const name = getChicagoNeighborhoodName(zipCode);
  if (!name) return zipCode;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${slug}-${zipCode}`;
}
