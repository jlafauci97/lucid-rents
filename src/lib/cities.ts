export type City = "nyc";

export const VALID_CITIES: City[] = ["nyc"];
export const DEFAULT_CITY: City = "nyc";

export const CITY_META: Record<
  City,
  { name: string; fullName: string; state: string }
> = {
  nyc: { name: "NYC", fullName: "New York City", state: "NY" },
};

export function isValidCity(s: string): s is City {
  return VALID_CITIES.includes(s as City);
}
