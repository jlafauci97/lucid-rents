import Link from "next/link";
import { headers } from "next/headers";
import { type City, CITY_META, DEFAULT_CITY, VALID_CITIES } from "@/lib/cities";
import { cityPath } from "@/lib/seo";

/**
 * Read the current city from the middleware-set x-city header.
 * Falls back to DEFAULT_CITY when the route isn't city-scoped.
 * Mirrors the pattern used in Navbar.
 */
async function getCurrentCity(): Promise<City> {
  const h = await headers();
  const xCity = h.get("x-city");
  if (xCity && VALID_CITIES.includes(xCity as City)) return xCity as City;
  return DEFAULT_CITY;
}

const DATA_SOURCES: Record<City, string[]> = {
  nyc: [
    "NYC Open Data - HPD Violations",
    "NYC Open Data - DOB Violations",
    "NYC Open Data - 311 Complaints",
    "NYC PLUTO Building Data",
  ],
  "los-angeles": [
    "LA Open Data - LAHD Violations",
    "LA Open Data - LADBS Permits",
    "LA Open Data - 311 Complaints",
    "LA County Assessor Data",
    "LAHD Soft-Story Inventory",
  ],
  chicago: [
    "Chicago Open Data - Building Violations",
    "Chicago Open Data - 311 Requests",
    "Chicago Open Data - CPD Crime",
    "Cook County Assessor Data",
    "Chicago Energy Benchmarking",
  ],
  miami: [
    "Miami-Dade Open Data - Code Violations",
    "Miami-Dade Open Data - 311 Requests",
    "Miami-Dade Open Data - MDPD Crime",
    "Miami-Dade Property Appraiser",
    "Miami-Dade 40-Year Recertification",
    "FEMA Flood Zone Data",
  ],
  houston: [
    "Houston Open Data - Code Violations",
    "Houston Open Data - 311 Requests",
    "Houston Open Data - HPD Crime",
    "HCAD Property Data",
    "FEMA Flood Zone Data",
  ],
};

/**
 * Tenant tools available in each city. Universal tools are listed first; each
 * city's array is concatenated with city-specific additions. Rent
 * Stabilization gets a per-city label (NYC: Rent Stabilization, LA: RSO,
 * Chicago: RLTO, Miami: Tenant Protections).
 */
interface ToolLink {
  href: string;
  label: string;
  global?: boolean; // true → don't prepend city prefix
}

function getRentStabilizationLabel(city: City): string {
  if (city === "los-angeles") return "RSO Checker";
  if (city === "chicago") return "RLTO Checker";
  if (city === "miami") return "Tenant Protections";
  return "Rent Stabilization Checker";
}

function getTenantTools(city: City): ToolLink[] {
  const universal: ToolLink[] = [
    { href: "/tenant-tools", label: "Tenant Tools Hub" },
    { href: "/tenant-tools/templates", label: "Letter Templates" },
    { href: "/tenant-tools/checklist", label: "Pre-Move-In Checklist" },
    { href: "/tenant-rights", label: "Tenant Rights Guide" },
    { href: "/rent-stabilization", label: getRentStabilizationLabel(city) },
    { href: "/rent-affordability-calculator", label: "Rent Affordability Calculator", global: true },
    { href: "/rent-timing-calculator", label: "Rent Timing Calculator", global: true },
  ];
  const cityExtras: Partial<Record<City, ToolLink[]>> = {
    nyc: [
      { href: "/tenant-tools/neighborhood-risks", label: "Neighborhood Risks" },
    ],
    "los-angeles": [
      { href: "/encampments", label: "Encampment Reports" },
      { href: "/seismic-fire-safety", label: "Seismic & Fire Zones" },
      { href: "/ellis-act", label: "Ellis Act Tracker" },
    ],
    chicago: [
      { href: "/problem-landlords", label: "Problem Landlords" },
      { href: "/affordable-housing", label: "Affordable Housing Tracker" },
      { href: "/lead-safety", label: "Lead Safety" },
      { href: "/heating-tracker", label: "Heating Tracker" },
    ],
  };
  return [...universal, ...(cityExtras[city] ?? [])];
}

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

export async function Footer() {
  const city = await getCurrentCity();
  const cityName = CITY_META[city]?.fullName || "New York City";
  const tools = getTenantTools(city);
  const topLandlords = TOP_VIOLATION_LANDLORDS[city] ?? [];

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

          {/* Tenant Tools — city-aware */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              {cityName} Tenant Tools
            </h4>
            <ul className="space-y-2 text-sm">
              {tools.map((t) => (
                <li key={t.href}>
                  <Link
                    href={t.global ? t.href : cityPath(t.href, city)}
                    className="hover:text-white transition-colors"
                  >
                    {t.label}
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

          {/* Data Sources */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Data Sources</h4>
            <ul className="space-y-2 text-sm">
              {(DATA_SOURCES[city] || DATA_SOURCES.nyc).map((source) => (
                <li key={source}>{source}</li>
              ))}
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
