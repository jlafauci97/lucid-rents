/**
 * Los Angeles zip code -> primary neighborhood name mapping.
 * Covers the main residential zip codes in the City of Los Angeles.
 */
export const LA_ZIP_NEIGHBORHOODS: Record<string, string> = {
  // ── Downtown / Central ────────────────────────────────────────────
  "90012": "Downtown",
  "90013": "Downtown",
  "90014": "Downtown",
  "90015": "Downtown",
  "90017": "Downtown",
  "90021": "Downtown",
  "90071": "Downtown",

  // ── Central LA ────────────────────────────────────────────────────
  "90004": "Los Feliz",
  "90005": "Koreatown",
  "90006": "Koreatown",
  "90010": "Mid-Wilshire",
  "90019": "Mid-City",
  "90020": "Koreatown",
  "90026": "Echo Park",
  "90027": "Los Feliz",
  "90028": "Hollywood",
  "90029": "East Hollywood",
  "90036": "Mid-Wilshire",
  "90038": "Hollywood",
  "90039": "Silver Lake",
  "90057": "Westlake",

  // ── East LA ───────────────────────────────────────────────────────
  "90031": "Lincoln Heights",
  "90032": "El Sereno",
  "90033": "Boyle Heights",
  "90063": "East Los Angeles",
  "90065": "Glassell Park",

  // ── Northeast LA ──────────────────────────────────────────────────
  "90041": "Eagle Rock",
  "90042": "Highland Park",

  // ── Westside ──────────────────────────────────────────────────────
  "90024": "Westwood",
  "90025": "West Los Angeles",
  "90034": "Palms",
  "90035": "Mid-Wilshire",
  "90049": "Brentwood",
  "90064": "Rancho Park",
  "90066": "Mar Vista",
  "90067": "Century City",
  "90077": "Bel Air",
  "90094": "Playa Vista",
  "90230": "Culver City",
  "90232": "Culver City",
  "90272": "Pacific Palisades",
  "90291": "Venice",
  "90292": "Marina del Rey",
  "90293": "Playa del Rey",
  "90401": "Santa Monica",
  "90402": "Santa Monica",
  "90403": "Santa Monica",
  "90404": "Santa Monica",
  "90405": "Santa Monica",

  // ── South LA ──────────────────────────────────────────────────────
  "90001": "Florence",
  "90002": "Watts",
  "90003": "South LA",
  "90007": "South LA",
  "90008": "Baldwin Hills",
  "90011": "South LA",
  "90016": "West Adams",
  "90018": "West Adams",
  "90037": "South LA",
  "90043": "Leimert Park",
  "90044": "Willowbrook",
  "90047": "Gramercy Park",
  "90059": "Watts",
  "90061": "South LA",
  "90062": "South LA",
  "90089": "University Park",

  // ── Harbor ────────────────────────────────────────────────────────
  "90710": "Harbor City",
  "90731": "San Pedro",
  "90732": "San Pedro",
  "90744": "Wilmington",
  "90745": "Carson",
  "90746": "Carson",
  "90810": "Long Beach",

  // ── San Fernando Valley ───────────────────────────────────────────
  "91040": "Sunland-Tujunga",
  "91042": "Tujunga",
  "91302": "Calabasas",
  "91303": "Canoga Park",
  "91304": "Canoga Park",
  "91306": "Winnetka",
  "91307": "West Hills",
  "91311": "Chatsworth",
  "91316": "Encino",
  "91324": "Northridge",
  "91325": "Northridge",
  "91326": "Porter Ranch",
  "91331": "Pacoima",
  "91335": "Reseda",
  "91340": "San Fernando",
  "91342": "Sylmar",
  "91343": "North Hills",
  "91344": "Granada Hills",
  "91345": "Mission Hills",
  "91352": "Sun Valley",
  "91356": "Tarzana",
  "91364": "Woodland Hills",
  "91367": "Woodland Hills",
  "91401": "Van Nuys",
  "91402": "Panorama City",
  "91403": "Sherman Oaks",
  "91405": "Van Nuys",
  "91406": "Van Nuys",
  "91411": "Van Nuys",
  "91423": "Sherman Oaks",
  "91436": "Encino",
  "91501": "Burbank",
  "91502": "Burbank",
  "91504": "Burbank",
  "91505": "Burbank",
  "91506": "Burbank",
  "91601": "North Hollywood",
  "91602": "North Hollywood",
  "91604": "Studio City",
  "91605": "North Hollywood",
  "91606": "North Hollywood",
  "91607": "Valley Village",
  "91608": "Universal City",

  // ── Glendale / Pasadena corridor ──────────────────────────────────
  "91201": "Glendale",
  "91202": "Glendale",
  "91203": "Glendale",
  "91204": "Glendale",
  "91205": "Glendale",
  "91206": "Glendale",
  "91207": "Glendale",
  "91101": "Pasadena",
  "91103": "Pasadena",
  "91104": "Pasadena",
  "91105": "Pasadena",
  "91106": "Pasadena",
  "91107": "Pasadena",

  // ── Southeast cities ──────────────────────────────────────────────
  "90220": "Compton",
  "90221": "Compton",
  "90222": "Compton",
  "90240": "Downey",
  "90241": "Downey",
  "90242": "Downey",
  "90250": "Hawthorne",
  "90260": "Lawndale",
  "90262": "Lynwood",
  "90270": "Maywood",
  "90280": "South Gate",
  "90301": "Inglewood",
  "90302": "Inglewood",
  "90303": "Inglewood",
  "90304": "Inglewood",
  "90501": "Torrance",
  "90502": "Torrance",
  "90503": "Torrance",
  "90504": "Torrance",
  "90505": "Torrance",
};

/** Zip code -> area/region mapping for LA */
export const LA_ZIP_REGIONS: Record<string, string> = {};
for (const zip of Object.keys(LA_ZIP_NEIGHBORHOODS)) {
  const z = parseInt(zip);
  if (z >= 90012 && z <= 90071) LA_ZIP_REGIONS[zip] = "Downtown";
  else if (z >= 90004 && z <= 90057) LA_ZIP_REGIONS[zip] = "Central LA";
  else if (z >= 90031 && z <= 90065 && !LA_ZIP_REGIONS[zip]) LA_ZIP_REGIONS[zip] = "East LA";
  else if (z >= 90041 && z <= 90042) LA_ZIP_REGIONS[zip] = "Northeast LA";
  else if (z >= 90024 && z <= 90405) LA_ZIP_REGIONS[zip] = "Westside";
  else if (z >= 90001 && z <= 90089) LA_ZIP_REGIONS[zip] = "South LA";
  else if (z >= 90710 && z <= 90810) LA_ZIP_REGIONS[zip] = "Harbor";
  else if (z >= 91040 && z <= 91608) LA_ZIP_REGIONS[zip] = "San Fernando Valley";
  else if (z >= 91201 && z <= 91207) LA_ZIP_REGIONS[zip] = "Glendale";
  else if (z >= 91101 && z <= 91107) LA_ZIP_REGIONS[zip] = "Pasadena";
  else if (z >= 90220 && z <= 90505) LA_ZIP_REGIONS[zip] = "South Bay";
  else LA_ZIP_REGIONS[zip] = "Los Angeles";
}

export interface LANeighborhoodMatch {
  zipCode: string;
  name: string;
  region: string;
}

/** Search LA neighborhoods by zip prefix or name substring */
export function searchLANeighborhoods(query: string, limit = 3): LANeighborhoodMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: LANeighborhoodMatch[] = [];
  const isDigits = /^\d+$/.test(q);

  for (const [zip, name] of Object.entries(LA_ZIP_NEIGHBORHOODS)) {
    if (results.length >= limit) break;

    const match = isDigits
      ? zip.startsWith(q)
      : name.toLowerCase().includes(q);

    if (match) {
      results.push({
        zipCode: zip,
        name,
        region: LA_ZIP_REGIONS[zip] || "Los Angeles",
      });
    }
  }

  return results;
}

/** Get the neighborhood name for an LA zip code, or null if unknown */
export function getLANeighborhoodName(zipCode: string): string | null {
  return LA_ZIP_NEIGHBORHOODS[zipCode] ?? null;
}

/** Build the URL slug for an LA neighborhood page. */
export function laNeighborhoodPageSlug(zipCode: string): string {
  const name = getLANeighborhoodName(zipCode);
  if (!name) return zipCode;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${slug}-${zipCode}`;
}
