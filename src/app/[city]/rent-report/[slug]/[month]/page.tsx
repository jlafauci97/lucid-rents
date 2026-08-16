import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, FileBarChart } from "lucide-react";
import { CITY_META, isValidCity, type City } from "@/lib/cities";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { parseNeighborhoodSlug } from "@/lib/nyc-neighborhoods";
import { getNeighborhoodNameByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getZipMonthReport,
  getCityMonthMedians,
  isPlausibleReportMonth,
  monthLabel,
  bedLabel,
  formatDollar,
  formatPct,
  formatSignedDollar,
  focusBedRow,
  type RentReportRow,
} from "../../_data";

export const revalidate = 86400;

// Big URL space (zip × month) — ISR-cache each page on first hit instead of
// prerendering. Repo-standard pattern for unbounded dynamic params.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface ReportParams {
  city: string;
  slug: string;
  month: string;
}

function num(v: string | number | null): number | null {
  return v == null ? null : Number(v);
}

function pctChange(older: number, newer: number): number {
  if (older === 0) return 0;
  return ((newer - older) / older) * 100;
}

/** Template-prose summary assembled purely from the numbers on the page. */
function buildSummary(args: {
  name: string;
  month: string;
  focus: RentReportRow;
  prevFocus: RentReportRow | null;
  prevMonth: string | null;
  yoyFocus: RentReportRow | null;
  totalListings: number;
  bedTypes: number;
  cityName: string;
  cityMedian: number | null;
}): string {
  const { name, month, focus, prevFocus, prevMonth, yoyFocus, totalListings, bedTypes, cityName, cityMedian } = args;
  const median = num(focus.median_rent)!;
  const label = bedLabel(focus.beds);
  const parts: string[] = [];

  let lead = `Median ${label} rent in ${name} was ${formatDollar(median)} in ${monthLabel(month)}`;
  const prevMedian = prevFocus ? num(prevFocus.median_rent) : null;
  if (prevMedian != null && prevMonth) {
    const pct = pctChange(prevMedian, median);
    const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
    lead +=
      dir === "flat"
        ? `, flat versus ${monthLabel(prevMonth)}`
        : `, ${dir} ${Math.abs(pct).toFixed(1)}% (${formatSignedDollar(median - prevMedian)}) from ${monthLabel(prevMonth)}`;
  }
  const yoyMedian = yoyFocus ? num(yoyFocus.median_rent) : null;
  if (yoyMedian != null) {
    const pct = pctChange(yoyMedian, median);
    const dir = pct > 0 ? "up" : pct < 0 ? "down" : "unchanged";
    lead +=
      dir === "unchanged"
        ? ` and unchanged year-over-year`
        : ` and ${dir} ${Math.abs(pct).toFixed(1)}% year-over-year`;
  }
  parts.push(lead + ".");

  const p25 = num(focus.p25_rent);
  const p75 = num(focus.p75_rent);
  if (p25 != null && p75 != null) {
    parts.push(
      `The middle half of ${label} listings asked between ${formatDollar(p25)} and ${formatDollar(p75)}.`,
    );
  }
  if (cityMedian != null) {
    const diff = median - cityMedian;
    const rel =
      Math.abs(diff) < 25
        ? `in line with the ${cityName} citywide ${label} median of ${formatDollar(cityMedian)}`
        : `${formatDollar(Math.abs(diff))} ${diff > 0 ? "above" : "below"} the ${cityName} citywide ${label} median of ${formatDollar(cityMedian)}`;
    parts.push(`That puts ${name} ${rel}.`);
  }
  parts.push(
    `The month's figures are based on ${totalListings.toLocaleString()} listing${totalListings !== 1 ? "s" : ""} across ${bedTypes} bedroom categor${bedTypes !== 1 ? "ies" : "y"}.`,
  );
  return parts.join(" ");
}

// ── Metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<ReportParams>;
}): Promise<Metadata> {
  const { city: cityParam, slug, month } = await params;
  if (!isValidCity(cityParam) || !isPlausibleReportMonth(month)) return {};
  const city = cityParam as City;
  const zip = parseNeighborhoodSlug(slug);
  const name = getNeighborhoodNameByCity(zip, city);
  const displayName = name ? `${name} (${zip})` : `ZIP ${zip}`;

  const report = await getZipMonthReport(zip, month);
  if (!report) return {};
  const focus = focusBedRow(report.rows);

  const title = `${displayName} Rent Report — ${monthLabel(month)}`;
  let description = `${monthLabel(month)} rent report for ${name ?? `ZIP ${zip}`}, ${CITY_META[city].fullName}: median rent by bedroom count, month-over-month and year-over-year changes, and listing volume.`;
  if (focus && focus.median_rent != null) {
    description = `Median ${bedLabel(focus.beds)} rent in ${name ?? `ZIP ${zip}`} was ${formatDollar(Number(focus.median_rent))} in ${monthLabel(month)}. Full report: medians by bedroom, MoM and YoY changes, price spreads, and listing volume.`;
  }

  const canonicalSlug = neighborhoodPageSlugByCity(zip, city);
  const url = canonicalUrl(cityPath(`/rent-report/${canonicalSlug}/${month}`, city));

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

// ── Page ──────────────────────────────────────────────────────────────

export default async function RentReportMonthPage({
  params,
}: {
  params: Promise<ReportParams>;
}) {
  const { city: cityParam, slug, month } = await params;
  if (!isValidCity(cityParam) || !isPlausibleReportMonth(month)) notFound();
  const city = cityParam as City;
  const meta = CITY_META[city];

  const zip = parseNeighborhoodSlug(slug);
  const name = getNeighborhoodNameByCity(zip, city);
  const displayName = name ?? `ZIP ${zip}`;
  const canonicalSlug = neighborhoodPageSlugByCity(zip, city);

  const [report, cityMedians] = await Promise.all([
    getZipMonthReport(zip, month),
    getCityMonthMedians(city, month),
  ]);
  if (!report) notFound();

  const focus = focusBedRow(report.rows);
  const prevByBed = new Map(report.prevRows.map((r) => [r.beds, r]));
  const yoyByBed = new Map(report.yoyRows.map((r) => [r.beds, r]));

  // Display beds 0–4; 5BR+ rows are single-listing noise but still count
  // toward total volume.
  const tableRows = report.rows.filter((r) => r.beds <= 4 && r.median_rent != null);

  const focusCityMedian =
    focus && cityMedians ? (cityMedians.medianByBed[focus.beds] ?? null) : null;

  const summary = focus
    ? buildSummary({
        name: displayName,
        month,
        focus,
        prevFocus: prevByBed.get(focus.beds) ?? null,
        prevMonth: report.prevMonth,
        yoyFocus: yoyByBed.get(focus.beds) ?? null,
        totalListings: report.totalListings,
        bedTypes: report.rows.length,
        cityName: meta.fullName,
        cityMedian: focusCityMedian,
      })
    : null;

  const pageUrl = canonicalUrl(cityPath(`/rent-report/${canonicalSlug}/${month}`, city));
  const prevUrl = report.prevMonth
    ? canonicalUrl(cityPath(`/rent-report/${canonicalSlug}/${report.prevMonth}`, city))
    : null;
  const nextUrl = report.nextMonth
    ? canonicalUrl(cityPath(`/rent-report/${canonicalSlug}/${report.nextMonth}`, city))
    : null;

  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Rent Reports", href: cityPath("/rent-report", city) },
    { label: displayName, href: cityPath(`/rent-report/${canonicalSlug}`, city) },
    { label: monthLabel(month), href: cityPath(`/rent-report/${canonicalSlug}/${month}`, city) },
  );

  const changeCell = (base: RentReportRow | undefined, current: number) => {
    const baseMedian = base ? num(base.median_rent) : null;
    if (baseMedian == null) return <span className="text-[#94a3b8]">—</span>;
    const pct = pctChange(baseMedian, current);
    const color = pct > 0 ? "text-[#dc2626]" : pct < 0 ? "text-[#16a34a]" : "text-[#475569]";
    return (
      <span className={`font-medium ${color}`}>
        {formatSignedDollar(current - baseMedian)} ({formatPct(pct)})
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: `${displayName} Rent Report — ${monthLabel(month)}`,
          description: `Asking-rent statistics for ${displayName}, ${meta.fullName} in ${monthLabel(month)}: median, 25th and 75th percentile rents by bedroom count, with listing volume.`,
          url: pageUrl,
          temporalCoverage: month,
          spatialCoverage: {
            "@type": "Place",
            name: `${displayName}, ${meta.fullName}`,
            address: {
              "@type": "PostalAddress",
              postalCode: zip,
              addressRegion: meta.stateCode,
              addressCountry: "US",
            },
          },
          variableMeasured: ["median rent", "25th percentile rent", "75th percentile rent", "listing count"],
          creator: {
            "@type": "Organization",
            name: "Lucid Rents",
            url: "https://lucidrents.com",
          },
          isPartOf: {
            "@type": "DataCatalog",
            name: `${meta.fullName} Monthly Rent Reports`,
            url: canonicalUrl(cityPath("/rent-report", city)),
          },
        }}
      />
      <Breadcrumbs items={breadcrumbs} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mt-6 mb-6">
        <div className="flex items-center gap-2 text-[#3B82F6] text-sm font-medium mb-2">
          <FileBarChart className="w-4 h-4" />
          Monthly Rent Report
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
          {displayName} Rent Report — {monthLabel(month)}
        </h1>
        <p className="text-[#64748b] mt-1">
          Asking rents in ZIP {zip}, {meta.fullName}, from {report.totalListings.toLocaleString()} listing
          {report.totalListings !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* ── Summary prose ────────────────────────────────────────── */}
      {summary && (
        <p className="text-[#0F1D2E] text-base leading-relaxed bg-[#EFF6FF] border border-[#bfdbfe] rounded-xl p-5 mb-8">
          {summary}
        </p>
      )}

      {/* ── Rents by bedroom table ───────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">
          Median Rent by Bedroom Count
        </h2>
        <div className="overflow-x-auto bg-white rounded-xl border border-[#e2e8f0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-left text-xs text-[#94a3b8] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Bedrooms</th>
                <th className="px-4 py-3 font-medium">Median</th>
                <th className="px-4 py-3 font-medium">Vs. {report.prevMonth ? monthLabel(report.prevMonth) : "Prior Month"}</th>
                <th className="px-4 py-3 font-medium">Vs. {report.yoyMonth ? monthLabel(report.yoyMonth) : "Year Ago"}</th>
                <th className="px-4 py-3 font-medium">P25–P75 Range</th>
                <th className="px-4 py-3 font-medium text-right">Listings</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const median = num(r.median_rent)!;
                const p25 = num(r.p25_rent);
                const p75 = num(r.p75_rent);
                return (
                  <tr key={r.beds} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#0F1D2E]">{bedLabel(r.beds)}</td>
                    <td className="px-4 py-3 font-bold text-[#0F1D2E]">{formatDollar(median)}</td>
                    <td className="px-4 py-3">{changeCell(prevByBed.get(r.beds), median)}</td>
                    <td className="px-4 py-3">{changeCell(yoyByBed.get(r.beds), median)}</td>
                    <td className="px-4 py-3 text-[#475569]">
                      {p25 != null && p75 != null ? `${formatDollar(p25)} – ${formatDollar(p75)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[#475569]">{r.listing_count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-2">
          Median, P25, and P75 are asking rents from listings posted in {monthLabel(month)}. Changes compare
          against the nearest prior month with data.
        </p>
      </div>

      {/* ── Citywide comparison ──────────────────────────────────── */}
      {cityMedians && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">
            {displayName} vs. {meta.fullName} — {monthLabel(month)}
          </h2>
          <div className="overflow-x-auto bg-white rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left text-xs text-[#94a3b8] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Bedrooms</th>
                  <th className="px-4 py-3 font-medium">{displayName} Median</th>
                  <th className="px-4 py-3 font-medium">{meta.name} Citywide Median</th>
                  <th className="px-4 py-3 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {tableRows
                  .filter((r) => cityMedians.medianByBed[r.beds] != null)
                  .map((r) => {
                    const median = num(r.median_rent)!;
                    const cityMedian = cityMedians.medianByBed[r.beds];
                    const diff = median - cityMedian;
                    return (
                      <tr key={r.beds} className="border-b border-[#f1f5f9] last:border-0">
                        <td className="px-4 py-3 font-semibold text-[#0F1D2E]">{bedLabel(r.beds)}</td>
                        <td className="px-4 py-3 font-bold text-[#0F1D2E]">{formatDollar(median)}</td>
                        <td className="px-4 py-3 text-[#475569]">{formatDollar(cityMedian)}</td>
                        <td className={`px-4 py-3 font-medium ${diff > 0 ? "text-[#dc2626]" : diff < 0 ? "text-[#16a34a]" : "text-[#475569]"}`}>
                          {formatSignedDollar(diff)} ({formatPct(pctChange(cityMedian, median))})
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#94a3b8] mt-2">
            Citywide figure is the median of zip-level medians across {cityMedians.zipCount.toLocaleString()} {meta.fullName} zip
            codes with listings in {monthLabel(month)}.
          </p>
        </div>
      )}

      {/* ── Prev / next month navigation ─────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        {report.prevMonth ? (
          <Link
            href={cityPath(`/rent-report/${canonicalSlug}/${report.prevMonth}`, city)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3B82F6] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {monthLabel(report.prevMonth)} report
          </Link>
        ) : (
          <span />
        )}
        {report.nextMonth ? (
          <Link
            href={cityPath(`/rent-report/${canonicalSlug}/${report.nextMonth}`, city)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3B82F6] hover:underline"
          >
            {monthLabel(report.nextMonth)} report
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* ── Related links ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-[#3B82F6]" />
          <h2 className="text-sm font-bold text-[#0F1D2E]">More on {displayName}</h2>
        </div>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href={cityPath(`/rents/${canonicalSlug}`, city)} className="text-[#3B82F6] hover:underline">
              {displayName} rent trends, seasonality &amp; amenity premiums
            </Link>
          </li>
          <li>
            <Link href={cityPath("/rent-report", city)} className="text-[#3B82F6] hover:underline">
              All {meta.fullName} monthly rent reports
            </Link>
          </li>
          <li>
            <Link href={cityPath(`/search?zip=${zip}`, city)} className="text-[#3B82F6] hover:underline">
              Search buildings in {zip}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
