"use client";

import Link from "next/link";
import { Search, BarChart3, Users, Siren, Radio, Newspaper, PenSquare } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { useCityFromPath } from "@/lib/city-context";
import { NavDropdown } from "./NavDropdown";

export function NavLinks() {
  const city = useCityFromPath();

  return (
    <div className="hidden lg:flex items-center gap-4">
      <Link
        href={cityPath("/search", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Search className="w-3.5 h-3.5" />
        Search
      </Link>
      <Link
        href={cityPath("/worst-rated-buildings", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        Rankings
      </Link>
      <Link
        href={cityPath("/landlords", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Users className="w-3.5 h-3.5" />
        Landlords
      </Link>
      <Link
        href={cityPath("/crime", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Siren className="w-3.5 h-3.5" />
        Crime
      </Link>
      <Link
        href={cityPath("/feed", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Radio className="w-3.5 h-3.5" />
        Feed
      </Link>
      <Link
        href={cityPath("/news", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Newspaper className="w-3.5 h-3.5" />
        News
      </Link>
      <NavDropdown city={city} />
      <Link
        href={cityPath("/review/new", city)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <PenSquare className="w-3.5 h-3.5" />
        Review
      </Link>
    </div>
  );
}
