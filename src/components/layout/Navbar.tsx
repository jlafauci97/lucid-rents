/**
 * Site-wide top navigation. Uses the v2 design (navy bg, pill links,
 * shield logo, city picker dropdown, real search input, tenant-tools
 * dropdown) across every page. Supersedes the earlier Tailwind-only nav.
 *
 * Styling lives in src/styles/site-nav.css (class names: .nav, .nav-inner,
 * .brand, .city-picker, .nav-search, .nav-links, .nav-login, .nav-auth).
 *
 * IMPORTANT: This component does NOT call cookies() or headers() — both
 * would opt every route out of static rendering and make Cached Egress = 0.
 * City detection happens client-side via useCityFromPath(); auth state
 * via the client-side <NavAuth> island.
 */

import Image from "next/image";
import Link from "next/link";
import { DEFAULT_CITY } from "@/lib/cities";
import { NavCityPicker } from "@/components/building/v2/NavCityPicker";
import { SearchTrigger } from "@/components/search/SearchTrigger";
import { NavLinksRow } from "./NavLinksRow";
import { NavAuth } from "./NavAuth";

function SocialLinks() {
  return (
    <div className="nav-social">
      <a
        href="https://www.instagram.com/lucid_rents/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </a>
      <a
        href="https://x.com/LucidRents"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X (Twitter)"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
        </svg>
      </a>
      <a
        href="https://www.tiktok.com/@lucid_rents"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="TikTok"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.36a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.27Z" />
        </svg>
      </a>
    </div>
  );
}

export function Navbar() {
  // City and auth are resolved client-side so this component can be
  // statically prerendered. Children read useCityFromPath() and ignore
  // the fallback prop after hydration.
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="LucidRents home">
          <Image
            src="/lucid-rents-wordmark.png"
            alt="LucidRents"
            width={930}
            height={261}
            sizes="200px"
            priority
            className="h-[47px] lg:h-[54px] w-auto"
          />
        </Link>
        <NavCityPicker currentCity={DEFAULT_CITY} />
        <SearchTrigger city={DEFAULT_CITY} />
        <NavLinksRow city={DEFAULT_CITY} />
        <NavAuth />
        <SocialLinks />
      </div>
    </nav>
  );
}
