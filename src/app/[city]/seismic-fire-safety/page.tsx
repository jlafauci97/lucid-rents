import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ShieldAlert,
  Flame,
  Mountain,
  Waves,
  Wind,
  Zap,
  Home,
  ExternalLink,
  AlertTriangle,
  Phone,
} from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  return {
    title: `Seismic & Fire Zones Guide — ${cityName} | Lucid Rents`,
    description: `Understand earthquake fault zones, liquefaction risk, fire hazard severity zones, and soft-story retrofit status for ${cityName} rental buildings.`,
  };
}

interface HazardSection {
  icon: typeof Zap;
  title: string;
  color: string;
  what: string;
  risk: string;
  lookFor: string;
  source: string;
  sourceUrl: string;
}

const HAZARD_SECTIONS: HazardSection[] = [
  {
    icon: Zap,
    title: "Earthquake Fault Zones",
    color: "bg-red-50 text-red-600 border-red-200",
    what: "Alquist-Priolo Earthquake Fault Zones are areas where surface fault rupture is most likely during an earthquake. California law requires special geological investigations before buildings can be constructed in these zones.",
    risk: "Buildings directly on a fault trace face the highest ground rupture risk. During a major earthquake, the ground itself can shift and split along the fault line, causing severe structural damage even to well-built structures.",
    lookFor: "Ask if the building had a fault investigation before construction. Buildings constructed after 1972 in these zones should have had a geologic study on file with LADBS.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::alquist-priolo-earthquake-fault-zones",
  },
  {
    icon: Waves,
    title: "Liquefaction Zones",
    color: "bg-amber-50 text-amber-600 border-amber-200",
    what: "Liquefaction zones are areas where the soil can behave like a liquid during strong earthquake shaking. This typically occurs in areas with loose, sandy soil and a high water table.",
    risk: "During shaking, the ground can lose its ability to support structures, causing buildings to sink, tilt, or shift. Underground utilities (water, gas, sewer) are especially vulnerable. The risk is highest in older buildings without modern foundation engineering.",
    lookFor: "Buildings in liquefaction zones should ideally have deep foundations or other engineering measures. Ask if a geotechnical report was done for the property.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::liquefaction",
  },
  {
    icon: Mountain,
    title: "Landslide Zones",
    color: "bg-orange-50 text-orange-600 border-orange-200",
    what: "Earthquake-induced landslide zones identify hillside areas where previous landslides have occurred or where conditions (steep slopes, weak soil, rainfall) make landslides likely during earthquakes or heavy rain.",
    risk: "Hillside properties face risks from earth movement that can damage foundations, retaining walls, and utilities. Heavy rain seasons compound earthquake-related landslide risk. Evacuation may be necessary during high-risk periods.",
    lookFor: "Check if the building has proper drainage systems, retaining walls, and hillside anchoring. Hillside construction permits require additional engineering review through LADBS.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::earthquake-induced-landslides",
  },
  {
    icon: Flame,
    title: "Very High Fire Hazard Severity Zone",
    color: "bg-red-50 text-red-600 border-red-200",
    what: "Very High Fire Hazard Severity Zones (VHFHSZ) are areas designated by CAL FIRE and adopted by the City of LA where the wildfire threat is the most severe based on vegetation, terrain, weather, and fire history.",
    risk: "Properties in VHFHSZ face the highest wildfire risk in the city. During fire events, evacuation may be mandatory and response times may be longer. Insurance costs are typically significantly higher, and some insurers may refuse coverage entirely.",
    lookFor: "Buildings should maintain 200 feet of defensible space (brush clearance). Check if the building has fire-resistant roofing, enclosed eaves, and dual-pane windows. LAFD inspects brush clearance compliance annually.",
    source: "CAL FIRE & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::very-high-fire-hazard-severity-zones",
  },
  {
    icon: Wind,
    title: "High Wind Velocity Areas",
    color: "bg-sky-50 text-sky-600 border-sky-200",
    what: "High wind velocity areas are zones prone to sustained strong winds, particularly during Santa Ana wind events. Buildings in these areas must meet enhanced structural and fire-resistance standards.",
    risk: "High winds accelerate wildfire spread and can cause structural damage, downed trees, and power outages. During Santa Ana events, fire risk in these zones escalates dramatically. Wind-driven embers can travel over a mile ahead of a fire front.",
    lookFor: "Buildings should have impact-resistant windows or shutters and secured roofing. Check that trees near the building are properly maintained and that balconies or patios are clear of combustible materials.",
    source: "LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/",
  },
];

const SOFT_STORY_SECTION = {
  icon: Home,
  title: "Soft-Story Retrofit Program",
  color: "bg-teal-50 text-teal-600 border-teal-200",
  what: "LA's Mandatory Soft-Story Retrofit Program (Ordinance 183893) requires owners of pre-1978 wood-frame buildings with soft, weak, or open-front ground floors to seismically strengthen them. About 13,500 buildings are in the program.",
  risk: "Soft-story buildings are among the most vulnerable during earthquakes. The weak ground floor (often a parking garage or commercial space) can collapse, causing upper floors to pancake down. This was a leading cause of deaths in the 1994 Northridge earthquake.",
  lookFor: "Check the building's retrofit status on Lucid Rents. Buildings should show 'Retrofitted' or have an active retrofit permit. If the status is unknown or the building hasn't been retrofitted, ask your landlord about the timeline.",
  tenantRights: [
    "Landlords may pass through up to 50% of retrofit costs to tenants, but only for RSO units and only with LAHD approval.",
    "Monthly pass-through increases are capped and spread over the useful life of the improvement.",
    "If you must temporarily relocate during retrofit work, your landlord must provide relocation assistance.",
    "You have the right to return to your unit at the same rent after retrofit work is complete.",
    "Landlords cannot use retrofit work as a pretext for eviction.",
  ],
  source: "LADBS Soft-Story Retrofit Program",
  sourceUrl: "https://www.ladbs.org/services/core-services/plan-check-permit/mandatory-retrofit-programs",
};

export default async function SeismicFireSafetyPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  // Only meaningful for LA currently
  if (city !== "los-angeles") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0F1D2E] mb-2">
            Coming Soon
          </h1>
          <p className="text-sm text-[#64748b] max-w-md">
            Seismic and fire zone data is currently available for Los Angeles.
            We&apos;re working on expanding to other cities.
          </p>
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-block mt-6 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            &larr; Back to Tenant Rights
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenant Rights
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Seismic & Fire Zones Guide
            </h1>
          </div>
          <p className="text-gray-300 leading-relaxed max-w-3xl">
            Los Angeles faces unique natural hazards — from earthquake fault
            lines to wildfire zones. Every building on Lucid Rents is checked
            against official LA City hazard maps so you can understand the risks
            before you sign a lease.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* How We Check Section */}
        <section className="mb-12">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-3">
              How Lucid Rents Checks Hazard Zones
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              For every LA building, we query the official LA City GeoHub and
              California state databases using the building&apos;s exact
              coordinates. We check five hazard zone layers — earthquake faults,
              liquefaction, landslides, fire severity, and high winds — plus the
              LADBS soft-story retrofit status. Results appear on each
              building&apos;s profile page.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { count: "5", label: "Hazard Layers" },
                { count: "13.5K", label: "Soft-Story Buildings" },
                { count: "24h", label: "Data Refresh" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#F8FAFC] rounded-lg px-4 py-3 text-center"
                >
                  <div className="text-lg font-bold text-[#0F1D2E]">
                    {stat.count}
                  </div>
                  <div className="text-xs text-[#64748b]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Hazard Zone Sections */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            Hazard Zones Explained
          </h2>
          <div className="space-y-6">
            {HAZARD_SECTIONS.map((hazard) => {
              const Icon = hazard.icon;
              return (
                <div
                  key={hazard.title}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${hazard.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0F1D2E]">
                      {hazard.title}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                        What is it?
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {hazard.what}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                        What&apos;s the risk?
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {hazard.risk}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                        What to look for
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {hazard.lookFor}
                      </p>
                    </div>
                    <a
                      href={hazard.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                    >
                      {hazard.source}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Soft-Story Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            Soft-Story Retrofit Program
          </h2>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${SOFT_STORY_SECTION.color}`}
              >
                <Home className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#0F1D2E]">
                {SOFT_STORY_SECTION.title}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                  What is it?
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {SOFT_STORY_SECTION.what}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                  What&apos;s the risk?
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {SOFT_STORY_SECTION.risk}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                  What to look for
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {SOFT_STORY_SECTION.lookFor}
                </p>
              </div>

              {/* Tenant Rights */}
              <div>
                <h4 className="text-sm font-semibold text-[#0F1D2E] mb-2">
                  Your rights as a tenant
                </h4>
                <ul className="space-y-2">
                  {SOFT_STORY_SECTION.tenantRights.map((right) => (
                    <li
                      key={right}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <ShieldAlert className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                      {right}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={SOFT_STORY_SECTION.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
              >
                {SOFT_STORY_SECTION.source}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Preparedness Tips */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            Renter Preparedness Tips
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                title: "Earthquake Kit",
                text: "Keep 3 days of water (1 gallon per person per day), non-perishable food, flashlight, first-aid kit, and a battery-powered radio. Store a pair of shoes and a flashlight near your bed.",
              },
              {
                title: "Renter's Insurance",
                text: "Your landlord's insurance does not cover your belongings. Get renter's insurance that includes earthquake and fire coverage — it's typically $15–30/month and covers temporary housing if you're displaced.",
              },
              {
                title: "Know Your Exits",
                text: "Identify two exits from your unit and your building. Know where gas shutoff valves are located. In an earthquake, do not use elevators. In a fire, check doors for heat before opening.",
              },
              {
                title: "Emergency Contacts",
                text: "Save LAFD (911), the Red Cross disaster line (800-733-2767), and your building manager's number. Register for NotifyLA alerts for real-time emergency notifications.",
              },
            ].map((tip) => (
              <div
                key={tip.title}
                className="bg-white rounded-xl border border-[#e2e8f0] p-6"
              >
                <h3 className="font-semibold text-[#0F1D2E] mb-2">
                  {tip.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {tip.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency Contacts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-2">
            Emergency Contacts
          </h2>
          <p className="text-gray-500 mb-6">
            Key numbers for emergencies, hazard questions, and building safety.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                name: "911 — Fire & Police",
                description: "Immediate life-threatening emergencies, active fires, or structural collapse",
                phone: "911",
              },
              {
                name: "311 — LA City Services",
                description: "Report building safety concerns, code violations, and non-emergency hazards",
                phone: "311",
              },
              {
                name: "LADBS Building Safety",
                description: "Building inspection requests, retrofit status inquiries, and permit questions",
                phone: "(213) 482-0480",
              },
              {
                name: "NotifyLA Alerts",
                description: "Sign up for real-time emergency alerts for your neighborhood",
                phone: "(213) 484-4060",
              },
            ].map((contact) => (
              <div
                key={contact.name}
                className="bg-white rounded-xl border border-[#e2e8f0] p-6 flex items-start gap-4"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F1D2E]">
                    {contact.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {contact.description}
                  </p>
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-block mt-2 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                  >
                    {contact.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                Hazard zone data is sourced from official LA City GeoHub,
                California Geological Survey, CAL FIRE, and LADBS databases.
                Zone designations indicate areas of elevated risk based on
                geological and environmental factors — they do not guarantee that
                a specific event will or will not occur at any location. This
                guide is for informational purposes only and is not a
                professional geological or fire zone assessment. For specific
                concerns about a building, consult a licensed engineer or contact
                LADBS.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
