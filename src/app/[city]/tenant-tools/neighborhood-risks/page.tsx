import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldAlert, FileSearch, Volume2, Wind, MapPin } from "lucide-react";
import { isValidCity, CITY_META } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NeighborhoodRisksSearch } from "@/components/neighborhood-risks/NeighborhoodRisksSearch";

export const revalidate = 3600;
// deploy: 1779320817

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city) || city !== "nyc") return {};
  const meta = CITY_META.nyc;
  const canonical = canonicalUrl(cityPath("/tenant-tools/neighborhood-risks", "nyc"));
  return {
    title: `${meta.fullName} Neighborhood Risks — What's Near Your Apartment?`,
    description: `Free NYC tool. Search any building address to see homeless shelters, methadone clinics, sirens, brownfields, and other nearby concerns within 0.75 mi.`,
    alternates: { canonical },
    openGraph: {
      title: `${meta.fullName} Neighborhood Risks | Lucid Rents`,
      description: `Search any NYC building. See what's nearby that listings won't tell you — within 0.75 mi.`,
      url: canonical,
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

interface CategoryCardProps {
  Icon: typeof ShieldAlert;
  title: string;
  description: string;
}

function CategoryCard({ Icon, title, description }: CategoryCardProps) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F1D2E] text-white mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#0F1D2E] mb-1">{title}</h3>
      <p className="text-xs text-[#64748b] leading-relaxed">{description}</p>
    </div>
  );
}

export default async function NeighborhoodRisksLandingPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  if (!isValidCity(city) || city !== "nyc") notFound();

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "NYC", href: cityPath("", "nyc") },
    { label: "Tenant Tools", href: cityPath("/tenant-tools", "nyc") },
    { label: "Neighborhood Risks", href: cityPath("/tenant-tools/neighborhood-risks", "nyc") },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <Breadcrumbs items={breadcrumbs} variant="dark" />
          <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-red-600/15 border border-red-600/35 text-white">
            <ShieldAlert className="w-3 h-3 text-red-300" />
            Neighborhood Risks
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mt-3 mb-4 tracking-tight">
            What&apos;s nearby that listings won&apos;t tell you?
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-2xl">
            Search any NYC building. We&apos;ll show you homeless shelters, methadone clinics, sirens, brownfields, rat hotspots, and other quality-of-life factors within 0.75 mi.
          </p>
          <NeighborhoodRisksSearch />
        </div>
      </div>

      {/* What we check */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">What we check</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CategoryCard
            Icon={ShieldAlert}
            title="Public-safety facilities"
            description="Homeless shelters, methadone clinics, halfway houses, sex offender registry counts. Sourced from NYC DHS, NYS OASAS, federal BOP, and NYS DCJS."
          />
          <CategoryCard
            Icon={Volume2}
            title="24/7 noise sources"
            description="Firehouses, police precincts, hospital ER bays, active construction, elevated rail, highway proximity. Sourced from FDNY, NYPD, DOHMH, NYC DOB, MTA."
          />
          <CategoryCard
            Icon={Wind}
            title="Environmental"
            description="Brownfield and Superfund sites, industrial business zones, DSNY garages. Sourced from EPA, NYS DEC, NYC DSNY."
          />
          <CategoryCard
            Icon={FileSearch}
            title="Block-level reputation"
            description="Rat complaints, 311 noise reports, bedbug history. Live from NYC 311 and HPD bedbug filings."
          />
        </div>

        <div className="mt-10 bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#0F1D2E] mb-2 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#3B82F6]" />
            What we don&apos;t show
          </h3>
          <ul className="text-sm text-[#475569] space-y-2">
            <li>
              <strong>Family shelters with children:</strong> intentionally excluded — DHS protects family-shelter addresses for safety reasons.
            </li>
            <li>
              <strong>Sex offender names or addresses:</strong> counts only (Level 2/3 within 0.75 mi). For details, use the{" "}
              <a
                href="https://www.criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3B82F6] font-semibold hover:text-[#2563EB]"
              >
                official NYS DCJS registry
              </a>
              .
            </li>
            <li>
              <strong>Listings, prices, or landlord info:</strong> this tool is location-only. For building details, see the building&apos;s page.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
