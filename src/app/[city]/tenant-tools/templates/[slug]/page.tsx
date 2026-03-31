import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { TEMPLATES, getCityAgency, CATEGORY_COLORS } from "@/lib/tenant-templates-data";
import { TemplateViewer } from "@/components/tenant-tools/TemplateViewer";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}): Promise<Metadata> {
  const { city, slug } = await params;
  const template = TEMPLATES.find((t) => t.slug === slug);
  if (!template) return { title: "Template Not Found" };
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";
  const canonical = canonicalUrl(cityPath(`/tenant-tools/templates/${slug}`, city as City));
  return {
    title: `${template.title} — ${cityName} | Lucid Rents`,
    description: `Free ${template.title.toLowerCase()} template for ${cityName} renters. Fill in your details and download or print your letter instantly.`,
    alternates: { canonical },
    openGraph: {
      title: `${template.title} — ${cityName} | Lucid Rents`,
      description: `Free professional letter template for ${cityName} tenants.`,
      url: canonical,
      siteName: "Lucid Rents",
    },
  };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  const { city, slug } = await params;
  const template = TEMPLATES.find((t) => t.slug === slug);
  if (!template) notFound();

  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Your City";
  const cityAgencyName = getCityAgency(city as City);
  const catColors = CATEGORY_COLORS[template.category];

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta?.name ?? city, href: cityPath("", city as City) },
    { label: "Tenant Tools", href: cityPath("/tenant-tools", city as City) },
    { label: "Letter Templates", href: cityPath("/tenant-tools/templates", city as City) },
    { label: template.title, href: cityPath(`/tenant-tools/templates/${slug}`, city as City) },
  ];

  // Structured data: FAQPage with 2 common questions about this letter type
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `When should I use a ${template.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: template.description + " Sending a formal written letter creates an important paper trail and is often required before pursuing legal remedies.",
        },
      },
      {
        "@type": "Question",
        name: `Does a ${template.title} need to be sent by certified mail?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "While not always legally required, sending important tenant letters via certified mail with return receipt provides proof of delivery — which is valuable if the matter goes to court or a housing authority.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Breadcrumbs items={breadcrumbs} />
          <div className="mt-4">
            <Link
              href={cityPath("/tenant-tools/templates", city as City)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              All Templates
            </Link>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                <FileText className="w-4 h-4" />
                {cityName} Tenant Tools
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catColors.bg} ${catColors.text} ${catColors.border}`}
              >
                {template.category}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{template.title}</h1>
            <p className="text-gray-300 text-base leading-relaxed max-w-2xl">
              {template.description} Fill in your details below — the letter updates in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <TemplateViewer
          template={template}
          cityAgencyName={cityAgencyName}
          cityName={cityName}
        />

        {/* Tips section */}
        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
            <h3 className="font-semibold text-[#0F1D2E] mb-2">Send Certified Mail</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Send via USPS certified mail with return receipt so you have proof of delivery — useful if this escalates.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
            <h3 className="font-semibold text-[#0F1D2E] mb-2">Keep a Copy</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Save a dated copy for your records. Print to PDF using "Print / Save PDF" and store it safely.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
            <h3 className="font-semibold text-[#0F1D2E] mb-2">File a Complaint Too</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              For serious issues, also file a complaint with {cityAgencyName} alongside sending this letter.
            </p>
          </div>
        </div>

        {/* More templates */}
        <div className="mt-10 text-center">
          <Link
            href={cityPath("/tenant-tools/templates", city as City)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            View all {cityName} tenant letter templates
          </Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
