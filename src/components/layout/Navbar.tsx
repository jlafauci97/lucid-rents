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
import { NavDropdown } from "./NavDropdown";
import { MobileMenu } from "./MobileMenu";

// Read the current city from the middleware-set x-city header.
// Falls back to DEFAULT_CITY when the route isn't city-scoped.
async function getCurrentCity(): Promise<City> {
  const h = await headers();
  const xCity = h.get("x-city");
  if (xCity && VALID_CITIES.includes(xCity as City)) return xCity as City;
  return DEFAULT_CITY;
}

function BrandShield() {
  return (
    <svg viewBox="0 0 120 138" width="22" height="26" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="siteNavShieldClip"><path d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z"/></clipPath>
      </defs>
      <path d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z" fill="#3B82F6"/>
      <g clipPath="url(#siteNavShieldClip)" fill="#fff">
        <rect x="16" y="80" width="14" height="54"/>
        <rect x="32" y="66" width="14" height="68"/>
        <rect x="48" y="46" width="18" height="88"/>
        <rect x="68" y="56" width="14" height="78"/>
        <rect x="84" y="74" width="14" height="60"/>
      </g>
      <g clipPath="url(#siteNavShieldClip)" fill="#3B82F6">
        <rect x="52" y="52" width="2" height="3"/><rect x="58" y="52" width="2" height="3"/><rect x="62" y="52" width="2" height="3"/>
        <rect x="52" y="60" width="2" height="3"/><rect x="58" y="60" width="2" height="3"/><rect x="62" y="60" width="2" height="3"/>
        <rect x="52" y="68" width="2" height="3"/><rect x="58" y="68" width="2" height="3"/><rect x="62" y="68" width="2" height="3"/>
      </g>
    </svg>
  );
}

function NavLinksRow({ city }: { city: City }) {
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
      {/* Tenant Tools — functional dropdown (includes Feed, Crime, News, and all tools) */}
      <NavDropdown city={city} />
      <Link href={`/${prefix}/review/new`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Write Review
      </Link>
    </div>
  );
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
