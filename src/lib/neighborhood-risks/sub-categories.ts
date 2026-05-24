import type { ConcernCategory, ConcernSubCategory } from "./types";

/** Display order of sub-categories within each section. */
export const SUB_CATEGORIES_BY_CATEGORY: Record<ConcernCategory, ConcernSubCategory[]> = {
  public_safety: [
    "homeless_shelter_adult",
    "migrant_reception",
    "methadone_clinic",
    "halfway_house",
    "supportive_housing",
    // sex_offender rendered separately via SensitiveBlock
  ],
  noise: ["sirens", "active_construction", "school", "elevated_rail", "highway", "avenue_traffic"],
  environmental: ["brownfield", "industrial_zone", "dsny_garage"],
  block_level: ["rat_failures", "noise_311", "bedbug_history"],
};

/** Human-readable title for each sub-category, used in block headers. */
export const SUB_CATEGORY_TITLES: Record<ConcernSubCategory, string> = {
  homeless_shelter_adult: "Homeless shelters",
  supportive_housing: "Supportive housing",
  migrant_reception: "Migrant reception centers",
  methadone_clinic: "Methadone / OASAS",
  halfway_house: "Halfway houses",
  sirens: "Sirens (FDNY · NYPD · ER)",
  active_construction: "Active construction",
  elevated_rail: "Elevated rail",
  highway: "Highway proximity",
  avenue_traffic: "Avenue traffic",
  school: "Schools",
  brownfield: "Industrial / brownfield",
  industrial_zone: "Industrial business zones",
  dsny_garage: "DSNY garages",
  rat_failures: "Rat sightings (12mo)",
  noise_311: "311 noise complaints (90d)",
  bedbug_history: "Bedbug history (3yr)",
  sex_offender: "Sex offender registry",
};

/** Default source attribution string for each sub-category. */
export const SUB_CATEGORY_SOURCES: Record<ConcernSubCategory, string> = {
  homeless_shelter_adult: "NYC DHS + advocacy directories",
  supportive_housing: "NYC HPD",
  migrant_reception: "NYC Mayor + city contracts",
  methadone_clinic: "NYS OASAS",
  halfway_house: "Federal BOP + NYS DOCCS",
  sirens: "FDNY · NYPD · DOHMH",
  active_construction: "NYC DOB",
  elevated_rail: "MTA · NYC LION",
  highway: "FHWA NHS",
  avenue_traffic: "Derived from building address",
  school: "NYC DOE",
  brownfield: "EPA + NYS DEC",
  industrial_zone: "NYC EDC IBZ",
  dsny_garage: "NYC DSNY",
  rat_failures: "NYC 311 — rat/rodent",
  noise_311: "NYC 311",
  bedbug_history: "NYC HPD bedbug filings",
  sex_offender: "NYS DCJS · Level 2/3",
};

/** Default unit label for the big count in each block. */
export const SUB_CATEGORY_UNITS: Record<ConcernSubCategory, string> = {
  homeless_shelter_adult: "sites",
  supportive_housing: "buildings",
  migrant_reception: "centers",
  methadone_clinic: "clinics",
  halfway_house: "houses",
  sirens: "sources",
  active_construction: "sites",
  elevated_rail: "segments",
  highway: "segments",
  avenue_traffic: "on-street",
  school: "schools",
  brownfield: "sites",
  industrial_zone: "zones",
  dsny_garage: "sites",
  rat_failures: "complaints",
  noise_311: "complaints",
  bedbug_history: "buildings",
  sex_offender: "registered",
};
