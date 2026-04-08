import type { Metadata } from "next";
import Link from "next/link";
import { Siren, ShieldCheck, ShieldAlert, BarChart3 } from "lucide-react";
import {
  canonicalUrl,
  cityPath,
  cityBreadcrumbs,
  breadcrumbJsonLd,
} from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { TrendBadge } from "@/components/ui/TrendBadge";
import { PaginatedFAQSection } from "@/components/seo/PaginatedFAQSection";
import { CrimeRankingTable } from "@/components/crime/CrimeRankingTable";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { rankZips, type CityStats, type SafetyGrade } from "@/lib/crime-stats";
import { createClient } from "@/lib/supabase/server";

const GRADE_SCORES: Record<SafetyGrade, number> = {
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
  return {
    title: `Crime Data & Safety Grades by Zip Code | ${meta.fullName} | Lucid Rents`,
    description: `Is ${meta.fullName} safe? See safety grades, crime rankings, and trends for every zip code. ${meta.crimeSource} data updated hourly with violent, property, and quality-of-life breakdowns.`,
    alternates: { canonical: canonicalUrl(cityPath("/crime", city)) },
    openGraph: {
      title: `Crime Data & Safety Grades | ${meta.fullName}`,
      description: `Is ${meta.fullName} safe? Safety grades and crime rankings for every zip code, powered by ${meta.crimeSource} data.`,
      url: canonicalUrl(cityPath("/crime", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

interface YoyRow {
  zip_code: string;
  current_year_total: number;
  prior_year_total: number;
  current_violent: number;
  prior_violent: number;
  current_property: number;
  prior_property: number;
}

interface TrendRow {
  zip_code: string;
  month: string;
  total: number;
}

export default async function CrimePage({
  params: routeParams,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await routeParams;
  if (!isValidCity(cityParam)) return null;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - 2);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  // Core data (from cache table — fast)
  const [zipRes, cityStatsRes, yoyRes] = await Promise.all([
    supabase.rpc("crime_by_zip", { since_date: sinceDateStr, metro: city }),
    supabase.rpc("crime_city_stats", { since_date: sinceDateStr, metro: city }),
    supabase.rpc("crime_zip_yoy", { metro: city }),
  ]);

  // Sparkline data disabled — crime_all_zip_trends scans raw table and
  // exceeds Vercel function timeout. TODO: add monthly trends to cache table.

  const zipData = zipRes.data || [];
  const cityStats: CityStats | null = cityStatsRes.data?.[0] ?? null;

  // Build YoY map
  const yoyMap = new Map<string, YoyRow>();
  for (const row of (yoyRes.data || []) as YoyRow[]) {
    yoyMap.set(row.zip_code, row);
  }

  // Sparklines disabled for now (empty object = no sparklines shown)
  const trendsByZip: Record<string, number[]> = {};

  // Rank all zips
  const rankedZips = rankZips(zipData, yoyMap, (zip) =>
    getNeighborhoodNameByCity(zip, city)
  );

  // Grade distribution
  const gradeCounts: Record<SafetyGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const z of rankedZips) gradeCounts[z.grade]++;

  // Top 5 safest / most dangerous
  const safest = rankedZips.slice(0, 5);
  const mostDangerous = [...rankedZips].reverse().slice(0, 5);

  // Stats
  const totalCrimes = cityStats?.total_crimes ?? rankedZips.reduce((s, r) => s + r.total, 0);
  const totalViolent = cityStats?.total_violent ?? rankedZips.reduce((s, r) => s + r.violent, 0);
  const violentPct = totalCrimes > 0 ? ((totalViolent / totalCrimes) * 100).toFixed(1) : "0";
  const zipCount = cityStats?.zip_count ?? rankedZips.length;

  // Breadcrumbs
  const bcItems = cityBreadcrumbs(city, {
    label: "Crime Data",
    href: cityPath("/crime", city),
  });

  // FAQ — 30 items across 3 pages (10 per page)
  const cityName = meta.fullName;
  const source = meta.crimeSource;
  const faqItems = [
    // Page 1: Basics & Safety Grades
    {
      question: `How are safety grades calculated for ${cityName}?`,
      answer: `Safety grades are based on percentile ranking of total crime incidents across all zip codes in ${cityName}. Zip codes in the lowest 20% of crime receive an A grade (Very Safe), 20-40% get a B (Moderately Safe), 40-60% get a C (Average), 60-80% get a D (Below Average), and the top 20% get an F (High Crime). This provides a relative comparison within the city.`,
    },
    {
      question: `Is ${cityName} safe to live in?`,
      answer: `Safety varies significantly across ${cityName} neighborhoods. Some zip codes earn an A grade with very low crime rates, while others are rated F. The safest areas typically have 5-10x fewer incidents than the highest-crime areas. Use our safety grades and zip-level breakdowns to evaluate specific neighborhoods before signing a lease.`,
    },
    {
      question: `Which ${cityName} neighborhoods are the safest?`,
      answer: `The safest neighborhoods are listed in the "Safest Neighborhoods" section above, ranked by lowest total crime count. These areas receive an A safety grade. Visit our dedicated Safest Neighborhoods page for a comprehensive ranked list with detailed crime breakdowns for each zip code.`,
    },
    {
      question: `Which ${cityName} neighborhoods have the most crime?`,
      answer: `The highest-crime neighborhoods are listed in the "Highest Crime Areas" section above. These zip codes receive an F safety grade based on having the highest total crime counts in the city. Click any zip code to see what types of crime are most common in that area.`,
    },
    {
      question: "What crime categories are tracked?",
      answer: "Crimes are categorized into three groups: violent crimes (assault, robbery, murder, rape, kidnapping, arson), property crimes (burglary, larceny, theft, auto theft, criminal mischief, forgery), and quality-of-life offenses (everything else, including noise complaints, disorderly conduct, and public disturbance).",
    },
    {
      question: "How often is crime data updated?",
      answer: `Crime data is sourced from ${source} and refreshed monthly. The data covers the most recent 2-year period. Year-over-year trends compare the most recent 12-month period to the same period one year prior.`,
    },
    {
      question: "What does the year-over-year (YoY) trend show?",
      answer: "The YoY trend compares total reported crimes in the most recent 12 months to the same 12-month window one year earlier. A negative percentage (shown in green) means crime is declining in that zip code. A positive percentage (shown in red) means crime is increasing.",
    },
    {
      question: `What does a Safety Grade of A mean in ${cityName}?`,
      answer: `A Safety Grade of A means that zip code is in the safest 20% of all ${cityName} zip codes by total crime count. It does not mean zero crime — it means relatively less crime compared to the rest of the city. Grade A neighborhoods typically have significantly lower violent crime rates and fewer property crimes per capita.`,
    },
    {
      question: "Can I search for a specific neighborhood or zip code?",
      answer: "Yes. Use the search box in the crime ranking table to filter by neighborhood name, zip code, or borough/area. The search is instant and works client-side — no page reload needed. You can also sort by any column (total crimes, violent crimes, YoY change) by clicking the column headers.",
    },
    {
      question: `How does ${cityName} crime compare to other cities?`,
      answer: `Safety grades are calculated relative to each city independently, so an A grade in ${cityName} means safest within ${cityName} specifically. We track crime data across NYC, Chicago, Houston, Los Angeles, and Miami. You can switch cities using the city selector in the navigation bar to compare safety grades across metros.`,
    },
    // Page 2: Understanding the Data
    {
      question: "What is considered a violent crime?",
      answer: "Violent crimes include murder, homicide, rape, robbery, felony assault, simple assault, kidnapping, arson, sex crimes, strangulation, and weapons offenses. These are the most serious categories and are shown in red throughout the crime data pages.",
    },
    {
      question: "What is considered a property crime?",
      answer: "Property crimes include burglary, grand larceny, petit larceny, theft, criminal mischief, stolen property offenses, forgery, auto theft, and vehicle-related crimes. These are shown in amber/orange and are typically the most common crime category in most neighborhoods.",
    },
    {
      question: "What are quality-of-life crimes?",
      answer: "Quality-of-life (QoL) offenses are all crimes that don't fall into the violent or property categories. They include disorderly conduct, drug offenses, trespassing, gambling, loitering, noise complaints, and public intoxication. While less serious individually, a high volume of QoL crimes can indicate neighborhood disorder.",
    },
    {
      question: "What is the dominant crime type badge?",
      answer: "Each zip code displays a badge showing the most prevalent crime category: 'Violent' (red), 'Property' (amber), or 'Quality of Life' (blue). This tells you at a glance what kind of crime is most common in that area. Most neighborhoods are dominated by property or QoL crimes; a 'Violent' badge is a significant warning sign.",
    },
    {
      question: `Where does ${source} crime data come from?`,
      answer: `Crime data is sourced directly from ${source}'s official open data portal. Each record represents an individual reported crime complaint with a date, location, offense description, and legal classification. Data is geocoded to zip codes using the latitude and longitude of each incident.`,
    },
    {
      question: "Why might some zip codes show zero crime?",
      answer: "Zip codes with zero or very low crime counts may be commercial/industrial areas with few residents, parks, airports, or zip codes where the police department doesn't report crime data. They may also be areas where crimes are reported under an adjacent zip code.",
    },
    {
      question: "What is the difference between felonies, misdemeanors, and violations?",
      answer: "Felonies are the most serious crimes (e.g., murder, robbery, burglary) carrying potential prison sentences over one year. Misdemeanors are mid-level offenses (e.g., petit larceny, simple assault) with sentences up to one year. Violations are minor offenses (e.g., disorderly conduct, trespassing) with fines or short jail time. The zip code detail pages show this severity breakdown.",
    },
    {
      question: "How should renters use this crime data?",
      answer: "Compare the safety grade and crime breakdown of neighborhoods you're considering. Look at the YoY trend to see if crime is improving or worsening. Check the dominant crime type — a neighborhood with mostly QoL offenses is very different from one with a high violent crime rate. Visit the zip code detail page for monthly trends and recent incident lists.",
    },
    {
      question: "Does a lower safety grade mean the neighborhood is dangerous?",
      answer: "Not necessarily. A D or F grade means higher crime relative to other neighborhoods in the same city, but the actual crime rate may still be low in absolute terms. Context matters: a D-rated zip code in a low-crime city may be safer than a B-rated zip code in a high-crime city. Always look at the actual numbers alongside the grade.",
    },
    {
      question: "What does the comparison bar show on the zip detail page?",
      answer: "Each stat card on the zip code detail page includes a comparison bar showing how that zip's crime count compares to the city-wide average. A shorter dark bar (this zip) vs a longer gray bar (city avg) means below-average crime for that category — which is good.",
    },
    // Page 3: Practical Advice for Renters
    {
      question: "Should I avoid neighborhoods with an F safety grade?",
      answer: "An F grade indicates the area is in the top 20% for crime within the city, but it doesn't mean you should automatically avoid it. Many F-rated neighborhoods are vibrant, affordable, and improving. Check the YoY trend — if crime is declining, the area may be on an upswing. Also look at the crime type breakdown: mostly QoL offenses is very different from high violent crime.",
    },
    {
      question: "How can I check crime near a specific building?",
      answer: "Every building page on Lucid Rents includes a Nearby Crime Summary card showing crime statistics for that building's zip code. You can also search for the building's zip code in the crime ranking table or visit the zip code detail page for a full breakdown with trends and recent incidents.",
    },
    {
      question: "Does crime data affect building ratings on Lucid Rents?",
      answer: "Building scores on Lucid Rents are based on violations, complaints, and tenant reviews — not crime data directly. However, every building page displays the nearby crime summary for context. Crime data and building quality are separate metrics that together give you a complete picture of a neighborhood.",
    },
    {
      question: "What time period does the crime data cover?",
      answer: "The crime statistics shown cover the most recent 2-year period. This provides enough data to identify meaningful patterns while staying current. Year-over-year trends compare the most recent 12 months to the prior 12 months within this window.",
    },
    {
      question: "Can crime change significantly from year to year?",
      answer: "Yes, crime rates can shift meaningfully. A 10-20% year-over-year change is common in many zip codes. Large developments, increased policing, new transit access, or demographic shifts can all impact crime. The YoY trend badge on each zip code shows whether crime is moving in a positive or negative direction.",
    },
    {
      question: "Are there seasonal patterns in crime data?",
      answer: "Yes, most cities see higher crime in warmer months (June-September) and lower crime in winter. The monthly trend charts on each zip code detail page reveal these seasonal patterns. When comparing neighborhoods, keep in mind that a single month's data may not be representative.",
    },
    {
      question: "How accurate is the zip code mapping?",
      answer: "Crime incidents are mapped to zip codes using the latitude and longitude coordinates provided by the police department. When coordinates are unavailable, we use the nearest zip code centroid. In rare cases, crimes near zip code boundaries may be assigned to an adjacent zip. Overall accuracy is high (95%+) for incidents with coordinates.",
    },
    {
      question: "What should I do if I see a crime trend I'm concerned about?",
      answer: "If a neighborhood shows rising crime or high violent crime rates, consider visiting the area at different times of day before signing a lease. Talk to current residents, check the building's violation history on Lucid Rents, and look at whether the trend is specific to one crime type or broadly increasing. A rising QoL trend may be less concerning than rising violent crime.",
    },
    {
      question: "Can I get alerts about crime in my neighborhood?",
      answer: "Yes. If you create a Lucid Rents account and monitor a building, you can enable email alerts that notify you about significant crime activity in your zip code. These daily alerts include a summary of recent incidents near your monitored buildings.",
    },
    {
      question: "Why do some neighborhoods have no neighborhood name listed?",
      answer: "Some zip codes, particularly in commercial areas, airports, or newer developments, may not have a commonly recognized neighborhood name in our database. In these cases, only the zip code is shown. The crime data is still accurate — only the display name is missing.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Structured data */}
      <JsonLd data={breadcrumbJsonLd(bcItems.map(b => ({ name: b.label, url: b.href })))} />

      {/* Breadcrumbs */}
      <Breadcrumbs items={bcItems} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#FEE2E2] rounded-lg">
            <Siren className="w-6 h-6 text-[#DC2626]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            Crime Data &amp; Safety Grades
          </h1>
        </div>
        <p className="text-[#64748b] text-sm sm:text-base">
          {meta.crimeSource} data &bull; {rankedZips.length} zip codes &bull;
          Updated monthly
        </p>
      </div>

      {/* City-wide hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Total Incidents
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalCrimes.toLocaleString()}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">Last 2 years</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
              Violent Crime Rate
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{violentPct}%</p>
          <p className="text-xs text-[#94a3b8] mt-1">Of total incidents</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Siren className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Zip Codes Tracked
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">{zipCount}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Across {meta.fullName}</p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Grade Distribution
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {(["A", "B", "C", "D", "F"] as SafetyGrade[]).map((g) => (
              <div key={g} className="text-center">
                <LetterGrade score={GRADE_SCORES[g]} size="sm" />
                <p className="text-[10px] text-[#64748b] mt-0.5 font-medium">
                  {gradeCounts[g]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Safest Neighborhoods */}
      {safest.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#16a34a]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              Safest Neighborhoods
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {safest.map((z) => (
              <Link
                key={z.zip_code}
                href={cityPath(`/crime/${z.zip_code}`, city)}
                className="block bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <span className="text-xs font-mono text-[#64748b]">
                    #{z.rank}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#0F1D2E] truncate">
                  {z.neighborhood || z.zip_code}
                </p>
                <p className="text-xs text-[#64748b]">{z.zip_code}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#64748b]">
                    {z.total.toLocaleString()} incidents
                  </span>
                  {z.yoy_total_pct !== null && (
                    <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Highest Crime Areas */}
      {mostDangerous.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              Highest Crime Areas
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {mostDangerous.map((z) => (
              <Link
                key={z.zip_code}
                href={cityPath(`/crime/${z.zip_code}`, city)}
                className="block bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <LetterGrade score={GRADE_SCORES[z.grade]} size="sm" />
                  <span className="text-xs font-mono text-[#64748b]">
                    #{z.rank}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#0F1D2E] truncate">
                  {z.neighborhood || z.zip_code}
                </p>
                <p className="text-xs text-[#64748b]">{z.zip_code}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#64748b]">
                    {z.total.toLocaleString()} incidents
                  </span>
                  {z.yoy_total_pct !== null && (
                    <TrendBadge value={z.yoy_total_pct} suffix="% YoY" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main ranking table */}
      {rankedZips.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-xl">
          <Siren className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">No crime data available yet.</p>
        </div>
      ) : (
        <CrimeRankingTable
          rows={rankedZips}
          trendData={trendsByZip}
          cityPathPrefix={cityPath("", city)}
          regionLabel={meta.regionLabel}
          areas={[...meta.crimeAreas]}
        />
      )}

      {/* FAQ — JSON-LD includes all items for SEO, UI paginates 10 per page */}
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }} />
      <PaginatedFAQSection items={faqItems} />
    </div>
  );
}
