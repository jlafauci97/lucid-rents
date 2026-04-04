import Link from "next/link";
import type { Metadata } from "next";
import {
  Scale,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { TENANT_RIGHTS_BY_CITY } from "@/lib/tenant-rights-data";
import { CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cityBreadcrumbs, canonicalUrl, cityPath } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const config = TENANT_RIGHTS_BY_CITY[city];
  if (!config) return { title: "Tenant Rights | Lucid Rents" };
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? city;
  const title = `${cityName} Tenant Rights Guide | Lucid Rents`;
  const description = `Don't let your landlord take advantage of you. Know your rights as a ${cityName} tenant — from rent increases to eviction protections.`;
  const url = canonicalUrl(cityPath("/tenant-rights", city as City));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function TenantRightsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const config = TENANT_RIGHTS_BY_CITY[city];

  if (!config) {
    // Fallback to NYC if city not found — keeps existing behavior
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs
            items={cityBreadcrumbs(city as City, { label: "Tenant Rights", href: cityPath("/tenant-rights", city as City) })}
            variant="dark"
          />
          <div className="max-w-3xl mt-6">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-3">
              <Scale className="w-4 h-4" />
              {config.heroTitle}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {config.heroSubtitle}
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              {config.heroDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Issues Grid */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-2">
            Top Tenant Issues
          </h2>
          <p className="text-gray-500 mb-6">
            Click any topic to learn more about your rights and how to take action.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {config.topIssues.map((issue) => (
              <Link
                key={issue.slug}
                href={`/${city}/tenant-rights/${issue.slug}`}
                className="group bg-white rounded-xl border border-[#E2E8F0] hover:shadow-md hover:border-[#E2E8F0] transition-all p-6"
              >
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${issue.color} mb-4`}
                >
                  <issue.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#1A1F36] mb-2 group-hover:text-[#6366F1] transition-colors">
                  {issue.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {issue.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* General Rights Summary */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-6">
            General Rights Every Tenant Has
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {config.generalRights.map((right) => (
              <div
                key={right.title}
                className="bg-white rounded-xl border border-[#E2E8F0] p-6"
              >
                <h3 className="font-semibold text-[#1A1F36] mb-2">
                  {right.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {right.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency Contacts */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-2">
            Emergency Contacts & Resources
          </h2>
          <p className="text-gray-500 mb-6">
            If you need immediate help with a housing issue, these are the key numbers to call.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {config.emergencyContacts.map((contact) => (
              <div
                key={contact.name}
                className="bg-white rounded-xl border border-[#E2E8F0] p-6 flex items-start gap-4"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1F36]">
                    {contact.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {contact.description}
                  </p>
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-block mt-2 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
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
                This guide is for informational purposes only and is not legal
                advice. Tenant laws can change, and individual situations vary.
                For legal advice specific to your situation, contact a qualified
                attorney or one of the free legal services listed above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
