import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { TENANT_RIGHTS_BY_CITY } from "@/lib/tenant-rights-data";
import { CITY_META, type City } from "@/lib/cities";
import { FAQSection } from "@/components/seo/FAQSection";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cityBreadcrumbs, canonicalUrl, cityPath } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; topic: string }>;
}): Promise<Metadata> {
  const { city, topic: slug } = await params;
  const config = TENANT_RIGHTS_BY_CITY[city];
  if (!config) return { title: "Not Found" };
  const topic = config.topics[slug];
  if (!topic) return { title: "Not Found" };
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? city;
  const title = `${topic.title} — ${cityName} Tenant Rights | Lucid Rents`;
  const description = topic.summary;
  const url = canonicalUrl(cityPath(`/tenant-rights/${slug}`, city as City));
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

export default async function TopicPage({
  params,
}: {
  params: Promise<{ city: string; topic: string }>;
}) {
  const { city, topic: slug } = await params;
  const config = TENANT_RIGHTS_BY_CITY[city];
  if (!config) notFound();

  const topic = config.topics[slug];
  if (!topic) notFound();

  const Icon = topic.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Breadcrumbs
            items={cityBreadcrumbs(
              city as City,
              { label: "Tenant Rights", href: cityPath("/tenant-rights", city as City) },
              { label: topic.title, href: cityPath(`/tenant-rights/${slug}`, city as City) }
            )}
            variant="dark"
          />
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6 mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenant Rights
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{topic.title}</h1>
          </div>
          <p className="text-gray-300 leading-relaxed max-w-3xl">
            {topic.summary}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Sections */}
        <div className="space-y-8 mb-12">
          {topic.sections.map((section) => (
            <section
              key={section.heading}
              className="bg-white rounded-xl border border-[#E2E8F0] p-6 sm:p-8"
            >
              <h2 className="text-xl font-bold text-[#1A1F36] mb-3">
                {section.heading}
              </h2>
              <p className="text-gray-600 leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>

        {/* Do's and Don'ts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-6">
            Do&apos;s & Don&apos;ts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-emerald-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-emerald-700 mb-4">
                <CheckCircle2 className="w-5 h-5" />
                Do
              </h3>
              <ul className="space-y-3">
                {topic.dosAndDonts.do.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 mb-4">
                <XCircle className="w-5 h-5" />
                Don&apos;t
              </h3>
              <ul className="space-y-3">
                {topic.dosAndDonts.dont.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-6">
            Helpful Resources
          </h2>
          <div className="bg-white rounded-xl border border-[#E2E8F0] divide-y divide-[#e2e8f0]">
            {topic.resources.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-[#1A1F36]">
                  {resource.name}
                </span>
                <span className="text-xs text-[#6366F1]">Visit &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* Helpline */}
        {topic.helpline && (
          <section className="mb-12">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4">
              <Phone className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Need Help? Call {topic.helpline.name}
                </h3>
                <a
                  href={`tel:${topic.helpline.phone}`}
                  className="text-lg font-bold text-[#6366F1] hover:text-[#4F46E5] transition-colors"
                >
                  {topic.helpline.phone}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {topic.faq && topic.faq.length > 0 && (
          <section className="mb-12">
            <FAQSection items={topic.faq} />
          </section>
        )}

        {/* Disclaimer */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                This guide is for informational purposes only and is not legal
                advice. For advice specific to your situation, contact a
                qualified attorney or one of the free legal services listed
                above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
