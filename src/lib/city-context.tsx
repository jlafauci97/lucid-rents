"use client";

import { createContext, useContext } from "react";
import { type City, DEFAULT_CITY } from "./cities";

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
