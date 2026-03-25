export type City = "nyc" | "los-angeles" | "chicago" | "miami";

export const VALID_CITIES: City[] = ["nyc", "los-angeles", "chicago", "miami"];
export const DEFAULT_CITY: City = "nyc";

export interface CityMeta {
  name: string;
  fullName: string;
  state: string;
  stateCode: string;
  /** External URL prefix — used in generated links and sitemaps */
  urlPrefix: string;
  /** Top-level geographic regions (boroughs for NYC, areas for LA) */
  regions: readonly string[];
  /** Primary parcel identifier field name */
  parcelIdField: "bbl" | "apn" | "pin" | "folio";
  /** Label for the regions concept (e.g. "Borough" or "Area") */
  regionLabel: string;
  /** Hero image filename in /public */
  heroImage: string;
  /** Map default center */
  center: { lat: number; lng: number };
  /** Default map zoom level */
  zoom: number;
  /** Crime data source label (e.g. "NYPD", "LAPD") */
  crimeSource: string;
  /** Areas used for crime page filter chips — may differ from regions */
  crimeAreas: readonly string[];
}

export const CITY_META: Record<City, CityMeta> = {
  nyc: {
    name: "NYC",
    fullName: "New York City",
    state: "New York",
    stateCode: "NY",
    urlPrefix: "nyc",
    regions: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
    parcelIdField: "bbl",
    regionLabel: "Borough",
    heroImage: "/nyc-skyline.jpg",
    center: { lat: 40.7128, lng: -74.006 },
    zoom: 11,
    crimeSource: "NYPD",
    crimeAreas: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
  },
  "los-angeles": {
    name: "Los Angeles",
    fullName: "Los Angeles",
    state: "California",
    stateCode: "CA",
    urlPrefix: "CA/Los-Angeles",
    regions: [
      "Downtown",
      "Hollywood",
      "Silver Lake",
      "Echo Park",
      "Los Feliz",
      "Koreatown",
      "Mid-Wilshire",
      "Westlake",
      "East Hollywood",
      "Thai Town",
      "Highland Park",
      "Eagle Rock",
      "Boyle Heights",
      "Lincoln Heights",
      "El Sereno",
      "Glassell Park",
      "Atwater Village",
      "Venice",
      "Mar Vista",
      "Palms",
      "West Los Angeles",
      "Sawtelle",
      "Brentwood",
      "Pacific Palisades",
      "Westwood",
      "Century City",
      "Culver City",
      "Playa Vista",
      "South LA",
      "Leimert Park",
      "Baldwin Hills",
      "Crenshaw",
      "Watts",
      "Wilmington",
      "San Pedro",
      "Harbor City",
      "North Hollywood",
      "Studio City",
      "Sherman Oaks",
      "Van Nuys",
      "Encino",
      "Tarzana",
      "Reseda",
      "Northridge",
      "Chatsworth",
      "Canoga Park",
      "Woodland Hills",
      "Sunland-Tujunga",
      "Sylmar",
      "Pacoima",
      "Arleta",
      "Sun Valley",
    ],
    parcelIdField: "apn",
    regionLabel: "Area",
    heroImage: "/la-skyline.jpg",
    center: { lat: 34.0522, lng: -118.2437 },
    zoom: 10,
    crimeSource: "LAPD",
    crimeAreas: [
      "77th Street", "Central", "Devonshire", "Foothill", "Harbor",
      "Hollenbeck", "Hollywood", "Mission", "N Hollywood", "Newton",
      "Northeast", "Olympic", "Pacific", "Rampart", "Southeast",
      "Southwest", "Topanga", "Van Nuys", "West LA", "West Valley", "Wilshire",
    ],
  },
  chicago: {
    name: "Chicago",
    fullName: "Chicago",
    state: "Illinois",
    stateCode: "IL",
    urlPrefix: "IL/Chicago",
    regions: [
      "Loop",
      "South Loop",
      "West Loop",
      "River North",
      "Gold Coast",
      "Streeterville",
      "Old Town",
      "Lincoln Park",
      "Lakeview",
      "Wicker Park",
      "Bucktown",
      "Logan Square",
      "Humboldt Park",
      "Avondale",
      "Lincoln Square",
      "Uptown",
      "Edgewater",
      "Rogers Park",
      "Hyde Park",
      "Bronzeville",
      "Woodlawn",
      "South Shore",
      "Chatham",
      "Englewood",
      "Auburn Gresham",
      "Beverly",
      "Pilsen",
      "Bridgeport",
      "Chinatown",
      "Back of the Yards",
      "Brighton Park",
      "Austin",
      "Garfield Park",
      "North Lawndale",
      "Irving Park",
      "Portage Park",
      "Jefferson Park",
      "Belmont Cragin",
      "South Chicago",
      "Roseland",
    ],
    parcelIdField: "pin",
    regionLabel: "Neighborhood",
    heroImage: "/chicago-skyline.webp",
    center: { lat: 41.8781, lng: -87.6298 },
    zoom: 11,
    crimeSource: "CPD",
    crimeAreas: [
      "1st (Central)",
      "2nd (Wentworth)",
      "3rd (Grand Crossing)",
      "4th (South Chicago)",
      "5th (Calumet)",
      "6th (Gresham)",
      "7th (Englewood)",
      "8th (Chicago Lawn)",
      "9th (Deering)",
      "10th (Ogden)",
      "11th (Harrison)",
      "12th (Near West)",
      "14th (Shakespeare)",
      "15th (Austin)",
      "16th (Jefferson Park)",
      "17th (Albany Park)",
      "18th (Near North)",
      "19th (Town Hall)",
      "20th (Lincoln)",
      "22nd (Morgan Park)",
      "24th (Rogers Park)",
      "25th (Grand Central)",
    ],
  },
  miami: {
    name: "Miami",
    fullName: "Miami",
    state: "Florida",
    stateCode: "FL",
    urlPrefix: "FL/Miami",
    regions: [
      "Brickell",
      "Downtown Miami",
      "Wynwood",
      "Edgewater",
      "Midtown",
      "Miami Beach",
      "South Beach",
      "North Beach",
      "Coconut Grove",
      "Coral Gables",
      "Little Havana",
      "Little Haiti",
      "Allapattah",
      "Overtown",
      "Design District",
      "Upper East Side",
      "Morningside",
      "Doral",
      "Kendall",
      "Hialeah",
      "Aventura",
      "Sunny Isles Beach",
      "Coral Way",
      "Flagami",
      "Key Biscayne",
      "North Miami",
      "Palmetto Bay",
      "Pinecrest",
      "Cutler Bay",
      "Miami Gardens",
      "Sweetwater",
      "Surfside",
      "Bal Harbour",
      "West Kendall",
      "Fontainebleau",
      "Liberty City",
    ],
    parcelIdField: "folio",
    regionLabel: "Neighborhood",
    heroImage: "/miami-skyline.jpg",
    center: { lat: 25.7617, lng: -80.1918 },
    zoom: 11,
    crimeSource: "MDPD",
    crimeAreas: [
      "Midwest",
      "North",
      "South",
      "Kendall",
      "Intracoastal",
      "Northside",
      "Hammocks",
      "Airport",
    ],
  },
};

/** URL prefix → internal city key mapping for middleware rewrites */
export const URL_PREFIX_TO_CITY: Record<string, City> = {};
for (const [key, meta] of Object.entries(CITY_META)) {
  URL_PREFIX_TO_CITY[meta.urlPrefix.toLowerCase()] = key as City;
}

/** State code → city slug mapping for multi-segment URL detection */
export const STATE_CITY_MAP: Record<string, Record<string, City>> = {
  CA: { "Los-Angeles": "los-angeles" },
  IL: { Chicago: "chicago" },
  FL: { Miami: "miami" },
};

export function isValidCity(s: string): s is City {
  return VALID_CITIES.includes(s as City);
}

/** Get the display name for a city */
export function getCityName(city: City): string {
  return CITY_META[city].fullName;
}
