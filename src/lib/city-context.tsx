"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { type City, DEFAULT_CITY, VALID_CITIES, STATE_CITY_MAP } from "./cities";

const CityContext = createContext<City>(DEFAULT_CITY);

export function CityProvider({
  city,
  children,
}: {
  city: City;
  children: React.ReactNode;
}) {
  return <CityContext.Provider value={city}>{children}</CityContext.Provider>;
}

export function useCity(): City {
  return useContext(CityContext);
}

/**
 * Derive the current city from the URL pathname.
 *
 * Use this instead of useCity() in components rendered OUTSIDE
 * the CityProvider (e.g. the Navbar in the root layout).
 * The pathname always reflects the current route, even after
 * client-side navigation.
 */
export function useCityFromPath(): City {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const first = segments[1] || "";

  // Check single-segment city slug: /nyc/... or /los-angeles/...
  if (VALID_CITIES.includes(first as City)) {
    return first as City;
  }

  // Check multi-segment: /CA/Los-Angeles/...
  const stateMap = STATE_CITY_MAP[first.toUpperCase()];
  if (stateMap) {
    const citySlug = segments[2] || "";
    const city = stateMap[citySlug];
    if (city) return city;
  }

  return DEFAULT_CITY;
}
