/* Shared mock data across the 4 building-rankings style mockups. Realistic
   NYC building-level numbers (sourced from the live building-rankings
   queries plus per-unit ratios, evictions, lawsuits, ratings, and LucidIQ
   composite scores). Used so the mockups feel believable without a live
   data wire. */

export type MockBuilding = {
  rank: number;
  address: string;
  city: string;
  zip: string;
  borough: string;
  units: number;
  yearBuilt: number;
  ownerName: string;
  violations: number;
  complaints: number;
  evictions: number;
  lawsuits: number;
  noHeatComplaints: number; // NYC-specific
  rodentComplaints: number; // NYC-specific (DOHMH)
  moldViolations: number;
  lucidIQ: number; // 0-100, lower = worse
  rating: number; // tenant reviews 0-5
  reviewCount: number;
  perUnit: number; // violations / units, size-normalized
  preForeclosure: boolean;
  ownershipFlips: number; // transfers in last 5 years
};

// Hall of worst — top 6 by total open violations. Real NYC addresses
// from the top-violations buildings query, enriched with realistic
// per-building metrics. perUnit calculated from violations/units.
export const HALL_OF_WORST: MockBuilding[] = [
  {
    rank: 1,
    address: "765 LINCOLN AVENUE",
    city: "Brooklyn",
    zip: "11208",
    borough: "Brooklyn",
    units: 1525,
    yearBuilt: 1973,
    ownerName: "LINDEN PLAZA HOUSING CO., INC.",
    violations: 14374,
    complaints: 9420,
    evictions: 87,
    lawsuits: 142,
    noHeatComplaints: 1842,
    rodentComplaints: 218,
    moldViolations: 412,
    lucidIQ: 12,
    rating: 1.4,
    reviewCount: 89,
    perUnit: 9.43,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 2,
    address: "14 METROPOLITAN OVAL",
    city: "Bronx",
    zip: "10462",
    borough: "Bronx",
    units: 1268,
    yearBuilt: 1942,
    ownerName: "PARKCHESTER SOUTH CONDOMINIUM ASSOC",
    violations: 4064,
    complaints: 3211,
    evictions: 41,
    lawsuits: 88,
    noHeatComplaints: 612,
    rodentComplaints: 96,
    moldViolations: 178,
    lucidIQ: 22,
    rating: 1.9,
    reviewCount: 64,
    perUnit: 3.21,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 3,
    address: "1368 NEW YORK AVENUE",
    city: "Brooklyn",
    zip: "11210",
    borough: "Brooklyn",
    units: 1144,
    yearBuilt: 1949,
    ownerName: "FLATBUSH GARDENS HDFC",
    violations: 3695,
    complaints: 2188,
    evictions: 56,
    lawsuits: 173,
    noHeatComplaints: 521,
    rodentComplaints: 88,
    moldViolations: 144,
    lucidIQ: 18,
    rating: 1.6,
    reviewCount: 112,
    perUnit: 3.23,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 4,
    address: "600 CONCORD AVENUE",
    city: "Bronx",
    zip: "10455",
    borough: "Bronx",
    units: 296,
    yearBuilt: 1958,
    ownerName: "SENIOR LIVING OPTIONS, INC.",
    violations: 1768,
    complaints: 1092,
    evictions: 18,
    lawsuits: 41,
    noHeatComplaints: 246,
    rodentComplaints: 52,
    moldViolations: 88,
    lucidIQ: 21,
    rating: 1.8,
    reviewCount: 27,
    perUnit: 5.97,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 5,
    address: "2344 DAVIDSON AVENUE",
    city: "Bronx",
    zip: "10468",
    borough: "Bronx",
    units: 188,
    yearBuilt: 1929,
    ownerName: "NEIGHBORHOOD RENEWAL HDFC",
    violations: 1419,
    complaints: 686,
    evictions: 22,
    lawsuits: 58,
    noHeatComplaints: 198,
    rodentComplaints: 41,
    moldViolations: 67,
    lucidIQ: 24,
    rating: 2.0,
    reviewCount: 19,
    perUnit: 7.55,
    preForeclosure: true,
    ownershipFlips: 2,
  },
  {
    rank: 6,
    address: "150-18 72 DRIVE",
    city: "Queens",
    zip: "11367",
    borough: "Queens",
    units: 412,
    yearBuilt: 1965,
    ownerName: "KEW GARDENS HILLS, LLC",
    violations: 913,
    complaints: 388,
    evictions: 14,
    lawsuits: 92,
    noHeatComplaints: 124,
    rodentComplaints: 28,
    moldViolations: 31,
    lucidIQ: 31,
    rating: 2.3,
    reviewCount: 41,
    perUnit: 2.22,
    preForeclosure: false,
    ownershipFlips: 1,
  },
];

// Tenant-favorite buildings (best side) — for the "best" mosaic
export const HALL_OF_BEST: MockBuilding[] = [
  {
    rank: 1,
    address: "1 IRVING PLACE",
    city: "Manhattan",
    zip: "10003",
    borough: "Manhattan",
    units: 432,
    yearBuilt: 2009,
    ownerName: "ZECKENDORF DEVELOPMENT",
    violations: 8,
    complaints: 24,
    evictions: 1,
    lawsuits: 2,
    noHeatComplaints: 4,
    rodentComplaints: 0,
    moldViolations: 0,
    lucidIQ: 96,
    rating: 4.8,
    reviewCount: 247,
    perUnit: 0.02,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 2,
    address: "200 EAST 79TH STREET",
    city: "Manhattan",
    zip: "10075",
    borough: "Manhattan",
    units: 168,
    yearBuilt: 2014,
    ownerName: "RELATED COMPANIES",
    violations: 4,
    complaints: 12,
    evictions: 0,
    lawsuits: 1,
    noHeatComplaints: 2,
    rodentComplaints: 0,
    moldViolations: 0,
    lucidIQ: 94,
    rating: 4.7,
    reviewCount: 138,
    perUnit: 0.02,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 3,
    address: "10 RIVERSIDE BOULEVARD",
    city: "Manhattan",
    zip: "10069",
    borough: "Manhattan",
    units: 264,
    yearBuilt: 2017,
    ownerName: "EXTELL DEVELOPMENT",
    violations: 6,
    complaints: 18,
    evictions: 0,
    lawsuits: 3,
    noHeatComplaints: 1,
    rodentComplaints: 0,
    moldViolations: 0,
    lucidIQ: 93,
    rating: 4.6,
    reviewCount: 192,
    perUnit: 0.02,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 4,
    address: "525 WEST 52ND STREET",
    city: "Manhattan",
    zip: "10019",
    borough: "Manhattan",
    units: 392,
    yearBuilt: 2014,
    ownerName: "TACONIC INVESTMENT PARTNERS",
    violations: 14,
    complaints: 31,
    evictions: 1,
    lawsuits: 4,
    noHeatComplaints: 6,
    rodentComplaints: 1,
    moldViolations: 0,
    lucidIQ: 91,
    rating: 4.6,
    reviewCount: 211,
    perUnit: 0.04,
    preForeclosure: false,
    ownershipFlips: 0,
  },
  {
    rank: 5,
    address: "30 PARK PLACE",
    city: "Manhattan",
    zip: "10007",
    borough: "Manhattan",
    units: 157,
    yearBuilt: 2016,
    ownerName: "SILVERSTEIN PROPERTIES",
    violations: 5,
    complaints: 14,
    evictions: 0,
    lawsuits: 0,
    noHeatComplaints: 2,
    rodentComplaints: 0,
    moldViolations: 0,
    lucidIQ: 95,
    rating: 4.7,
    reviewCount: 98,
    perUnit: 0.03,
    preForeclosure: false,
    ownershipFlips: 0,
  },
];

// 6 ranking lenses — each top-3 short list. Iterated beyond the original
// page's 2 sort options (violations / complaints). NYC-specific lenses
// (no-heat) noted; cross-metro stays visible.
export type RankingStrip = {
  id: string;
  label: string;
  description: string;
  unit: string;
  metroOnly?: "nyc";
  top3: { address: string; sub: string; value: number; suffix?: string }[];
};

export const RANKING_STRIPS: RankingStrip[] = [
  {
    id: "by-violations",
    label: "Most violations on record",
    description: "Total open HPD/DOB violations citywide",
    unit: "viol",
    top3: [
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 14374 },
      { address: "14 METROPOLITAN OVAL", sub: "Bronx · 1,268 units", value: 4064 },
      { address: "1368 NEW YORK AVENUE", sub: "Brooklyn · 1,144 units", value: 3695 },
    ],
  },
  {
    id: "by-complaints",
    label: "Most 311 complaints",
    description: "Quality-of-life and habitability calls",
    unit: "calls",
    top3: [
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 9420 },
      { address: "14 METROPOLITAN OVAL", sub: "Bronx · 1,268 units", value: 3211 },
      { address: "1368 NEW YORK AVENUE", sub: "Brooklyn · 1,144 units", value: 2188 },
    ],
  },
  {
    id: "by-evictions",
    label: "Most evictions filed",
    description: "Housing court filings, last 12 months",
    unit: "filings",
    top3: [
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 87 },
      { address: "1368 NEW YORK AVENUE", sub: "Brooklyn · 1,144 units", value: 56 },
      { address: "14 METROPOLITAN OVAL", sub: "Bronx · 1,268 units", value: 41 },
    ],
  },
  {
    id: "by-per-unit",
    label: "Worst per-unit ratio",
    description: "Violations divided by total units (size-normalized)",
    unit: "viol/unit",
    top3: [
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 9.43 },
      { address: "2344 DAVIDSON AVENUE", sub: "Bronx · 188 units", value: 7.55 },
      { address: "600 CONCORD AVENUE", sub: "Bronx · 296 units", value: 5.97 },
    ],
  },
  {
    id: "by-lawsuits",
    label: "Most active lawsuits",
    description: "Open housing court cases against the building",
    unit: "cases",
    top3: [
      { address: "1368 NEW YORK AVENUE", sub: "Brooklyn · 1,144 units", value: 173 },
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 142 },
      { address: "150-18 72 DRIVE", sub: "Queens · 412 units", value: 92 },
    ],
  },
  {
    id: "by-no-heat",
    label: "Most no-heat complaints",
    description: "311 heat / hot water failures, last winter",
    unit: "calls",
    metroOnly: "nyc",
    top3: [
      { address: "765 LINCOLN AVENUE", sub: "Brooklyn · 1,525 units", value: 1842 },
      { address: "14 METROPOLITAN OVAL", sub: "Bronx · 1,268 units", value: 612 },
      { address: "1368 NEW YORK AVENUE", sub: "Brooklyn · 1,144 units", value: 521 },
    ],
  },
];

export const CITY_TOTALS = {
  buildings: 925000,
  buildingsWithViolations: 218400,
  totalViolations: 4400000,
  totalComplaints: 503221,
  evictionsLastYear: 21683,
  ratedBuildings: 11842,
  avgLucidIQ: 68,
};

// "Striking fact" pull quote for stats bento
export const PULL_QUOTE = {
  text: "765 Lincoln Avenue carries more open violations",
  emphasis: "than the entire city of Houston.",
  context: "14,374 vs Houston's 9,820 citywide",
  source: "Linden Plaza, Brooklyn · NO. 01 in the index",
};

// Borough breakdown — top 3 per borough by total violations
export const BOROUGH_BREAKDOWN = [
  {
    name: "Brooklyn",
    buildings: 287_400,
    violations: 1_842_000,
    top3: [
      { address: "765 LINCOLN AVENUE", value: 14374, sub: "1,525 units" },
      { address: "1368 NEW YORK AVENUE", value: 3695, sub: "1,144 units" },
      { address: "418 OCEAN AVENUE", value: 2841, sub: "612 units" },
    ],
  },
  {
    name: "Bronx",
    buildings: 198_200,
    violations: 1_412_000,
    top3: [
      { address: "14 METROPOLITAN OVAL", value: 4064, sub: "1,268 units" },
      { address: "600 CONCORD AVENUE", value: 1768, sub: "296 units" },
      { address: "2344 DAVIDSON AVENUE", value: 1419, sub: "188 units" },
    ],
  },
  {
    name: "Manhattan",
    buildings: 156_800,
    violations: 612_000,
    top3: [
      { address: "555 W 174 ST", value: 2218, sub: "412 units" },
      { address: "145 W 145 ST", value: 1894, sub: "188 units" },
      { address: "320 EAST 117 ST", value: 1442, sub: "224 units" },
    ],
  },
  {
    name: "Queens",
    buildings: 226_400,
    violations: 488_000,
    top3: [
      { address: "150-18 72 DRIVE", value: 913, sub: "412 units" },
      { address: "100-13 ROCKAWAY BLVD", value: 824, sub: "278 units" },
      { address: "23-15 31 STREET", value: 691, sub: "144 units" },
    ],
  },
  {
    name: "Staten Island",
    buildings: 56_200,
    violations: 46_000,
    top3: [
      { address: "245 PARK HILL AVE", value: 412, sub: "188 units" },
      { address: "100 RICHMOND TERRACE", value: 308, sub: "92 units" },
      { address: "55 BAY ST", value: 247, sub: "64 units" },
    ],
  },
];

// Watchlist — pre-foreclosure + rapidly-deteriorating buildings
export type WatchlistEntry = {
  address: string;
  borough: string;
  units: number;
  reason: "pre-foreclosure" | "rising-violations" | "owner-flight" | "failed-inspection";
  reasonLabel: string;
  trend: number; // % change in last 90 days
  currentViolations: number;
  daysOnWatch: number;
  signal: "critical" | "high" | "elevated";
};

export const WATCHLIST: WatchlistEntry[] = [
  {
    address: "2344 DAVIDSON AVENUE",
    borough: "Bronx",
    units: 188,
    reason: "pre-foreclosure",
    reasonLabel: "Pre-foreclosure · LIS PENDENS filed",
    trend: 38,
    currentViolations: 1419,
    daysOnWatch: 47,
    signal: "critical",
  },
  {
    address: "1872 GRAND CONCOURSE",
    borough: "Bronx",
    units: 142,
    reason: "rising-violations",
    reasonLabel: "Violations +268% in 90 days",
    trend: 268,
    currentViolations: 612,
    daysOnWatch: 12,
    signal: "critical",
  },
  {
    address: "418 OCEAN AVENUE",
    borough: "Brooklyn",
    units: 612,
    reason: "owner-flight",
    reasonLabel: "Owner missed 3 court dates",
    trend: 84,
    currentViolations: 2841,
    daysOnWatch: 28,
    signal: "high",
  },
  {
    address: "555 W 174 ST",
    borough: "Manhattan",
    units: 412,
    reason: "failed-inspection",
    reasonLabel: "Failed HPD inspection · 9/12",
    trend: 142,
    currentViolations: 2218,
    daysOnWatch: 8,
    signal: "high",
  },
  {
    address: "100-13 ROCKAWAY BLVD",
    borough: "Queens",
    units: 278,
    reason: "rising-violations",
    reasonLabel: "Violations +94% in 90 days",
    trend: 94,
    currentViolations: 824,
    daysOnWatch: 19,
    signal: "elevated",
  },
  {
    address: "320 EAST 117 ST",
    borough: "Manhattan",
    units: 224,
    reason: "pre-foreclosure",
    reasonLabel: "Pre-foreclosure · 60-day notice",
    trend: 22,
    currentViolations: 1442,
    daysOnWatch: 34,
    signal: "elevated",
  },
];

// Movers — most-improved (good news) + worst-deteriorating (bad news), 90-day delta
export type Mover = {
  address: string;
  borough: string;
  units: number;
  current: number; // current violations
  delta: number;   // change vs 90 days ago (signed)
  pct: number;     // % change
};

export const MOVERS: { improved: Mover[]; deteriorated: Mover[] } = {
  improved: [
    { address: "1500 GRAND CONCOURSE", borough: "Bronx", units: 412, current: 188, delta: -742, pct: -79.8 },
    { address: "888 KINGS HIGHWAY", borough: "Brooklyn", units: 268, current: 92, delta: -384, pct: -80.7 },
    { address: "245 EAST 124 ST", borough: "Manhattan", units: 156, current: 41, delta: -218, pct: -84.2 },
  ],
  deteriorated: [
    { address: "1872 GRAND CONCOURSE", borough: "Bronx", units: 142, current: 612, delta: 446, pct: 268.7 },
    { address: "555 W 174 ST", borough: "Manhattan", units: 412, current: 2218, delta: 1302, pct: 142.1 },
    { address: "100-13 ROCKAWAY BLVD", borough: "Queens", units: 278, current: 824, delta: 400, pct: 94.3 },
  ],
};

// By era — top "worst" building per construction era
export type EraEntry = {
  era: string;
  range: string;
  buildings: number;
  topAddress: string;
  topBorough: string;
  topUnits: number;
  topYear: number;
  topViolations: number;
  /** Real DB slug — only resolves on /nyc/, used to deep-link the card */
  topSlug: string;
};

export const BY_ERA: EraEntry[] = [
  {
    era: "Pre-war",
    range: "1900–1945",
    buildings: 142_000,
    topAddress: "2344 DAVIDSON AVENUE",
    topBorough: "Bronx",
    topUnits: 188,
    topYear: 1929,
    topViolations: 1419,
    topSlug: "2344-davidson-avenue-bronx-ny-10468",
  },
  {
    era: "Mid-century",
    range: "1946–1975",
    buildings: 318_000,
    topAddress: "765 LINCOLN AVENUE",
    topBorough: "Brooklyn",
    topUnits: 1525,
    topYear: 1973,
    topViolations: 14374,
    topSlug: "765-lincoln-avenue-brooklyn-ny-11208",
  },
  {
    era: "Modern",
    range: "1976–2000",
    buildings: 248_000,
    topAddress: "150-18 72 DRIVE",
    topBorough: "Queens",
    topUnits: 412,
    topYear: 1981,
    topViolations: 913,
    topSlug: "150-18-72-drive-queens-ny-11367",
  },
  {
    era: "Luxury",
    range: "2001+",
    buildings: 217_000,
    topAddress: "525 WEST 52ND STREET",
    topBorough: "Manhattan",
    topUnits: 392,
    topYear: 2014,
    topViolations: 14,
    topSlug: "525-west-52-street-manhattan-ny-10019",
  },
];

// By size — worst per building-size bucket
export type SizeEntry = {
  size: string;
  range: string;
  buildings: number;
  topAddress: string;
  topBorough: string;
  topUnits: number;
  topViolations: number;
  topPerUnit: number;
  /** Real DB slug — only resolves on /nyc/, used to deep-link the card */
  topSlug: string;
};

export const BY_SIZE: SizeEntry[] = [
  {
    size: "Micro",
    range: "<20 units",
    buildings: 412_000,
    topAddress: "1055 BERGEN STREET",
    topBorough: "Brooklyn",
    topUnits: 16,
    topViolations: 1366,
    topPerUnit: 85.38,
    topSlug: "1055-bergen-street-brooklyn-ny-11216",
  },
  {
    size: "Mid",
    range: "20–100 units",
    buildings: 388_000,
    topAddress: "2344 DAVIDSON AVENUE",
    topBorough: "Bronx",
    topUnits: 188,
    topViolations: 1419,
    topPerUnit: 7.55,
    topSlug: "2344-davidson-avenue-bronx-ny-10468",
  },
  {
    size: "Tower",
    range: "100+ units",
    buildings: 125_000,
    topAddress: "765 LINCOLN AVENUE",
    topBorough: "Brooklyn",
    topUnits: 1525,
    topViolations: 14374,
    topPerUnit: 9.43,
    topSlug: "765-lincoln-avenue-brooklyn-ny-11208",
  },
];

// Top 10 zip codes by violation density (violations per 1000 units)
export type ZipRow = {
  rank: number;
  zip: string;
  neighborhood: string;
  borough: string;
  buildings: number;
  violations: number;
  perKUnit: number; // violations per 1000 units
};

export const TOP_ZIPS: ZipRow[] = [
  { rank: 1,  zip: "11208", neighborhood: "East New York",      borough: "Brooklyn",  buildings: 4218, violations: 89432, perKUnit: 142 },
  { rank: 2,  zip: "10468", neighborhood: "University Heights", borough: "Bronx",     buildings: 2841, violations: 68214, perKUnit: 128 },
  { rank: 3,  zip: "10453", neighborhood: "Morris Heights",     borough: "Bronx",     buildings: 2218, violations: 54128, perKUnit: 119 },
  { rank: 4,  zip: "11212", neighborhood: "Brownsville",        borough: "Brooklyn",  buildings: 3104, violations: 62412, perKUnit: 114 },
  { rank: 5,  zip: "10455", neighborhood: "Mott Haven",         borough: "Bronx",     buildings: 1942, violations: 41218, perKUnit: 108 },
  { rank: 6,  zip: "11226", neighborhood: "Flatbush",           borough: "Brooklyn",  buildings: 4842, violations: 88318, perKUnit: 102 },
  { rank: 7,  zip: "10031", neighborhood: "Hamilton Heights",   borough: "Manhattan", buildings: 1418, violations: 28412, perKUnit:  96 },
  { rank: 8,  zip: "11210", neighborhood: "Midwood",            borough: "Brooklyn",  buildings: 2218, violations: 38412, perKUnit:  91 },
  { rank: 9,  zip: "10039", neighborhood: "Harlem (West)",      borough: "Manhattan", buildings: 1218, violations: 21814, perKUnit:  88 },
  { rank: 10, zip: "11691", neighborhood: "Far Rockaway",       borough: "Queens",    buildings: 1814, violations: 28412, perKUnit:  84 },
];

// Complaint-category cloud — most-cited 311 reasons last 12 months
export type ComplaintCategory = {
  category: string;
  short: string;
  count: number;
  share: number; // % of all 311 calls
  size: "xl" | "lg" | "md" | "sm" | "xs"; // bento tile size
};

export const COMPLAINT_CLOUD: ComplaintCategory[] = [
  { category: "Heat / Hot Water", short: "Heat", count: 142839, share: 28.4, size: "xl" },
  { category: "Pests & Rodents", short: "Pests", count: 98421, share: 19.6, size: "lg" },
  { category: "Plumbing", short: "Plumbing", count: 64218, share: 12.8, size: "lg" },
  { category: "Mold / Mildew", short: "Mold", count: 41218, share: 8.2, size: "md" },
  { category: "Electrical", short: "Electric", count: 32842, share: 6.5, size: "md" },
  { category: "Doors & Windows", short: "Doors", count: 28412, share: 5.7, size: "md" },
  { category: "Paint / Plaster", short: "Paint", count: 24812, share: 4.9, size: "sm" },
  { category: "Floors / Stairs", short: "Floors", count: 18412, share: 3.7, size: "sm" },
  { category: "Garbage / Sanitation", short: "Trash", count: 16218, share: 3.2, size: "sm" },
  { category: "Lead Paint", short: "Lead", count: 12418, share: 2.5, size: "xs" },
  { category: "Smoke / Fire", short: "Fire", count: 9842, share: 2.0, size: "xs" },
  { category: "Lock / Security", short: "Locks", count: 8214, share: 1.6, size: "xs" },
  { category: "Cooking Gas", short: "Gas", count: 6841, share: 1.4, size: "xs" },
];
