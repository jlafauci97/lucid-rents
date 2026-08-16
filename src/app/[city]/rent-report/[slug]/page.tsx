import { notFound, redirect } from "next/navigation";
import { isValidCity, type City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { parseNeighborhoodSlug } from "@/lib/nyc-neighborhoods";
import { neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { getZipReportMonths } from "../_data";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

/**
 * Nav convenience, not an SEO target: /rent-report/{slug} 307-redirects to
 * the latest month that actually has data for this zip. A plain redirect()
 * (temporary) is deliberate — permanentRedirect gets coerced under streaming
 * in this Next version, and the target moves every month anyway.
 */
export default async function RentReportLatestPage({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  const { city: cityParam, slug } = await params;
  if (!isValidCity(cityParam)) notFound();
  const city = cityParam as City;

  const zip = parseNeighborhoodSlug(slug);
  const months = await getZipReportMonths(zip);
  if (months.length === 0) notFound();

  const canonicalSlug = neighborhoodPageSlugByCity(zip, city);
  redirect(cityPath(`/rent-report/${canonicalSlug}/${months[0]}`, city));
}
