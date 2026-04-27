export interface ShedRow {
  house_no: string;
  street_name: string;
  borough: string;
  zip_code: string;
  permit_count: number;
  first_issued: string;
  latest_issued: string;
  total_days: number;
  active_permits: number;
  owner_business_name: string | null;
}

export interface ZipShedRow {
  zip_code: string;
  borough: string;
  shed_count: number;
}

const BOROUGH_NAME: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  BRONX: "Bronx",
  "STATEN ISLAND": "Staten Island",
};

export function normalizeBorough(b: string): string {
  return BOROUGH_NAME[b.toUpperCase()] || b;
}

export function formatDuration(days: number): string {
  if (days < 0) return "—";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years >= 1 && months > 0) return `${years}y ${months}mo`;
  if (years >= 1) return `${years}y`;
  if (months > 0) return `${months}mo`;
  return `${days}d`;
}

export function mapsHref(s: ShedRow): string {
  const q = `${s.house_no} ${s.street_name}, ${normalizeBorough(s.borough)}, NY ${s.zip_code}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
