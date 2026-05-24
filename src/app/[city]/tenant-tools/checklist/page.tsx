import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { ChecklistSearch } from "@/components/tenant-tools/ChecklistSearch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";
  return {
    title: `Pre-Move-In Checklist | ${cityName} | Lucid Rents`,
    description: `Before you sign a lease in ${cityName}, run a quick due-diligence check. Search any building to see open violations, complaints, pest history, reviews, and more.`,
    alternates: { canonical: canonicalUrl(cityPath("/tenant-tools/checklist", city as City)) },
  };
}

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";

  return (
    <AdSidebar>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={cityBreadcrumbs(
            city as City,
            { label: "Tenant Tools", href: cityPath("/tenant-tools", city as City) },
            { label: "Move-In Checklist", href: cityPath("/tenant-tools/checklist", city as City) }
          )}
        />

        {/* Header */}
        <div className="mb-8 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-[#059669]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Pre-Move-In Checklist
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-2xl">
            Before signing a lease in {cityName}, run a quick due-diligence check on any building.
            See open violations, recent complaints, pest history, reviews, and city-specific risks.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { step: "1", label: "Search your building", desc: "Enter the address of the apartment you're considering." },
            { step: "2", label: "Review the checklist", desc: "See pass/warn/fail indicators across key risk factors." },
            { step: "3", label: "Ask the right questions", desc: "Use the results to negotiate or walk away." },
          ].map((s) => (
            <div key={s.step} className="bg-white border border-[#e2e8f0] rounded-xl p-4">
              <div className="w-7 h-7 rounded-full bg-[#0F1D2E] text-white text-sm font-bold flex items-center justify-center mb-2">
                {s.step}
              </div>
              <p className="text-sm font-semibold text-[#0F1D2E] mb-1">{s.label}</p>
              <p className="text-xs text-[#64748b]">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-[#0F1D2E] mb-4">
            Search a {cityName} Building
          </h2>
          <ChecklistSearch city={city} />
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-[#94a3b8] mt-6 text-center">
          Data is sourced from public records and may not reflect the current state of the building. Always visit in person and consult a tenant attorney before signing a lease.
        </p>
      </div>
    </AdSidebar>
  );
}
