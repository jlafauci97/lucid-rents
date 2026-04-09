import type { Metadata } from "next";
import Link from "next/link";
import { Users, ShieldCheck, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, cityPath, cityBreadcrumbs, breadcrumbJsonLd, landlordUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQSection } from "@/components/seo/FAQSection";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { rankLandlords, type LandlordGrade } from "@/lib/landlord-stats";
import { LandlordRankingTable } from "@/components/landlord/LandlordRankingTable";

export const revalidate = 3600;

const GRADE_SCORES: Record<LandlordGrade, number> = {
  A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.5,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const url = canonicalUrl(cityPath("/landlords/worst", city));
  return {
    title: `Worst Landlords in ${meta.fullName} (2026) | Lucid Rents`,
    description: `Ranked list of the worst and best landlords in ${meta.fullName}. See grades, violations, and portfolio scores for every landlord.`,
    alternates: { canonical: url },
    openGraph: {
      title: `Worst Landlords in ${meta.fullName} — Ranked by Grade`,
      description: `Find the worst and best landlords in ${meta.fullName}. Data-driven landlord rankings updated hourly.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function WorstLandlordsPage({
  params: routeParams,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await routeParams;
  if (!isValidCity(cityParam)) return null;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const supabase = await createClient();

  const { data: rawLandlords } = await supabase
    .from("landlord_stats")
    .select(
      "name, slug, building_count, total_violations, total_complaints, total_litigations, total_dob_violations, avg_score, worst_building_address, worst_building_violations"
    )
    .eq("metro", city)
    .order("total_violations", { ascending: false })
    .limit(500);

  const landlords = rawLandlords || [];
  const ranked = rankLandlords(landlords);

  const top10Best = ranked.slice(0, 10);
  const top10Worst = [...ranked].reverse().slice(0, 10);

  // Breadcrumbs
  const bcItems = cityBreadcrumbs(
    city,
    { label: "Landlord Directory", href: cityPath("/landlords", city) },
    { label: "Worst Landlords", href: cityPath("/landlords/worst", city) }
  );

  // ItemList JSON-LD for rich results
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Worst Landlords in ${meta.fullName}`,
    numberOfItems: ranked.length,
    itemListElement: top10Worst.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: l.name,
      url: canonicalUrl(landlordUrl(l.name, city)),
    })),
  };

  // FAQ items
  const faqItems = [
    {
      question: `Who are the worst landlords in ${meta.fullName}?`,
      answer: `The worst landlords in ${meta.fullName} are those ranked at the bottom of our portfolio score system with F grades. These landlords have the highest violation counts and lowest average building scores across their portfolios. Check the rankings above for the latest list.`,
    },
    {
      question: "How are landlord rankings determined?",
      answer: `Landlord rankings are based on a percentile system using each landlord's average building score across their portfolio. Landlords in the top 20th percentile receive an A grade, while those in the bottom 20th percentile receive an F. Scores factor in violations, complaints, and litigation history.`,
    },
    {
      question: "Should I avoid renting from an F-rated landlord?",
      answer: `We strongly recommend tenants consider alternatives before renting from an F-rated landlord. F-rated landlords have significantly higher violation counts and complaint rates than average. Always review specific building data, check open violations, and read tenant reviews before signing a lease.`,
    },
    {
      question: "Can landlord grades change over time?",
      answer: `Yes. Landlord grades are updated hourly as new violation, complaint, and litigation data arrives. A landlord who addresses violations and improves building conditions will see their grade improve over time. Check back regularly for the latest rankings.`,
    },
    {
      question: `How can I report a bad landlord in ${meta.fullName}?`,
      answer: `You can report housing issues to your city's housing authority. In New York City, file complaints with HPD at hpd.nyc.gov or call 311. In Los Angeles, contact LAHD at hcidla.lacity.org. In Chicago, contact the Department of Buildings. In Miami and Houston, contact your local code enforcement office or call 311.`,
    },
  ];

  // Empty state
  if (ranked.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={bcItems} />
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl mt-6">
          <Users className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">
            Landlord data is not yet available for {meta.fullName}. Check back
            soon.
          </p>
        </div>
      </div>
    );
  }

  const cityPathPrefix = `/${meta.urlPrefix}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Structured data */}
      <JsonLd data={itemListJsonLd} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={bcItems} />

      {/* Header */}
      <div className="mb-8 mt-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Worst &amp; Best Landlords in {meta.fullName}
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          {ranked.length} landlords ranked in {meta.fullName} &bull; Updated hourly
        </p>
      </div>

      {/* Top 10 Best Landlords */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Best Landlords</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {top10Best.map((l) => (
            <Link
              key={l.slug}
              href={landlordUrl(l.name, city)}
              className="block bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <LetterGrade score={GRADE_SCORES[l.grade]} size="sm" />
                <span className="text-xs font-mono text-[#64748b]">#{l.rank}</span>
              </div>
              <p className="text-sm font-semibold text-[#0F1D2E] truncate">{l.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#64748b]">{l.building_count} buildings</span>
                <span className="text-xs text-[#64748b]">{l.total_violations.toLocaleString()} violations</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Full Ranking Table */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
          Full Landlord Ranking
        </h2>
        <LandlordRankingTable rows={ranked} cityPathPrefix={cityPathPrefix} />
      </section>

      {/* Top 10 Worst Landlords */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Worst Landlords</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {top10Worst.map((l) => (
            <Link
              key={l.slug}
              href={landlordUrl(l.name, city)}
              className="block bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <LetterGrade score={GRADE_SCORES[l.grade]} size="sm" />
                <span className="text-xs font-mono text-[#64748b]">#{l.rank}</span>
              </div>
              <p className="text-sm font-semibold text-[#0F1D2E] truncate">{l.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[#64748b]">{l.building_count} buildings</span>
                <span className="text-xs text-[#64748b]">{l.total_violations.toLocaleString()} violations</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQSection items={faqItems} />

      {/* Related Links */}
      <section className="mt-10 pt-8 border-t border-[#e2e8f0]">
        <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wide mb-4">
          Related
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={cityPath("/landlords", city)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] hover:shadow-sm transition-shadow"
          >
            <Users className="w-4 h-4 text-[#6366F1]" />
            Landlord Directory
          </Link>
          <Link
            href={cityPath("/buildings/worst-rated", city)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] hover:shadow-sm transition-shadow"
          >
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            Worst Rated Buildings
          </Link>
          <Link
            href={cityPath("/crime/safest", city)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#0F1D2E] hover:shadow-sm transition-shadow"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Safest Neighborhoods
          </Link>
        </div>
      </section>
    </div>
  );
}
