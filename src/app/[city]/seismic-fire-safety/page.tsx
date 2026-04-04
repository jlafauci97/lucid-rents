import Link from "next/link";
import type { Metadata } from "next";
import {
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
import { HazardMap } from "@/components/hazards/HazardMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  return {
    title: `Seismic & Fire Zones — ${cityName} | Lucid Rents`,
    description: `Explore earthquake fault zones, liquefaction risk, fire hazard severity zones, and landslide areas on an interactive map for ${cityName} rental buildings.`,
  };
}

interface HazardSection {
  icon: typeof Zap;
  title: string;
  color: string;
  what: string;
  risk: string;
  source: string;
  sourceUrl: string;
}

const HAZARD_SECTIONS: HazardSection[] = [
  {
    icon: Zap,
    title: "Earthquake Fault Zones",
    color: "bg-red-50 text-red-600 border-red-200",
    what: "Alquist-Priolo Earthquake Fault Zones are areas where surface fault rupture is most likely during an earthquake. California law requires special geological investigations before new construction.",
    risk: "Buildings on a fault trace face the highest ground rupture risk. The ground itself can shift and split along the fault line during a major earthquake.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::alquist-priolo-earthquake-fault-zones",
  },
  {
    icon: Waves,
    title: "Liquefaction Zones",
    color: "bg-amber-50 text-amber-600 border-amber-200",
    what: "Areas where soil can behave like liquid during strong earthquake shaking, typically in loose, sandy soil with a high water table.",
    risk: "Buildings can sink, tilt, or shift. Underground utilities are especially vulnerable. Older buildings without modern foundation engineering face the highest risk.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::liquefaction",
  },
  {
    icon: Mountain,
    title: "Landslide Zones",
    color: "bg-orange-50 text-orange-600 border-orange-200",
    what: "Hillside areas where previous landslides occurred or where conditions make landslides likely during earthquakes or heavy rain.",
    risk: "Earth movement can damage foundations, retaining walls, and utilities. Heavy rain compounds earthquake-related landslide risk.",
    source: "California Geological Survey & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::earthquake-induced-landslides",
  },
  {
    icon: Flame,
    title: "Very High Fire Hazard Severity Zones",
    color: "bg-red-50 text-red-600 border-red-200",
    what: "Areas designated by CAL FIRE where the wildfire threat is most severe based on vegetation, terrain, weather, and fire history.",
    risk: "Highest wildfire risk in the city. Evacuation may be mandatory during fire events. Insurance costs are significantly higher, and some insurers may refuse coverage.",
    source: "CAL FIRE & LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/datasets/lahub::very-high-fire-hazard-severity-zones",
  },
  {
    icon: Wind,
    title: "High Wind Velocity Areas",
    color: "bg-sky-50 text-sky-600 border-sky-200",
    what: "Zones prone to sustained strong winds, particularly during Santa Ana events. Buildings must meet enhanced structural and fire-resistance standards.",
    risk: "High winds accelerate wildfire spread and can cause structural damage, downed trees, and power outages. Wind-driven embers can travel over a mile ahead of a fire front.",
    source: "LA City GeoHub",
    sourceUrl: "https://geohub.lacity.org/",
  },
];

export default async function SeismicFireZonesPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  if (city !== "los-angeles") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0F1D2E] mb-2">Coming Soon</h1>
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
      {/* Hero — compact */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Seismic & Fire Zones
            </h1>
          </div>
          <p className="text-gray-300 leading-relaxed max-w-3xl">
            Explore officially designated earthquake, fire, and geological
            hazard zones across Los Angeles. Toggle layers to see which areas
            fall within each zone.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Map — primary content */}
        <section className="mb-12">
          <HazardMap />
        </section>

        {/* Zone explainers in a compact grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            What These Zones Mean
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {HAZARD_SECTIONS.map((hazard) => {
              const Icon = hazard.icon;
              return (
                <div
                  key={hazard.title}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-5"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${hazard.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0F1D2E]">
                      {hazard.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">
                    {hazard.what}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">
                    <span className="font-semibold text-[#0F1D2E]">Risk: </span>
                    {hazard.risk}
                  </p>
                  <a
                    href={hazard.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                  >
                    {hazard.source}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              );
            })}

            {/* Soft-Story card */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-teal-50 text-teal-600 border-teal-200">
                  <Home className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#0F1D2E]">
                  Soft-Story Retrofit
                </h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                LA&apos;s Mandatory Retrofit Program requires ~13,500 pre-1978
                wood-frame buildings with weak ground floors to be seismically
                strengthened.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                <span className="font-semibold text-[#0F1D2E]">Risk: </span>
                Soft-story buildings are among the most vulnerable in
                earthquakes. The weak ground floor can collapse, causing upper
                floors to pancake.
              </p>
              <a
                href="https://www.ladbs.org/services/core-services/plan-check-permit/mandatory-retrofit-programs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
              >
                LADBS Retrofit Program
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Tenant rights around retrofits — compact */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
            Your Rights During Seismic Retrofit
          </h2>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Landlords may pass through up to 50% of retrofit costs to RSO tenants, only with LAHD approval.",
                "Monthly pass-through increases are capped and spread over the useful life of the improvement.",
                "You must receive relocation assistance if temporarily displaced during retrofit work.",
                "You have the right to return to your unit at the same rent after retrofit work is complete.",
                "Landlords cannot use retrofit work as a pretext for eviction.",
                "Contact LAHD at (866) 557-7368 if your landlord violates these protections.",
              ].map((right) => (
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
        </section>

        {/* Preparedness + Emergency — side by side */}
        <section className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preparedness */}
          <div>
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
              Renter Preparedness
            </h2>
            <div className="space-y-3">
              {[
                {
                  title: "Earthquake Kit",
                  text: "Keep 3 days of water, food, flashlight, first-aid kit, and battery radio. Store shoes and a flashlight near your bed.",
                },
                {
                  title: "Renter\u2019s Insurance",
                  text: "Your landlord\u2019s insurance doesn\u2019t cover your belongings. Get renter\u2019s insurance with earthquake and fire coverage ($15\u201330/mo).",
                },
                {
                  title: "Know Your Exits",
                  text: "Identify two exits from your unit. Know where gas shutoffs are. Don\u2019t use elevators in earthquakes. Check doors for heat in fires.",
                },
              ].map((tip) => (
                <div
                  key={tip.title}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-4"
                >
                  <h3 className="text-sm font-semibold text-[#0F1D2E] mb-1">
                    {tip.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {tip.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency contacts */}
          <div>
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
              Emergency Contacts
            </h2>
            <div className="space-y-3">
              {[
                {
                  name: "911 — Fire & Police",
                  description: "Immediate emergencies, active fires, structural collapse",
                  phone: "911",
                },
                {
                  name: "311 — LA City Services",
                  description: "Building safety concerns, code violations, non-emergency hazards",
                  phone: "311",
                },
                {
                  name: "LADBS Building Safety",
                  description: "Retrofit status inquiries, building inspections, permits",
                  phone: "(213) 482-0480",
                },
                {
                  name: "NotifyLA Alerts",
                  description: "Real-time emergency alerts for your neighborhood",
                  phone: "(213) 484-4060",
                },
              ].map((contact) => (
                <div
                  key={contact.name}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-start gap-3"
                >
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0F1D2E]">
                      {contact.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {contact.description}
                    </p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-block mt-1 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>
              ))}
            </div>
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
                California Geological Survey, and CAL FIRE databases. Zone
                designations indicate elevated risk — they do not guarantee a
                specific event will or will not occur. This is not a
                professional geological or fire zone assessment.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
