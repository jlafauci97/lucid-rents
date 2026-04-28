import { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FAQSection } from "@/components/seo/FAQSection";
import { AdSidebar } from "@/components/ui/AdSidebar";
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
      "Is your NYC apartment rent stabilized? Search any address to instantly check stabilization status, unit counts, and what protections you may have.",
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
      "Is your LA apartment rent controlled? Search any address to check RSO status instantly — know your rights before your landlord raises the rent.",
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
  chicago: {
    title: "Chicago RLTO Protections Checker",
    metaDescription:
      "Check your Chicago apartment's RLTO protections — security deposit rights, just cause eviction coverage, and tenant ordinance compliance.",
    headerDescription:
      "Check if your apartment is protected under Chicago's Residential Landlord Tenant Ordinance (RLTO) and the Just Cause for Eviction Ordinance. Most residential rental units in Chicago are covered by the RLTO, which provides security deposit protections, notice requirements, and remedies for landlord violations.",
    searchPlaceholder: "Search by address to check RLTO protections...",
    dataSourceLabel: "City of Chicago / CDPH",
    editorialTitle: "What Is the Chicago RLTO?",
    editorialParagraphs: [
      "The Chicago Residential Landlord Tenant Ordinance (RLTO) is one of the strongest tenant protection laws in the United States. It covers most residential rental units in Chicago and provides comprehensive protections including strict security deposit rules, notice requirements for rent increases and lease termination, and remedies when landlords violate the ordinance.",
      "Under the RLTO, landlords must hold security deposits in federally insured interest-bearing accounts, provide receipts with bank details, and return the deposit with interest within 30 days of move-out with an itemized statement of any deductions. Violations of these rules can entitle tenants to double the deposit amount plus attorney fees.",
      "In 2023, Chicago passed the Just Cause for Eviction Ordinance, which requires landlords to have a valid reason to evict tenants or refuse to renew leases. Note that Illinois state law preempts traditional rent control — Chicago cannot set limits on rent amounts. However, the RLTO and Just Cause ordinance together provide significant protections for renters.",
    ],
    jsonLdName: "Chicago RLTO Protections Checker",
    jsonLdDescription:
      "Check RLTO protections and just cause eviction coverage for any Chicago apartment.",
  },
  miami: {
    title: "Miami Tenant Protections Guide",
    metaDescription:
      "Florida has no rent control — learn what protections Miami tenants do have, including security deposit rules, notice requirements, and condo safety regulations.",
    headerDescription:
      "Florida state law preempts all local rent control, meaning Miami-Dade County and its municipalities cannot set limits on rent increases. However, Miami tenants still have protections under Florida Statute Chapter 83 (the Florida Residential Landlord and Tenant Act), including security deposit rules, habitability standards, and notice requirements.",
    searchPlaceholder: "Search by address to check building protections...",
    dataSourceLabel: "Miami-Dade Property Appraiser / RER",
    editorialTitle: "What Protections Do Miami Tenants Have?",
    editorialParagraphs: [
      "Unlike NYC, LA, and Chicago, Florida law explicitly prohibits local governments from enacting rent control ordinances except in cases of a housing emergency declared by the governor. This means there are no rent stabilization protections for Miami tenants — landlords can raise rent by any amount with proper notice (typically 30 days for month-to-month, or at lease renewal).",
      "Miami tenants are protected by the Florida Residential Landlord and Tenant Act (F.S. 83), which requires landlords to maintain the premises in compliance with building codes, provide functioning plumbing, heat, and hot water, and follow specific procedures for security deposit handling. Landlords must return deposits within 15-30 days of move-out with an itemized list of deductions.",
      "After the 2021 Surfside condominium collapse, Miami-Dade County strengthened its 40-year building recertification requirements. Buildings 40 years or older (25 years in coastal zones) must undergo structural inspections and recertification. This is critical for tenants in older buildings — check your building's recertification status using the search above.",
    ],
    jsonLdName: "Miami Tenant Protections Guide",
    jsonLdDescription:
      "Learn about tenant protections for Miami apartments — no rent control in Florida but other key protections apply.",
  },
  houston: {
    title: "Houston Tenant Protections Guide",
    metaDescription:
      "Texas has no rent control — learn what protections Houston tenants do have, including security deposit rules, notice requirements, and habitability standards.",
    headerDescription:
      "Texas state law preempts all local rent control, meaning Houston and other Texas cities cannot set limits on rent increases. However, Houston tenants still have protections under Texas Property Code Chapter 92, including security deposit rules, habitability standards, and notice requirements for lease termination.",
    searchPlaceholder: "Search by address to check building protections...",
    dataSourceLabel: "HCAD / City of Houston",
    editorialTitle: "What Protections Do Houston Tenants Have?",
    editorialParagraphs: [
      "Texas law explicitly prohibits local governments from enacting rent control ordinances. This means there are no rent stabilization protections for Houston tenants — landlords can raise rent by any amount with proper notice (typically 30 days for month-to-month, or at lease renewal for fixed-term leases).",
      "Houston tenants are protected by the Texas Property Code (Chapter 92), which requires landlords to make a diligent effort to repair conditions that materially affect the health or safety of an ordinary tenant, provide functioning smoke detectors, and follow specific procedures for security deposit handling. Landlords must return deposits within 30 days of move-out with an itemized list of deductions.",
      "Houston is particularly vulnerable to flooding and hurricane damage. Tenants should check whether their building is in a FEMA-designated flood zone and understand their rights regarding habitability after storm damage. Landlords are required to disclose known flood risks, and tenants may have the right to terminate a lease if a property becomes substantially uninhabitable due to flood damage.",
    ],
    jsonLdName: "Houston Tenant Protections Guide",
    jsonLdDescription:
      "Learn about tenant protections for Houston apartments — no rent control in Texas but other key protections apply.",
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
    title: `${cfg.title}`,
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

export const revalidate = 3600;

/* ---------------------------------------------------------------------------
 * Data fetching
 * -------------------------------------------------------------------------*/

async function getBoroughStats(metro: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/rent_stab_borough_stats`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_metro: metro }),
    next: { revalidate: 3600 },
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

/* ---------------------------------------------------------------------------
 * Page
 * -------------------------------------------------------------------------*/

export default async function RentStabilizationPage({
  params: routeParams,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await routeParams;
  const city: City = isValidCity(cityParam) ? cityParam : "nyc";
  const cfg = RENT_STAB_CONFIG[city];
  const meta = CITY_META[city];

  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const metro = isLA ? "los-angeles" : isChicago ? "chicago" : "nyc";

  const stats = await getBoroughStats(metro);
  const boroughStats: BoroughStat[] = (stats || []).map((s: BoroughStat) => ({
    ...s,
    total_buildings: Number(s.total_buildings),
    stabilized_buildings: Number(s.stabilized_buildings),
    total_stabilized_units: Number(s.total_stabilized_units),
  }));

  const regions = meta.regions;
  const regionLabel = meta.regionLabel;

  const totalStabilized = boroughStats.reduce((s, b) => s + b.stabilized_buildings, 0);
  const totalUnits = boroughStats.reduce((s, b) => s + b.total_stabilized_units, 0);

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

        <Breadcrumbs items={cityBreadcrumbs(city, { label: "Rent Stabilization", href: cityPath("/rent-stabilization", city) })} />

        {/* Header */}
        <div className="mb-8 mt-4">
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
              {isLA ? "RSO Buildings" : "Stabilized Buildings"}
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalStabilized.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#10b981] font-medium uppercase tracking-wide">
              {isLA ? "RSO Units" : "Stabilized Units"}
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

        {/* Region breakdown — informational only, not clickable */}
        {boroughStats.length > 0 && (
          <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(boroughStats.length, 5)} gap-3 mb-8`}>
            {boroughStats.map((b) => (
              <div
                key={b.borough}
                className="bg-white border border-[#e2e8f0] rounded-xl p-4"
              >
                <p className="text-sm font-semibold text-[#0F1D2E]">{b.borough}</p>
                <p className="text-xs text-[#64748b] mt-1">
                  {b.stabilized_buildings.toLocaleString()} buildings
                </p>
                <p className="text-xs text-[#10b981]">
                  {b.total_stabilized_units.toLocaleString()} units
                </p>
              </div>
            ))}
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

        {/* FAQ */}
        <FAQSection
          items={[
            {
              question: isLA ? "What is the LA Rent Stabilization Ordinance (RSO)?" : isChicago ? "What rent protections does Chicago have?" : "What is NYC rent stabilization?",
              answer: cfg.editorialParagraphs[0],
            },
            {
              question: isLA ? "What rights do RSO tenants have?" : isChicago ? "Which buildings are covered by Chicago rent protections?" : "What are your rights as a rent stabilized tenant?",
              answer: cfg.editorialParagraphs[1],
            },
            {
              question: "How do I check if my apartment is rent stabilized?",
              answer: `Search your building's address above to instantly check ${isLA ? "RSO" : isChicago ? "rent ordinance" : "rent stabilization"} status based on public records. ${cfg.editorialParagraphs[2] ?? ""}`,
            },
            {
              question: isLA ? "What are the annual RSO rent increase limits?" : "How much can a landlord raise rent on a stabilized apartment?",
              answer: isLA
                ? "LA's Housing Department sets annual RSO rent increase limits based on the Consumer Price Index (CPI). As of recent rulings, increases are capped at 3-8% per year. The exact rate depends on the year and any additional utility pass-throughs."
                : isChicago
                ? "Chicago does not have a citywide rent control law. Unlike NYC or LA, landlords in Chicago can raise rent by any amount as long as proper notice is given (typically 30 days for month-to-month, or according to lease terms)."
                : "The NYC Rent Guidelines Board sets the maximum allowable rent increase each year for rent stabilized apartments. For 2023-2024, the increases were 3% for 1-year leases and 2.75% for the first year of 2-year leases.",
            },
            {
              question: "What happens if a landlord illegally raises my rent?",
              answer: isLA
                ? "RSO tenants can file a complaint with the LA Housing Department if their landlord raises rent above the allowed amount. You may be entitled to a rent reduction and repayment of overcharges."
                : "Tenants in rent stabilized apartments who are overcharged can file a rent overcharge complaint with the DHCR. If a rent overcharge is found, the landlord must reimburse the overcharged amount, plus interest, and may face penalties.",
            },
          ]}
          title={`Frequently Asked Questions About ${isLA ? "LA RSO" : isChicago ? "Chicago Rent Protections" : "NYC Rent Stabilization"}`}
        />
      </div>
    </AdSidebar>
  );
}
