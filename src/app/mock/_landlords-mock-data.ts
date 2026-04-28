/* Shared mock data across the 3 landlord-directory style mockups. Realistic
   NYC names + numbers (sourced from the actual landlord_stats top-violations
   query) so the mockups feel believable without needing a live data wire. */

export type MockLandlord = {
  rank: number;
  name: string;
  city: string;
  buildings: number;
  violations: number;
  complaints: number;
  litigations: number;
  dob: number;
  grade: string;
  worstAddr: string;
  worstViol: number;
  trend: number[]; // 12-week sparkline data
};

export const HALL_OF_SHAME: MockLandlord[] = [
  { rank: 1, name: "LINDEN PLAZA HOUSING CO., INC.",            city: "Brooklyn",  buildings: 2,  violations: 16028, complaints: 10075, litigations: 211, dob: 196,  grade: "D", worstAddr: "765 LINCOLN AVENUE, Brooklyn, NY 11208",   worstViol: 14374, trend: [12,11,13,15,14,16,18,17,19,21,22,24] },
  { rank: 2, name: "FLATBUSH GARDENS HOUSING DEVELOPMENT FUN D CORPORAT", city: "Brooklyn",  buildings: 6,  violations: 12268, complaints: 6606,  litigations: 449, dob: 1175, grade: "C", worstAddr: "1368 NEW YORK AVENUE, Brooklyn, NY 11210",  worstViol: 3695,  trend: [8,9,10,11,11,12,13,12,13,14,15,15] },
  { rank: 3, name: "NEIGHBORHOOD RENEWAL HOUSING DEVELOPMENT  FUND CORP", city: "Bronx",     buildings: 22, violations: 8502,  complaints: 2638,  litigations: 213, dob: 145,  grade: "C", worstAddr: "2344 DAVIDSON AVENUE, Bronx, NY, 10468",   worstViol: 1419,  trend: [6,6,7,8,8,9,10,10,9,11,12,11] },
  { rank: 4, name: "PARKCHESTER SOUTH CONDOMINIUM ASSOC",       city: "Bronx",     buildings: 4,  violations: 6859,  complaints: 9717,  litigations: 231, dob: 1341, grade: "B", worstAddr: "14 METROPOLITAN OVAL, Bronx, NY, 10462",    worstViol: 4064,  trend: [4,5,6,7,7,8,8,8,9,9,10,10] },
  { rank: 5, name: "SENIOR LIVING OPTIONS, INC.",                city: "Bronx",     buildings: 9,  violations: 6564,  complaints: 4162,  litigations: 163, dob: 220,  grade: "C", worstAddr: "600 CONCORD AVENUE, Bronx, NY, 10455",      worstViol: 1768,  trend: [4,5,5,6,7,7,7,8,8,8,9,9] },
  { rank: 6, name: "KEW GARDENS HILLS, LLC",                     city: "Queens",    buildings: 12, violations: 6510,  complaints: 1790,  litigations: 355, dob: 91,   grade: "C", worstAddr: "150-18 72 DRIVE, Queens, NY, 11367",       worstViol: 913,   trend: [3,4,4,5,5,6,6,7,7,8,8,9] },
];

export const RANKING_STRIPS = [
  {
    id: "by-violations",
    label: "Most violations on record",
    unit: "viol",
    top3: [
      { name: "LINDEN PLAZA HOUSING CO., INC.",                 value: 16028, sub: "2 bldg" },
      { name: "FLATBUSH GARDENS HOUSING DEVELOPMENT FUN…",      value: 12268, sub: "6 bldg" },
      { name: "NEIGHBORHOOD RENEWAL HOUSING DEVELOPMENT…",     value: 8502,  sub: "22 bldg" },
    ],
  },
  {
    id: "by-complaints",
    label: "Most 311 complaints",
    unit: "calls",
    top3: [
      { name: "LINDEN PLAZA HOUSING CO., INC.",            value: 10075, sub: "2 bldg" },
      { name: "PARKCHESTER SOUTH CONDOMINIUM ASSOC",      value: 9717,  sub: "4 bldg" },
      { name: "FLATBUSH GARDENS HOUSING DEVELOPMENT FUN…", value: 6606,  sub: "6 bldg" },
    ],
  },
  {
    id: "by-litigation",
    label: "Most open litigation",
    unit: "cases",
    top3: [
      { name: "FLATBUSH GARDENS HOUSING DEVELOPMENT FUN…", value: 449, sub: "6 bldg" },
      { name: "KEW GARDENS HILLS, LLC",                    value: 355, sub: "12 bldg" },
      { name: "PARKCHESTER SOUTH CONDOMINIUM ASSOC",      value: 231, sub: "4 bldg" },
    ],
  },
  {
    id: "by-dob",
    label: "Most DOB violations",
    unit: "DOB",
    top3: [
      { name: "PARKCHESTER SOUTH CONDOMINIUM ASSOC",       value: 1341, sub: "4 bldg" },
      { name: "FLATBUSH GARDENS HOUSING DEVELOPMENT FUN…", value: 1175, sub: "6 bldg" },
      { name: "BPP ST OWNER LLC",                          value: 1100, sub: "21 bldg" },
    ],
  },
  {
    id: "by-buildings",
    label: "Largest portfolios",
    unit: "bldg",
    top3: [
      { name: "UNAVAILABLE OWNER",                          value: 2933, sub: "—" },
      { name: "NYC DEPARTMENT OF PARKS AND RECREATION",    value: 2407, sub: "—" },
      { name: "NYC DEPARTMENT OF EDUCATION",                value: 2160, sub: "—" },
    ],
  },
];

export const CITY_TOTALS = {
  landlords: 644758,
  buildings: 925000,
  violations: 4400000,
  complaints: 503221,
  litigations: 13412,
};
