"use client";

import Link from "next/link";
import { type City, CITY_META } from "@/lib/cities";
import { cityPath, neighborhoodUrl } from "@/lib/seo";
import { useCityFromPath } from "@/lib/city-context";
import { getToolsForCity, getToolLabel } from "@/lib/tenant-tools-nav";

/**
 * Top neighborhoods to feature in the footer per city. Curated for SEO
 * value — high-search-volume neighborhood names. Each entry is a
 * (zip, display name) pair; URLs resolve via neighborhoodUrl(zip, city)
 * which produces /[city]/neighborhood/{slug}-{zip}.
 *
 * Stable list — refresh occasionally as search trends shift.
 */
const TOP_NEIGHBORHOODS: Record<City, { zip: string; name: string }[]> = {
  nyc: [
    { zip: "11211", name: "Williamsburg" },
    { zip: "11221", name: "Bushwick" },
    { zip: "10002", name: "Lower East Side" },
    { zip: "11215", name: "Park Slope" },
    { zip: "11102", name: "Astoria" },
    { zip: "10028", name: "Upper East Side" },
    { zip: "10023", name: "Upper West Side" },
    { zip: "10014", name: "West Village" },
    { zip: "10011", name: "Chelsea" },
    { zip: "11216", name: "Bed-Stuy" },
  ],
  "los-angeles": [
    { zip: "90028", name: "Hollywood" },
    { zip: "90039", name: "Silver Lake" },
    { zip: "90026", name: "Echo Park" },
    { zip: "90291", name: "Venice" },
    { zip: "90401", name: "Santa Monica" },
    { zip: "90005", name: "Koreatown" },
    { zip: "90010", name: "Mid-Wilshire" },
    { zip: "91604", name: "Studio City" },
    { zip: "90013", name: "Downtown" },
    { zip: "90066", name: "Mar Vista" },
  ],
  chicago: [
    { zip: "60614", name: "Lincoln Park" },
    { zip: "60622", name: "Wicker Park" },
    { zip: "60657", name: "Lakeview" },
    { zip: "60647", name: "Logan Square" },
    { zip: "60608", name: "Pilsen" },
    { zip: "60654", name: "River North" },
    { zip: "60610", name: "Old Town" },
    { zip: "60611", name: "Streeterville" },
    { zip: "60605", name: "South Loop" },
    { zip: "60607", name: "West Loop" },
  ],
  miami: [
    { zip: "33131", name: "Brickell" },
    { zip: "33127", name: "Wynwood" },
    { zip: "33133", name: "Coconut Grove" },
    { zip: "33139", name: "South Beach" },
    { zip: "33137", name: "Edgewater" },
    { zip: "33134", name: "Coral Gables" },
    { zip: "33128", name: "Downtown Miami" },
    { zip: "33125", name: "Little Havana" },
  ],
  houston: [
    { zip: "77006", name: "Montrose" },
    { zip: "77007", name: "Heights" },
    { zip: "77005", name: "Rice Village" },
    { zip: "77002", name: "Downtown" },
    { zip: "77030", name: "Medical Center" },
    { zip: "77027", name: "Galleria" },
    { zip: "77019", name: "River Oaks" },
    { zip: "77024", name: "Memorial" },
    { zip: "77098", name: "Upper Kirby" },
    { zip: "77004", name: "Third Ward" },
  ],
};

/**
 * Top landlords by total_violations, curated per city. Surfaced from
 * `landlord_stats` (2026-05-24 snapshot) and filtered to real
 * LLC/Corp/LP entities — skipping junk like "CURRENT OWNER",
 * "CITY OF HOUSTON", and last-name-only collapsed records.
 *
 * Order matches the live ranking at snapshot time; the data is stable
 * enough that hardcoding avoids an extra DB query on every page load.
 */
const TOP_VIOLATION_LANDLORDS: Record<City, { name: string; slug: string }[]> = {
  nyc: [
    { name: "Linden Plaza Housing Co.", slug: "linden-plaza-housing-co-inc" },
    { name: "Flatbush Gardens", slug: "flatbush-gardens-housing-development-fun-d-corporat" },
    { name: "Neighborhood Renewal HDFC", slug: "neighborhood-renewal-housing-development-fund-corp" },
    { name: "Parkchester South Condo Assoc.", slug: "parkchester-south-condominium-assoc" },
    { name: "Senior Living Options, Inc.", slug: "senior-living-options-inc" },
    { name: "HP Bronx Park East HDFC", slug: "hp-bronx-park-east-housing-dvlp-fund-com-pany-inc" },
    { name: "Kew Gardens Hills, LLC", slug: "kew-gardens-hills-llc" },
  ],
  "los-angeles": [
    { name: "Prime/Park Labrea Titleholder", slug: "prime-park-labrea-titleholder-llc" },
    { name: "Sterling Family Trust", slug: "sterling-family-trust" },
    { name: "Avanath Baldwin Village LP", slug: "avanath-baldwin-village-lp" },
    { name: "Archstone Oakwood Toluca Hills", slug: "archstone-oakwood-toluca-hills-llc" },
    { name: "Dorset Village Partners LP", slug: "dorset-village-partners-lp" },
    { name: "RHF Housing Partners", slug: "rhf-housing-partners" },
    { name: "7223 Willoughby LLC", slug: "7223-willoughby-llc" },
  ],
  chicago: [
    { name: "QCD Financial LLC", slug: "qcd-financial-llc" },
    { name: "Chatham Housing Portfolio 91", slug: "chatham-housing-portfolio-91-llc" },
    { name: "Pivot Urban LLC", slug: "pivot-urban-llc" },
    { name: "MGIL LLC", slug: "mgil-llc" },
    { name: "South Shore IL Preservation LP", slug: "south-shore-il-preservation-lp" },
    { name: "Goldmine Investments LLC", slug: "goldmine-investments-llc" },
    { name: "Metro Capital Investors LLC", slug: "metro-capital-investors-llc" },
  ],
  miami: [
    { name: "South Dade Too LLC", slug: "south-dade-too-llc" },
    { name: "29055 SW 107 Ave LLC", slug: "29055-sw-107-ave-llc" },
    { name: "A & B Real Estate Holdings", slug: "a-b-real-estate-holdings-llc" },
    { name: "Ortez Corporation", slug: "ortez-corporation" },
    { name: "Castle Key LLC", slug: "castle-key-llc" },
    { name: "Maksanim LLC", slug: "maksanim-llc" },
    { name: "Finca Cayo Cujal LLC", slug: "finca-cayo-cujal-llc" },
  ],
  houston: [
    { name: "PCLO H2 LLC", slug: "pclo-h2-llc" },
    { name: "SKD Ventures LLC", slug: "skd-ventures-llc" },
    { name: "Enersolutions LLC", slug: "enersolutions-llc" },
    { name: "Dan Investments LLC", slug: "dan-investments-llc" },
    { name: "K To Lousiana LLC", slug: "k-to-lousiana-llc" },
    { name: "CCLCC Trust", slug: "cclcc-trust" },
    { name: "J Cassel Enterprises LLC", slug: "j-cassel-enterprises-llc" },
  ],
};

export function Footer() {
  // City is derived from the URL pathname client-side so this component can be
  // statically prerendered. Avoids the `headers()` call that previously opted
  // every route out of static rendering & ISR.
  const city: City = useCityFromPath();
  const cityName = CITY_META[city]?.fullName || "New York City";
  // Same canonical list the NavDropdown renders, filtered by city availability.
  const tools = getToolsForCity(city);
  const topLandlords = TOP_VIOLATION_LANDLORDS[city] ?? [];
  const topNeighborhoods = TOP_NEIGHBORHOODS[city] ?? [];

  return (
    <footer className="bg-[#0F1D2E] text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand + contact */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">
              <span className="text-[#3B82F6]">Lucid</span> Rents
            </h3>
            <p className="text-sm">
              Know your {cityName} apartment before you sign. Real data, real reviews,
              real transparency.
            </p>
            <p className="text-sm mt-3">
              <a href="mailto:Admin@lucidrents.com" className="hover:text-white transition-colors">
                Admin@lucidrents.com
              </a>
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={cityPath("/search", city)} className="hover:text-white transition-colors">
                  Search Buildings
                </Link>
              </li>
              <li>
                <Link href={cityPath("/review/new", city)} className="hover:text-white transition-colors">
                  Submit a Review
                </Link>
              </li>
              <li>
                <Link href={cityPath("/news", city)} className="hover:text-white transition-colors">
                  {cityName} Housing News
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Tenant Tools — city-aware, mirrors the NavDropdown list */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              {cityName} Tenant Tools
            </h4>
            <ul className="space-y-2 text-sm">
              {tools.map((t) => (
                <li key={t.path}>
                  <Link
                    href={t.global ? t.path : cityPath(t.path, city)}
                    className="hover:text-white transition-colors"
                  >
                    {getToolLabel(t, city)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Top Landlords by Violations — city-specific */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              Top Landlords by Violations
            </h4>
            <ul className="space-y-2 text-sm">
              {topLandlords.map((l) => (
                <li key={l.slug}>
                  <Link
                    href={cityPath(`/landlord/${l.slug}`, city)}
                    className="hover:text-white transition-colors"
                  >
                    {l.name}
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href={cityPath("/landlords?sort=violations", city)}
                  className="hover:text-white transition-colors font-medium text-[#3B82F6]"
                >
                  See all {cityName} landlords →
                </Link>
              </li>
            </ul>
          </div>

          {/* Top Neighborhoods — city-specific, curated for SEO link equity */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              Top {cityName} Neighborhoods
            </h4>
            <ul className="space-y-2 text-sm">
              {topNeighborhoods.map((n) => (
                <li key={n.zip}>
                  <Link
                    href={neighborhoodUrl(n.zip, city)}
                    className="hover:text-white transition-colors"
                  >
                    {n.name}
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href={cityPath("/neighborhoods", city)}
                  className="hover:text-white transition-colors font-medium text-[#3B82F6]"
                >
                  See all neighborhoods →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row: copyright + legal */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-sm text-center">
          <p>
            &copy; {new Date().getFullYear()} Lucid Rents. All rights reserved.
            {" · "}
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            {" · "}
            <Link href="/mission-control" className="text-gray-600 hover:text-gray-400 transition-colors">Admin</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
