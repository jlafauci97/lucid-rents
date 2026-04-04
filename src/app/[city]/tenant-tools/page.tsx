import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  ClipboardCheck,
  Calculator,
  Scale,
  ShieldCheck,
  ArrowRight,
  Wrench,
  DollarSign,
  ShieldAlert,
  Flame,
  Bug,
  Ban,
} from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { TEMPLATES } from "@/lib/tenant-templates-data";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";
  const canonical = canonicalUrl(cityPath("/tenant-tools", city as City));
  return {
    title: `${cityName} Tenant Tools | Lucid Rents`,
    description: `Free tenant tools for ${cityName} renters — downloadable letter templates, pre-move-in checklists, rent affordability calculator, and more.`,
    alternates: { canonical },
    openGraph: {
      title: `${cityName} Tenant Tools | Lucid Rents`,
      description: `Everything you need as a ${cityName} renter — for free.`,
      url: canonical,
      siteName: "Lucid Rents",
    },
  };
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench,
  DollarSign,
  FileText,
  ShieldAlert,
  Flame,
  Bug,
  Ban,
  ShieldCheck,
};

const TOOL_CARDS = [
  {
    href: "/tenant-tools/templates",
    icon: FileText,
    label: "Letter Templates",
    description:
      "8 free, professional letter templates — rent reduction requests, repair notices, security deposit demands, and more. Fill in your details and download instantly.",
    badge: `${TEMPLATES.length} Templates`,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    cta: "Browse Templates",
  },
  {
    href: "/tenant-tools/checklist",
    icon: ClipboardCheck,
    label: "Pre-Move-In Checklist",
    description:
      "Search any building and get a comprehensive due-diligence checklist before you sign a lease — violations, permits, pest history, rent stabilization status, and more.",
    badge: "Live Data",
    badgeColor: "bg-green-50 text-green-700 border-green-200",
    cta: "Check a Building",
  },
  {
    href: "/rent-affordability-calculator",
    icon: Calculator,
    label: "Rent Affordability Calculator",
    description:
      "Find out how much rent you can afford based on your income, expenses, and savings goals. Includes the 30% rule and debt-to-income analysis.",
    badge: "Free Tool",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    cta: "Calculate My Rent",
    global: true,
  },
  {
    href: "/tenant-rights",
    icon: Scale,
    label: "Tenant Rights Guide",
    description:
      "Know your legal rights as a renter — from lease renewals and eviction protections to habitability standards and security deposit rules.",
    badge: "Legal Guide",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    cta: "Read the Guide",
  },
  {
    href: "/rent-stabilization",
    icon: ShieldCheck,
    label: "Rent Stabilization Checker",
    description:
      "Check if a building is rent stabilized or under local rent control protections. Knowing your status can save you thousands.",
    badge: "Lookup Tool",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    cta: "Check a Building",
  },
];

// Featured templates for the hub page preview
const FEATURED_TEMPLATE_SLUGS = [
  "repair-maintenance-request",
  "rent-reduction-request",
  "security-deposit-demand",
  "heat-hot-water-complaint",
];

export default async function TenantToolsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta?.name ?? city, href: cityPath("", city as City) },
    { label: "Tenant Tools", href: cityPath("/tenant-tools", city as City) },
  ];

  const featuredTemplates = TEMPLATES.filter((t) =>
    FEATURED_TEMPLATE_SLUGS.includes(t.slug)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={breadcrumbs} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-3">
              <Wrench className="w-4 h-4" />
              Tenant Tools
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {cityName} Tenant Tools
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              Everything you need to rent smarter in {cityName}. Free tools, templates, and guides — no sign-up required.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Tools grid */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">All Tenant Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOL_CARDS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.global ? tool.href : cityPath(tool.href, city as City)}
                className="group bg-white rounded-xl border border-[#e2e8f0] hover:shadow-md hover:border-[#cbd5e1] transition-all p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#0F1D2E] text-blue-400">
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tool.badgeColor}`}
                  >
                    {tool.badge}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#0F1D2E] mb-2 group-hover:text-[#3B82F6] transition-colors">
                  {tool.label}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{tool.description}</p>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] group-hover:gap-2.5 transition-all">
                  {tool.cta}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured templates preview */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-[#0F1D2E]">Popular Letter Templates</h2>
              <p className="text-gray-500 text-sm mt-1">
                Free, ready-to-use letters for the most common tenant situations in {cityName}.
              </p>
            </div>
            <Link
              href={cityPath("/tenant-tools/templates", city as City)}
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors whitespace-nowrap"
            >
              View all {TEMPLATES.length}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featuredTemplates.map((template) => {
              const Icon = ICON_MAP[template.iconName] ?? FileText;
              return (
                <Link
                  key={template.slug}
                  href={cityPath(`/tenant-tools/templates/${template.slug}`, city as City)}
                  className="group bg-white rounded-xl border border-[#e2e8f0] hover:shadow-md hover:border-[#cbd5e1] transition-all p-5 flex items-center gap-4"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors truncate">
                      {template.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{template.category} Letter</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#3B82F6] flex-shrink-0 transition-colors" />
                </Link>
              );
            })}
          </div>
          <div className="mt-4 sm:hidden text-center">
            <Link
              href={cityPath("/tenant-tools/templates", city as City)}
              className="text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
            >
              View all {TEMPLATES.length} templates →
            </Link>
          </div>
        </section>

        {/* CTA: Know your rights */}
        <section className="bg-[#0F1D2E] rounded-2xl p-8 md:p-10 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <Scale className="w-8 h-8 text-blue-400 mb-3" />
            <h2 className="text-xl font-bold mb-2">Know Your Rights in {cityName}</h2>
            <p className="text-gray-300 text-sm leading-relaxed max-w-lg">
              Before you use these tools, read our {cityName} Tenant Rights Guide — understand what your landlord can and cannot do.
            </p>
          </div>
          <Link
            href={cityPath("/tenant-rights", city as City)}
            className="flex-shrink-0 px-6 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-full text-sm transition-colors whitespace-nowrap"
          >
            Read the Guide
          </Link>
        </section>
      </div>
    </div>
  );
}
