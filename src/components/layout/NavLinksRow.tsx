"use client";

import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";
import { useCityFromPath } from "@/lib/city-context";
import { NavDropdown } from "./NavDropdown";

export function NavLinksRow({ city: propCity }: { city: City }) {
  // Root layout is cached across client navigations — use the live pathname
  // so all nav links always route to the city the user is currently viewing.
  const pathCity = useCityFromPath();
  const city: City = pathCity ?? propCity;
  const prefix = CITY_META[city].urlPrefix;

  return (
    <div className="nav-links">
      <Link href={`/${prefix}/worst-rated-buildings`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Rankings
      </Link>
      <Link href={`/${prefix}/landlords`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Landlords
      </Link>
      <Link href={`/${prefix}/neighborhoods`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Neighborhoods
      </Link>
      <NavDropdown city={city} />
      <Link href={`/${prefix}/review/new`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Write Review
      </Link>
    </div>
  );
}
