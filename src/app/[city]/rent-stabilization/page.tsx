import { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowUpDown } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { canonicalUrl, buildingUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { isValidCity, CITY_META, type City } from "@/lib/cities";

/* ---------------------------------------------------------------------------
 * City-specific rent stabilization config
 * -------------------------------------------------------------------------*/

interface RentStabConfig {
  title: string;
  metaDescription: string;
  headerDescription: string;
  searchPlaceholder: string;
  dataSourceLabel: string;
  editorialTitle: string;
  editorialParagraphs: string[];
  jsonLdName: string;
  jsonLdDescription: string;
}

const RENT_STAB_CONFIG: Record<City, RentStabConfig> = {
  nyc: {
    title: "NYC Rent Stabilization Checker",
    metaDescription:
      "Check if your NYC apartment is rent stabilized. Search any address to find rent stabilization status, unit counts, and historical data for buildings in New York City.",
    headerDescription:
      "Check if your apartment is rent stabilized. Search by address to find rent stabilization status based on NYC Department of Finance tax bill records. Rent stabilized tenants have protections including limits on rent increases and the right to lease renewal.",
    searchPlaceholder: "Search by address to check rent stabilization...",
    dataSourceLabel: "DOF Tax Bills",
    editorialTitle: "What Is Rent Stabilization?",
    editorialParagraphs: [
      "Rent stabilization is a set of laws that limit how much a landlord can raise rent each year for tenants in qualifying buildings. In New York City, approximately one million apartments are rent stabilized \u2014 making it one of the largest rent regulation systems in the country. Buildings with six or more units built before 1974, or those that received certain tax benefits like 421-a or J-51, are typically covered.",
      "If your apartment is rent stabilized, you have important protections: your landlord can only increase rent by the amount set each year by the NYC Rent Guidelines Board, you have the right to renew your lease, and you cannot be evicted without just cause. Landlords are also required to maintain the apartment and provide essential services.",
      "The data on this page comes from NYC Department of Finance tax bill records (RPIE filings), which landlords of rent stabilized buildings must submit annually. Individual apartment registration status can be verified through the DHCR (Division of Housing and Community Renewal) by requesting a rent history for your specific unit.",
    ],
    jsonLdName: "NYC Rent Stabilization Checker",
    jsonLdDescription:
      "Check if any NYC building has rent stabilized apartments based on DOF tax bill records.",
  },
  "los-angeles": {
    title: "LA Rent Stabilization (RSO) Checker",
    metaDescription:
      "Check if your Los Angeles apartment is covered by the Rent Stabilization Ordinance (RSO). Search any address to find RSO status and unit counts.",
    headerDescription:
      "Check if your apartment is covered by the LA Rent Stabilization Ordinance (RSO). Buildings with two or more units built before October 1, 1978 are generally covered. RSO tenants have protections including limits on annual rent increases and just-cause eviction requirements.",
    searchPlaceholder: "Search by address to check RSO status...",
    dataSourceLabel: "LAHD / ZIMAS",
    editorialTitle: "What Is the LA Rent Stabilization Ordinance (RSO)?",
    editorialParagraphs: [
      "The Los Angeles Rent Stabilization Ordinance (RSO) covers approximately 624,000 rental units in the City of Los Angeles. Buildings with two or more units that were built before October 1, 1978 and have a certificate of occupancy are generally covered. Some exemptions apply, including single-family homes, condominiums, and newer construction.",
      "If your apartment is covered by the RSO, your landlord can only increase rent by the annual percentage set by the LA Housing Department (LAHD), typically 3\u20138%. You also have just-cause eviction protections \u2014 your landlord cannot evict you without a legally recognized reason, and relocation assistance may be required for no-fault evictions.",
      "You can verify your building\u2019s RSO status through the LAHD\u2019s ZIMAS lookup tool or by contacting LAHD directly. The data on this page reflects public records from the City of Los Angeles.",
    ],
    jsonLdName: "LA Rent Stabilization (RSO) Checker",
    jsonLdDescription:
      "Check if any Los Angeles building is covered by the Rent Stabilization Ordinance based on LAHD records.",
  },
};

/* ---------------------------------------------------------------------------
 * Metadata
 * -------------------------------------------------------------------------*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const cfg = RENT_STAB_CONFIG[city];
  const meta = CITY_META[city];
  return {
    title: `${cfg.title} | Lucid Rents`,
    description: cfg.metaDescription,
    alternates: { canonical: canonicalUrl(cityPath("/rent-stabilization", city)) },
    openGraph: {
      title: cfg.title,
      description: cfg.metaDescription,
      url: canonicalUrl(cityPath("/rent-stabilization", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

/* ---------------------------------------------------------------------------
 * Data fetching
 * -------------------------------------------------------------------------*/

async function getBoroughStats() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/rent_stab_borough_stats`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function getStabilizedBuildings(borough?: string) {
  let url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?is_rent_stabilized=eq.true&select=full_address,borough,slug,stabilized_units,residential_units,stabilized_year,owner_name&order=stabilized_units.desc.nullslast&limit=200`;
  if (borough) {
    url += `&borough=eq.${encodeURIComponent(borough)}`;
  }
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

/* ---------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------*/

interface BoroughStat {
  borough: string;
  total_buildings: number;
  stabilized_buildings: number;
  total_stabilized_units: number;
}

interface StabilizedBuilding {
  full_address: string;
  borough: string;
  slug: string;
  stabilized_units: number | null;
  residential_units: number | null;
  stabilized_year: number | null;
  owner_name: string | null;
}

/* ---------------------------------------------------------------------------
 * Page
 * -------------------------------------------------------------------------*/

export default async function RentStabilizationPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ borough?: string; sort?: string; order?: string }>;
}) {
  const { city: cityParam } = await routeParams;
  const city: City = isValidCity(cityParam) ? cityParam : "nyc";
  const cfg = RENT_STAB_CONFIG[city];
  const meta = CITY_META[city];

  const sp = await searchParams;
  const borough = sp.borough || "";
  const sortBy = sp.sort || "stabilized_units";
  const order = sp.order || "desc";

  const [stats, buildings] = await Promise.all([
    getBoroughStats(),
    getStabilizedBuildings(borough || undefined),
  ]);

  const boroughStats: BoroughStat[] = (stats || []).map((s: BoroughStat) => ({
    ...s,
    total_buildings: Number(s.total_buildings),
    stabilized_buildings: Number(s.stabilized_buildings),
    total_stabilized_units: Number(s.total_stabilized_units),
  }));

  let rows: StabilizedBuilding[] = buildings || [];

  // Sort
  if (sortBy === "full_address") {
    rows.sort((a, b) =>
      order === "asc"
        ? a.full_address.localeCompare(b.full_address)
        : b.full_address.localeCompare(a.full_address)
    );
  } else if (sortBy === "stabilized_units") {
    rows.sort((a, b) =>
      order === "asc"
        ? (a.stabilized_units ?? 0) - (b.stabilized_units ?? 0)
        : (b.stabilized_units ?? 0) - (a.stabilized_units ?? 0)
    );
  }

  const regions = meta.regions;
  const regionLabel = meta.regionLabel;

  const totalStabilized = boroughStats.reduce((s, b) => s + b.stabilized_buildings, 0);
  const totalUnits = boroughStats.reduce((s, b) => s + b.total_stabilized_units, 0);

  function sortUrl(col: string) {
    const newOrder = sortBy === col && order === "desc" ? "asc" : "desc";
    const base = cityPath(`/rent-stabilization?sort=${col}&order=${newOrder}`, city);
    return borough ? `${base}&borough=${encodeURIComponent(borough)}` : base;
  }

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: cfg.jsonLdName,
              url: canonicalUrl(cityPath("/rent-stabilization", city)),
              applicationCategory: "RealEstate",
              operatingSystem: "All",
              description: cfg.jsonLdDescription,
            }),
          }}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-[#10b981]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              {cfg.title}
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            {cfg.headerDescription}
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mb-8">
          <SearchBar
            size="default"
            placeholder={cfg.searchPlaceholder}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Stabilized Buildings
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalStabilized.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#10b981] font-medium uppercase tracking-wide">
              Stabilized Units
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalUnits.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              {regionLabel}s
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{regions.length}</p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Data Source
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E] mt-2">
              {cfg.dataSourceLabel}
            </p>
          </div>
        </div>

        {/* Region breakdown */}
        {boroughStats.length > 0 && (
          <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(boroughStats.length, 5)} gap-3 mb-6`}>
            {boroughStats.map((b) => (
              <Link
                key={b.borough}
                href={cityPath(`/rent-stabilization?borough=${encodeURIComponent(b.borough)}`, city)}
                className={`bg-white border rounded-xl p-4 hover:border-[#3B82F6] transition-colors ${
                  borough === b.borough
                    ? "border-[#3B82F6] ring-1 ring-[#3B82F6]"
                    : "border-[#e2e8f0]"
                }`}
              >
                <p className="text-sm font-semibold text-[#0F1D2E]">
                  {b.borough}
                </p>
                <p className="text-xs text-[#64748b] mt-1">
                  {b.stabilized_buildings.toLocaleString()} buildings
                </p>
                <p className="text-xs text-[#10b981]">
                  {b.total_stabilized_units.toLocaleString()} units
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Region filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={cityPath("/rent-stabilization", city)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !borough
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            All {regionLabel}s
          </Link>
          {(regions as readonly string[]).map((b) => (
            <Link
              key={b}
              href={cityPath(`/rent-stabilization?borough=${encodeURIComponent(b)}${sortBy !== "stabilized_units" ? `&sort=${sortBy}&order=${order}` : ""}`, city)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                borough === b
                  ? "bg-[#0F1D2E] text-white"
                  : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              }`}
            >
              {b}
            </Link>
          ))}
        </div>

        {/* Results table */}
        {rows.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl">
            <ShieldCheck className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-[#64748b]">
              No rent stabilized buildings found. Run the data import to populate this page.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                      <Link
                        href={sortUrl("full_address")}
                        className="inline-flex items-center gap-1 hover:text-[#0F1D2E]"
                      >
                        Address <ArrowUpDown className="w-3 h-3" />
                      </Link>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">
                      {regionLabel}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#10b981] uppercase tracking-wide">
                      <Link
                        href={sortUrl("stabilized_units")}
                        className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto"
                      >
                        Stabilized <ArrowUpDown className="w-3 h-3" />
                      </Link>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                      Total Units
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                      Owner
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {rows.map((row, i) => (
                    <tr
                      key={`${row.slug}-${i}`}
                      className="hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={buildingUrl(row)}
                          className="text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8] hover:underline"
                        >
                          {row.full_address}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">
                        {row.borough}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#10b981] text-right">
                        {row.stabilized_units?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#334155] text-right hidden md:table-cell">
                        {row.residential_units?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748b] truncate max-w-[200px] hidden lg:table-cell">
                        {row.owner_name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Editorial content */}
        <section className="mt-8 space-y-4 text-sm leading-relaxed text-[#334155]">
          <h2 className="text-lg font-bold text-[#0F1D2E]">
            {cfg.editorialTitle}
          </h2>
          {cfg.editorialParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <AdBlock adSlot="RENT_STAB_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
