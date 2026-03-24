"use client";

import Link from "next/link";
import { Search, BarChart3, Users, Siren, Radio, Newspaper, PenSquare } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { useCityFromPath } from "@/lib/city-context";
import { NavDropdown } from "./NavDropdown";

export function NavLinks() {
  const city = useCityFromPath();

  return (
    <div className="hidden md:flex items-center gap-6">
      <Link
        href={cityPath("/search", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Search className="w-4 h-4" />
        Search
      </Link>
      <Link
        href={cityPath("/worst-rated-buildings", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <BarChart3 className="w-4 h-4" />
        Building Rankings
      </Link>
      <Link
        href={cityPath("/landlords", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Users className="w-4 h-4" />
        Landlords
      </Link>
      <Link
        href={cityPath("/crime", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Siren className="w-4 h-4" />
        Crime
      </Link>
      <Link
        href={cityPath("/feed", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Radio className="w-4 h-4" />
        Feed
      </Link>
      <Link
        href={cityPath("/news", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <Newspaper className="w-4 h-4" />
        News
      </Link>
      <NavDropdown city={city} />
      <Link
        href={cityPath("/review/new", city)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
      >
        <PenSquare className="w-4 h-4" />
        Submit Review
      </Link>
    </div>
  );
}
