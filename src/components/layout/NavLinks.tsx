"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, PenSquare, AlertTriangle, Users, Radio, Siren, Newspaper } from "lucide-react";
import { type City, VALID_CITIES, CITY_META, DEFAULT_CITY } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { NavDropdown } from "./NavDropdown";

/** Derive the current city from the URL pathname. */
function cityFromPathname(pathname: string): City {
  for (const c of VALID_CITIES) {
    const prefix = `/${CITY_META[c].urlPrefix}`;
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return c;
    }
  }
  return DEFAULT_CITY;
}

export function NavLinks() {
  const pathname = usePathname();
  const city = cityFromPathname(pathname);

  return (
    <div className="hidden md:flex items-center gap-6">
      <Link
        href={cityPath("/search", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Search className="w-4 h-4" />
        Search
      </Link>
      <Link
        href={cityPath("/worst-rated-buildings", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        Worst Buildings
      </Link>
      <Link
        href={cityPath("/landlords", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Users className="w-4 h-4" />
        Landlords
      </Link>
      <Link
        href={cityPath("/crime", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Siren className="w-4 h-4" />
        Crime
      </Link>
      <Link
        href={cityPath("/feed", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Radio className="w-4 h-4" />
        Feed
      </Link>
      <Link
        href={cityPath("/news", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Newspaper className="w-4 h-4" />
        News
      </Link>
      <NavDropdown city={city} />
      <Link
        href={cityPath("/review/new", city)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <PenSquare className="w-4 h-4" />
        Submit Review
      </Link>
    </div>
  );
}
