const VIOLENT_KEYWORDS = [
  "MURDER",
  "HOMICIDE",
  "RAPE",
  "ROBBERY",
  "FELONY ASSAULT",
  "ASSAULT",
  "KIDNAPPING",
  "ARSON",
  "SEX CRIMES",
  "STRANGULATION",
  "WEAPONS",
];

const PROPERTY_KEYWORDS = [
  "BURGLARY",
  "GRAND LARCENY",
  "PETIT LARCENY",
  "LARCENY",
  "CRIMINAL MISCHIEF",
  "THEFT",
  "STOLEN PROPERTY",
  "FORGERY",
  "POSSESSION OF STOLEN",
  "AUTO",
  "VEHICLE AND TRAFFIC",
];

export type CrimeCategory = "violent" | "property" | "quality_of_life";

export function categorizeCrime(
  ofnsDesc: string | null | undefined
): CrimeCategory {
  if (!ofnsDesc) return "quality_of_life";
  const upper = ofnsDesc.toUpperCase();

  if (VIOLENT_KEYWORDS.some((v) => upper.includes(v))) return "violent";
  if (PROPERTY_KEYWORDS.some((p) => upper.includes(p))) return "property";
  return "quality_of_life";
}

export const CRIME_CATEGORY_LABELS: Record<CrimeCategory, string> = {
  violent: "Violent",
  property: "Property",
  quality_of_life: "Quality of Life",
};

export const CRIME_CATEGORY_COLORS: Record<CrimeCategory, string> = {
  violent: "#EF4444",
  property: "#F59E0B",
  quality_of_life: "#3B82F6",
};
