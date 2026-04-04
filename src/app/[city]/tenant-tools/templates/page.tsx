import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { TEMPLATES, TEMPLATE_CATEGORIES, CATEGORY_COLORS } from "@/lib/tenant-templates-data";
import { TemplateCard } from "@/components/tenant-tools/TemplateCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";
  const canonical = canonicalUrl(cityPath("/tenant-tools/templates", city as City));
  return {
    title: `${cityName} Tenant Letter Templates | Lucid Rents`,
    description: `Free downloadable tenant letter templates for ${cityName} renters — rent reduction requests, repair notices, security deposit demands, lease negotiations, and more.`,
    alternates: { canonical },
    openGraph: {
      title: `${cityName} Tenant Letter Templates | Lucid Rents`,
      description: `Free professional letter templates for ${cityName} tenants. Know your rights and put them in writing.`,
      url: canonical,
      siteName: "Lucid Rents",
    },
  };
}

export default async function TemplatesPage({
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
    { label: "Letter Templates", href: cityPath("/tenant-tools/templates", city as City) },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={breadcrumbs} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-3">
              <FileText className="w-4 h-4" />
              Tenant Letter Templates
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {cityName} Tenant Letter Templates
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              Free, professional letter templates for renters. Fill in your details, preview the letter instantly, and copy or print — no account required.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Category filter info */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span className="text-sm font-medium text-gray-500">{TEMPLATES.length} templates:</span>
          {TEMPLATE_CATEGORIES.map((cat) => {
            const c = CATEGORY_COLORS[cat];
            const count = TEMPLATES.filter((t) => t.category === cat).length;
            return (
              <span
                key={cat}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}
              >
                {cat} ({count})
              </span>
            );
          })}
        </div>

        {/* Templates grid by category */}
        {TEMPLATE_CATEGORIES.map((category) => {
          const categoryTemplates = TEMPLATES.filter((t) => t.category === category);
          if (categoryTemplates.length === 0) return null;
          return (
            <section key={category} className="mb-12">
              <h2 className="text-xl font-bold text-[#1A1F36] mb-5">{category} Letters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {categoryTemplates.map((template) => (
                  <TemplateCard key={template.slug} template={template} city={city} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mt-4">
          <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            These templates are provided for informational purposes only and do not constitute legal advice. Tenant laws vary by city, lease terms, and individual circumstances. For legal advice specific to your situation, contact a qualified tenant rights attorney or a free legal aid organization in {cityName}.
          </p>
        </div>
      </div>
    </div>
  );
}
