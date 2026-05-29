import type { City } from "@/lib/cities";

export type SignalType =
  // Neighborhood & rent intelligence
  | "rent-trend"
  | "hood-rent-rank"
  | "hood-quality-rank"
  | "hood-value-pick"
  | "neighborhood-feature"
  // Building spotlights
  | "new-top-rated"
  | "building-most-reviewed"
  | "building-stabilized-gem"
  | "building-cautionary"
  | "best-of-month"
  // Landlord profiles
  | "violation-spike"
  | "landlord-watchlist"
  | "landlord-good-actor"
  | "landlord-eviction-heavy"
  // City-wide market reports
  | "new-construction"
  | "eviction-trend"
  | "permit-trend"
  | "listings-trend"
  | "city-violation-leaderboard"
  | "city-value-buildings"
  | "milestone-count"
  // Seasonal & risk
  | "heat-season-kickoff"
  | "hurricane-watch"
  | "wildfire-impact"
  // Guides / explainers (low-score, always-available fallbacks)
  | "explainer-class-c"
  | "explainer-rent-stab"
  | "explainer-lucidiq"
  | "explainer-notice-rights"
  | "explainer-file-complaint"
  | "guide-red-flags"
  | "guide-deposit-rights";

/** Story families — the selector enforces variety by drawing the day's two
 *  articles from different families. */
export type SignalFamily =
  | "neighborhood"
  | "building"
  | "landlord"
  | "city"
  | "seasonal"
  | "guide";

export const SIGNAL_FAMILY: Record<SignalType, SignalFamily> = {
  "rent-trend": "neighborhood",
  "hood-rent-rank": "neighborhood",
  "hood-quality-rank": "neighborhood",
  "hood-value-pick": "neighborhood",
  "neighborhood-feature": "neighborhood",
  "new-top-rated": "building",
  "building-most-reviewed": "building",
  "building-stabilized-gem": "building",
  "building-cautionary": "building",
  "best-of-month": "building",
  "violation-spike": "landlord",
  "landlord-watchlist": "landlord",
  "landlord-good-actor": "landlord",
  "landlord-eviction-heavy": "landlord",
  "new-construction": "city",
  "eviction-trend": "city",
  "permit-trend": "city",
  "listings-trend": "city",
  "city-violation-leaderboard": "city",
  "city-value-buildings": "city",
  "milestone-count": "city",
  "heat-season-kickoff": "seasonal",
  "hurricane-watch": "seasonal",
  "wildfire-impact": "seasonal",
  "explainer-class-c": "guide",
  "explainer-rent-stab": "guide",
  "explainer-lucidiq": "guide",
  "explainer-notice-rights": "guide",
  "explainer-file-complaint": "guide",
  "guide-red-flags": "guide",
  "guide-deposit-rights": "guide",
};

export interface CityNewsConfig {
  /** IANA timezone (used to interpret "today" when detectors run). */
  tz: string;
  /** Tone/voice guide sent to Claude as part of the city prompt. */
  voice: string;
  /** Agency names this city cites — keep the model using local terminology. */
  agencies: string[];
  /**
   * Authoritative .gov / official open-data sources the drafter can cite as
   * external links. The model weaves 1–2 in as markdown anchors backing a data
   * claim. Use stable official homepages/portals only — a dead link hurts
   * E-E-A-T more than no link.
   */
  authoritative_sources: { label: string; url: string }[];
  /** Real outlets we write next to. Used to calibrate tone in the prompt. */
  comparable_outlets: string[];
  /** Neighborhoods the reader recognizes; used for context and fallback topics. */
  landmark_neighborhoods: string[];
  /** Detectors that should run for this city. */
  templates: SignalType[];
  /** Per-city noise floors so detectors emit only real stories. */
  thresholds: {
    rent_delta_pct: number;
    listings_min: number;
    violations_spike_n: number;
    new_construction_units_min: number;
  };
}

export const CITY_NEWS_CONFIG: Record<City, CityNewsConfig> = {
  nyc: {
    tz: "America/New_York",
    voice:
      "Crain's NY / The Real Deal / Curbed — fast, insider, data-dense. Short declarative sentences. Never speculate past the data.",
    agencies: [
      "HPD",
      "DHCR",
      "DOB",
      "DOF",
      "NYC 311",
      "NY Housing Court",
      "ACRIS",
    ],
    authoritative_sources: [
      { label: "NYC Dept. of Housing Preservation & Development", url: "https://www.nyc.gov/site/hpd/index.page" },
      { label: "NYC Open Data", url: "https://opendata.cityofnewyork.us/" },
      { label: "NYS Homes & Community Renewal (DHCR)", url: "https://hcr.ny.gov/" },
    ],
    comparable_outlets: [
      "Crain's NY",
      "The Real Deal",
      "Curbed",
      "Brick Underground",
      "Gothamist",
    ],
    landmark_neighborhoods: [
      "Williamsburg",
      "Park Slope",
      "Astoria",
      "Upper East Side",
      "Bushwick",
      "Harlem",
      "Long Island City",
      "DUMBO",
    ],
    templates: [
      "rent-trend", "hood-rent-rank", "hood-quality-rank", "hood-value-pick", "neighborhood-feature",
      "new-top-rated", "building-most-reviewed", "building-stabilized-gem", "building-cautionary", "best-of-month",
      "violation-spike", "landlord-watchlist", "landlord-good-actor", "landlord-eviction-heavy",
      "new-construction", "permit-trend", "eviction-trend", "listings-trend",
      "city-violation-leaderboard", "city-value-buildings", "milestone-count",
      "heat-season-kickoff",
      "explainer-class-c", "explainer-rent-stab", "explainer-lucidiq", "explainer-notice-rights",
      "explainer-file-complaint", "guide-red-flags", "guide-deposit-rights",
    ],
    thresholds: {
      rent_delta_pct: 2.0,
      listings_min: 100,
      violations_spike_n: 5,
      new_construction_units_min: 40,
    },
  },
  "los-angeles": {
    tz: "America/Los_Angeles",
    voice:
      "LA Times / LAist — broader geography, civic-lens, RSO-aware. Plain English. Respect the region's sprawl.",
    agencies: ["LAHD", "LADBS", "REAP", "LAPD", "Rent Registry"],
    authoritative_sources: [
      { label: "LA Housing Department", url: "https://housing.lacity.gov/" },
      { label: "LA Dept. of Building & Safety", url: "https://www.ladbs.org/" },
      { label: "LA City Open Data", url: "https://data.lacity.org/" },
    ],
    comparable_outlets: ["LA Times", "LAist", "LA Daily News", "The Real Deal LA"],
    landmark_neighborhoods: [
      "Koreatown",
      "Venice",
      "Silver Lake",
      "West Hollywood",
      "Hollywood",
      "Echo Park",
      "Downtown LA",
      "Mid-Wilshire",
    ],
    templates: [
      "rent-trend", "hood-rent-rank", "hood-quality-rank", "hood-value-pick", "neighborhood-feature",
      "new-top-rated", "building-most-reviewed", "building-stabilized-gem", "building-cautionary", "best-of-month",
      "violation-spike", "landlord-watchlist", "landlord-good-actor", "landlord-eviction-heavy",
      "eviction-trend", "listings-trend", "city-violation-leaderboard", "city-value-buildings", "milestone-count",
      "wildfire-impact",
      "explainer-rent-stab", "explainer-lucidiq", "explainer-notice-rights",
      "explainer-file-complaint", "guide-red-flags", "guide-deposit-rights",
    ],
    thresholds: {
      rent_delta_pct: 2.0,
      listings_min: 80,
      violations_spike_n: 4,
      new_construction_units_min: 30,
    },
  },
  chicago: {
    tz: "America/Chicago",
    voice:
      "Crain's Chicago / Block Club — ward- and community-lens. Concrete. Neighbors know each other here.",
    agencies: [
      "CBS",
      "RLTO enforcement",
      "Chicago PD",
      "City Scavenger",
      "Cook County",
    ],
    authoritative_sources: [
      { label: "City of Chicago Dept. of Buildings", url: "https://www.chicago.gov/city/en/depts/bldgs.html" },
      { label: "Chicago Data Portal", url: "https://data.cityofchicago.org/" },
      { label: "Cook County Assessor", url: "https://www.cookcountyassessor.com/" },
    ],
    comparable_outlets: [
      "Crain's Chicago",
      "Block Club Chicago",
      "Chicago Tribune",
      "Sun-Times",
    ],
    landmark_neighborhoods: [
      "Lincoln Park",
      "Lakeview",
      "Logan Square",
      "Wicker Park",
      "West Loop",
      "Fulton Market",
      "Hyde Park",
      "The Loop",
    ],
    templates: [
      "rent-trend", "hood-rent-rank", "hood-quality-rank", "hood-value-pick", "neighborhood-feature",
      "new-top-rated", "building-most-reviewed", "building-stabilized-gem", "building-cautionary", "best-of-month",
      "violation-spike", "landlord-watchlist", "landlord-good-actor", "landlord-eviction-heavy",
      "listings-trend", "city-violation-leaderboard", "city-value-buildings", "milestone-count",
      "heat-season-kickoff",
      "explainer-lucidiq", "explainer-notice-rights", "explainer-file-complaint",
      "guide-red-flags", "guide-deposit-rights",
    ],
    thresholds: {
      rent_delta_pct: 1.5,
      listings_min: 60,
      violations_spike_n: 3,
      new_construction_units_min: 25,
    },
  },
  miami: {
    tz: "America/New_York",
    voice:
      "Miami Herald / The Real Deal Miami — hot-market, luxury-adjacent, post-Surfside vigilance about older buildings.",
    agencies: ["Miami-Dade Code", "40-year recert", "MRC", "Miami Building Dept"],
    authoritative_sources: [
      { label: "Miami-Dade County Building Dept.", url: "https://www.miamidade.gov/global/economy/building/home.page" },
      { label: "Miami-Dade Open Data Hub", url: "https://gis-mdc.opendata.arcgis.com/" },
      { label: "Miami-Dade Property Appraiser", url: "https://www.miamidade.gov/pa/" },
    ],
    comparable_outlets: [
      "Miami Herald",
      "The Real Deal Miami",
      "Miami New Times",
    ],
    landmark_neighborhoods: [
      "Brickell",
      "South Beach",
      "Wynwood",
      "Coral Gables",
      "Coconut Grove",
      "Edgewater",
      "Downtown",
    ],
    templates: [
      "rent-trend", "hood-rent-rank", "hood-quality-rank", "hood-value-pick", "neighborhood-feature",
      "new-top-rated", "building-most-reviewed", "building-stabilized-gem", "building-cautionary", "best-of-month",
      "violation-spike", "landlord-watchlist", "landlord-good-actor", "landlord-eviction-heavy",
      "listings-trend", "city-violation-leaderboard", "city-value-buildings", "milestone-count",
      "hurricane-watch",
      "explainer-lucidiq", "explainer-notice-rights", "explainer-file-complaint",
      "guide-red-flags", "guide-deposit-rights",
    ],
    thresholds: {
      rent_delta_pct: 1.5,
      listings_min: 50,
      violations_spike_n: 3,
      new_construction_units_min: 30,
    },
  },
  houston: {
    tz: "America/Chicago",
    voice:
      "Houston Chronicle / Houston Business Journal — Sun Belt growth, Texas landlord-tenant, sprawling metro.",
    agencies: ["Harris County Code", "HCAD", "City of Houston Permits"],
    authoritative_sources: [
      { label: "Houston Permitting Center", url: "https://www.houstonpermittingcenter.org/" },
      { label: "Harris Central Appraisal District", url: "https://hcad.org/" },
      { label: "City of Houston Open Data", url: "https://cohgis-mycity.opendata.arcgis.com/" },
    ],
    comparable_outlets: [
      "Houston Chronicle",
      "Houston Business Journal",
      "Houston Public Media",
    ],
    landmark_neighborhoods: [
      "The Heights",
      "Montrose",
      "Museum District",
      "Downtown",
      "Midtown",
      "Uptown",
      "River Oaks",
      "EaDo",
    ],
    templates: [
      "rent-trend", "hood-rent-rank", "hood-quality-rank", "hood-value-pick", "neighborhood-feature",
      "new-top-rated", "building-most-reviewed", "building-stabilized-gem", "building-cautionary", "best-of-month",
      "violation-spike", "landlord-watchlist", "landlord-good-actor", "landlord-eviction-heavy",
      "listings-trend", "city-violation-leaderboard", "city-value-buildings", "milestone-count",
      "explainer-lucidiq", "explainer-notice-rights", "explainer-file-complaint",
      "guide-red-flags", "guide-deposit-rights",
    ],
    thresholds: {
      rent_delta_pct: 1.5,
      listings_min: 40,
      violations_spike_n: 3,
      new_construction_units_min: 25,
    },
  },
};
