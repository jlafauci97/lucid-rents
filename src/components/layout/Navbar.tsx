/**
 * Site-wide top navigation. Uses the v2 design (navy bg, pill links,
 * shield logo, city picker dropdown, real search input, tenant-tools
 * dropdown) across every page. Supersedes the earlier Tailwind-only nav.
 *
 * Styling lives in src/styles/site-nav.css (class names: .nav, .nav-inner,
 * .brand, .city-picker, .nav-search, .nav-links, .nav-login, .nav-auth).
 */

import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CITY_META, DEFAULT_CITY, VALID_CITIES, type City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { NavCityPicker } from "@/components/building/v2/NavCityPicker";
import { NavSearch } from "@/components/building/v2/NavSearch";
import { NavLinksRow } from "./NavLinksRow";
import { MobileMenu } from "./MobileMenu";
import { BrandShield } from "@/components/brand/BrandShield";

// Read the current city from the middleware-set x-city header.
// Falls back to DEFAULT_CITY when the route isn't city-scoped.
async function getCurrentCity(): Promise<City> {
  const h = await headers();
  const xCity = h.get("x-city");
  if (xCity && VALID_CITIES.includes(xCity as City)) return xCity as City;
  return DEFAULT_CITY;
}

async function AuthSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <>
        <div className="nav-auth">
          <Link href="/profile"><User className="w-4 h-4" /> Profile</Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit"><LogOut className="w-4 h-4" /> Sign Out</button>
          </form>
        </div>
        <MobileMenu isLoggedIn />
      </>
    );
  }
  return (
    <>
      <Link href="/login" className="nav-login">Log in</Link>
      <MobileMenu isLoggedIn={false} />
    </>
  );
}

function AuthFallback() {
  return (
    <>
      <Link href="/login" className="nav-login">Log in</Link>
      <MobileMenu isLoggedIn={false} />
    </>
  );
}

export async function Navbar() {
  const city = await getCurrentCity();
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <BrandShield />
          LucidRents
        </Link>
        <NavCityPicker currentCity={city} />
        <NavSearch city={city} />
        <NavLinksRow city={city} />
        <Suspense fallback={<AuthFallback />}>
          <AuthSection />
        </Suspense>
      </div>
    </nav>
  );
}
