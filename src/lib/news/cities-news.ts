import type { City } from "@/lib/cities";

export type SignalType =
  | "rent-trend"
  | "violation-spike"
  | "new-top-rated"
  | "new-construction"
  | "neighborhood-feature";

export interface CityNewsConfig {
  /** IANA timezone (used to interpret "today" when detectors run). */
  tz: string;
  /** Tone/voice guide sent to Claude as part of the city prompt. */
  voice: string;
  /** Agency names this city cites — keep the model using local terminology. */
  agencies: string[];
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
      "rent-trend",
      "violation-spike",
      "new-top-rated",
      "new-construction",
      "neighborhood-feature",
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
      "rent-trend",
      "violation-spike",
      "new-top-rated",
      "new-construction",
      "neighborhood-feature",
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
      "rent-trend",
      "violation-spike",
      "new-top-rated",
      "new-construction",
      "neighborhood-feature",
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
      "rent-trend",
      "violation-spike",
      "new-top-rated",
      "new-construction",
      "neighborhood-feature",
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
      "rent-trend",
      "new-top-rated",
      "new-construction",
      "neighborhood-feature",
    ],
    thresholds: {
      rent_delta_pct: 1.5,
      listings_min: 40,
      violations_spike_n: 3,
      new_construction_units_min: 25,
    },
  },
};
