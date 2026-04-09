import { createClient } from "@/lib/supabase/server";
import { Users, Building2, AlertTriangle, ShieldCheck, ShieldAlert, BarChart3 } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import Link from "next/link";
import { landlordUrl, canonicalUrl, cityPath, cityBreadcrumbs, breadcrumbJsonLd } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQSection } from "@/components/seo/FAQSection";
import { LandlordRankingTable } from "@/components/landlord/LandlordRankingTable";
import { rankLandlords, type LandlordGrade } from "@/lib/landlord-stats";
import type { Metadata } from "next";

export const revalidate = 3600;

const GRADE_SCORES: Record<LandlordGrade, number> = {
  A: 4.5,
  B: 3.5,
  C: 2.5,
  D: 1.5,
  F: 0.5,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const url = canonicalUrl(cityPath("/landlords", city));

  return {
    title: `Landlord Directory | ${meta.fullName} | Lucid Rents`,
    description: `Browse ${meta.fullName} landlords ranked by grade, violations, and portfolio size. Find the best and worst landlords before you rent.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.fullName} Landlord Directory — Grades & Rankings`,
      description: `Browse ${meta.fullName} landlords ranked by grade, violations, and portfolio size. Find the best and worst landlords before you rent.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

interface LandlordsPageProps {
  params: Promise<{ city: string }>;
}

export default async function LandlordsPage({ params: routeParams }: LandlordsPageProps) {
  const { city: cityParam } = await routeParams;
  if (!isValidCity(cityParam)) return null;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const supabase = await createClient();

  const { data: rawLandlords } = await supabase
    .from("landlord_stats")
    .select(
      "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations"
    )
    .eq("metro", city)
    .order("total_violations", { ascending: false })
    .limit(500);

  const landlords = rawLandlords || [];
  const ranked = rankLandlords(landlords);

  // Hero stats
  const totalLandlords = ranked.length;
  const totalBuildings = ranked.reduce((s, l) => s + l.building_count, 0);
  const totalViolations = ranked.reduce((s, l) => s + l.total_violations, 0);
  const avgScore =
    totalLandlords > 0
      ? ranked.reduce((s, l) => s + l.avg_score, 0) / totalLandlords
      : 0;
  const avgViolationsPerBuilding =
    totalBuildings > 0 ? Math.round(totalViolations / totalBuildings) : 0;

  // Grade distribution
  const gradeCount: Record<LandlordGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const l of ranked) gradeCount[l.grade]++;

  // Best (rank 1 = best avg_score) and worst (last in ranked array = lowest avg_score)
  const best5 = ranked.slice(0, 5);
  const worst5 = [...ranked].reverse().slice(0, 5);

  // Breadcrumbs
  const bcItems = cityBreadcrumbs(city, {
    label: "Landlord Directory",
    href: cityPath("/landlords", city),
  });

  const breadcrumbLd = breadcrumbJsonLd(
    bcItems.map((b) => ({ name: b.label, url: b.href }))
  );

  // FAQ
  const faqItems = [
    {
      question: "How are landlord grades calculated?",
      answer:
        "Landlord grades are percentile-based on each landlord's average building score across their portfolio. The top 20% of landlords by average score earn an A, the next 20% a B, and so on down to F for the bottom 20%. This ensures grades reflect relative performance within the city.",
    },
    {
      question: "What does the violations per building metric mean?",
      answer:
        "Violations per building normalizes total violations by portfolio size, making it a fair comparison across landlords of different sizes. A landlord with 5 buildings and 100 violations (20 per building) is flagged more severely than one with 100 buildings and 100 violations (1 per building).",
    },
    {
      question: "How often is landlord data updated?",
      answer:
        "Landlord data is sourced from public city records and refreshed hourly. Violation counts, complaint histories, and building portfolios are updated automatically as new records become available.",
    },
    {
      question: "What should I look for in a landlord's record?",
      answer:
        "Focus on four key signals: total violations (are there many open or hazardous violations?), complaints (do tenants regularly file 311 complaints?), litigations (has this landlord been taken to housing court?), and trend direction (is the record improving or getting worse over time?).",
    },
    {
      question: "What does it mean if a landlord has an F grade?",
      answer:
        "An F grade means the landlord falls in the bottom 20% of all landlords in the city by building quality score. These landlords tend to have the most violations per building and the highest complaint rates. It is a strong warning sign to research their properties carefully before signing a lease.",
    },
  ];

  const cityPathPrefix = cityPath("", city);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Structured data */}
      <JsonLd data={breadcrumbLd} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={bcItems} />

      {/* Header */}
      <div className="mb-8 mt-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Landlord Directory
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          {totalLandlords.toLocaleString()} landlords in {meta.fullName} &bull;{" "}
          {totalBuildings.toLocaleString()} buildings tracked &bull; Updated hourly
        </p>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {/* Total Landlords */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
              Total Landlords
            </span>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalLandlords.toLocaleString()}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">
            {totalBuildings.toLocaleString()} buildings
          </p>
        </div>

        {/* Average Score */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
              Average Score
            </span>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {avgScore.toFixed(1)}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">across all landlords</p>
        </div>

        {/* Avg Violations / Building */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
              Avg Violations/Bldg
            </span>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {avgViolationsPerBuilding}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">
            {totalViolations.toLocaleString()} total violations
          </p>
        </div>

        {/* Grade Distribution */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
              Grade Distribution
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(["A", "B", "C", "D", "F"] as LandlordGrade[]).map((g) => (
              <span key={g} className="inline-flex items-center gap-1">
                <LetterGrade score={GRADE_SCORES[g]} size="sm" />
                <span className="text-xs text-[#64748b]">{gradeCount[g]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Best Landlords */}
      {best5.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">Best Landlords</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {best5.map((l) => (
              <Link
                key={l.slug}
                href={landlordUrl(l.name, city)}
                className="block bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <LetterGrade score={GRADE_SCORES[l.grade]} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-[#0F1D2E] leading-tight">
                        {l.name}
                      </p>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        #{l.rank} overall
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-[#64748b]">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {l.building_count} bldg{l.building_count !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {l.total_violations.toLocaleString()} violations
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Worst Landlords */}
      {worst5.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">Worst Landlords</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {worst5.map((l) => (
              <Link
                key={l.slug}
                href={landlordUrl(l.name, city)}
                className="block bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <LetterGrade score={GRADE_SCORES[l.grade]} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-[#0F1D2E] leading-tight">
                        {l.name}
                      </p>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        #{l.rank} of {totalLandlords}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-[#64748b]">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {l.building_count} bldg{l.building_count !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#EF4444] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {l.total_violations.toLocaleString()} violations
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full Ranking Table */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
          Full Landlord Ranking
        </h2>
        {ranked.length > 0 ? (
          <LandlordRankingTable rows={ranked} cityPathPrefix={cityPathPrefix} />
        ) : (
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center">
            <Users className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
              No landlords found
            </h3>
            <p className="text-sm text-[#64748b]">
              Landlord data for {meta.fullName} is still being processed. Check back soon.
            </p>
          </div>
        )}
      </section>

      {/* FAQ */}
      <FAQSection
        items={faqItems}
        title="Landlord Directory — Frequently Asked Questions"
      />

      {/* Related Links */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">Related</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={cityPath("/worst-rated-buildings", city)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-50 text-[#ef4444] border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Worst Rated Buildings
          </Link>
          <Link
            href={cityPath("/buildings", city)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 text-[#3B82F6] border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Buildings Directory
          </Link>
          <Link
            href={cityPath("/crime", city)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-50 text-[#d97706] border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Crime by Zip Code
          </Link>
        </div>
      </section>
    </div>
  );
}
