/**
 * NavV2 — direct port of the mockup at public/mockups/building-v1.html, lines 2940–2961.
 *
 * Preserved verbatim from mockup:
 *   - DOM structure
 *   - Every class name (.nav, .nav-inner, .brand, .dot, .city-picker, .nav-search,
 *     .nav-links, .nav-login, .chev)
 *   - Every inline SVG (viewBox, path `d`, stroke-width, circle radii, points)
 *   - Element order
 *   - Text content (except city name which is data-driven)
 *
 * Changes vs mockup (mechanical only):
 *   - class → className
 *   - self-closing void tags
 *   - "NYC" text swapped for {cityName}
 *   - <a href="/"> around brand → <Link>
 *   - <a> nav-links get href values wired
 */

import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";

interface Props {
  city: City;
}

export function NavV2({ city }: Props) {
  const cityMeta = CITY_META[city];
  const cityName = cityMeta?.name ?? "NYC";
  const cityPrefix = cityMeta?.urlPrefix ?? "nyc";

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          {/* Shield + Skyline mark (Concept 01 from logo-shield.html, lines ported).
              Compact nav size: 22×26. Fill uses brand blue; buildings are white;
              tiny windows on the tallest tower echo the navy inks. */}
          <svg viewBox="0 0 120 138" width="22" height="26" aria-hidden="true" style={{ flexShrink: 0 }}>
            <defs>
              <clipPath id="navShieldClip"><path d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z"/></clipPath>
            </defs>
            <path d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z" fill="#3B82F6"/>
            <g clipPath="url(#navShieldClip)" fill="#fff">
              <rect x="16" y="80" width="14" height="54"/>
              <rect x="32" y="66" width="14" height="68"/>
              <rect x="48" y="46" width="18" height="88"/>
              <rect x="68" y="56" width="14" height="78"/>
              <rect x="84" y="74" width="14" height="60"/>
            </g>
            <g clipPath="url(#navShieldClip)" fill="#3B82F6">
              <rect x="52" y="52" width="2" height="3"/><rect x="58" y="52" width="2" height="3"/><rect x="62" y="52" width="2" height="3"/>
              <rect x="52" y="60" width="2" height="3"/><rect x="58" y="60" width="2" height="3"/><rect x="62" y="60" width="2" height="3"/>
              <rect x="52" y="68" width="2" height="3"/><rect x="58" y="68" width="2" height="3"/><rect x="62" y="68" width="2" height="3"/>
            </g>
          </svg>
          lucidrents
        </Link>
        <button className="city-picker" aria-label="Switch city">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {cityName}
          <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div className="nav-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span>Search an address, building, or landlord…</span>
        </div>
        <div className="nav-links">
          <Link href={`/${cityPrefix}/worst-rated-buildings`} className="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Rankings</Link>
          <Link href={`/${cityPrefix}/landlords`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Landlords</Link>
          <Link href={`/${cityPrefix}/neighborhoods`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Neighborhoods</Link>
          <Link href="/tenant-tools"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Tenant Tools</Link>
          <Link href="/guides"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Guides</Link>
        </div>
        <Link href="/login" className="nav-login">Log in</Link>
      </div>
    </nav>
  );
}
