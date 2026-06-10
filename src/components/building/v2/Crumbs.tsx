/**
 * Crumbs — direct port of the mockup at public/mockups/building-v1.html, lines 2966–2972.
 *
 * Preserved verbatim:
 *   - nav.crumbs structure with <a>, <span class="sep">, <span class="now">
 *   - Exact class names
 *   - Slash separators
 *
 * Changes vs mockup (mechanical only):
 *   - class → className
 *   - Text segments swapped for props
 */

import Link from "next/link";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface Props {
  city: City;
  boroughSlug: string;
  boroughName: string;
  neighborhoodSlug?: string | null;
  neighborhoodName?: string | null;
  addressLabel: string;
}

export function Crumbs({
  city,
  boroughSlug,
  boroughName,
  neighborhoodSlug,
  neighborhoodName,
  addressLabel,
}: Props) {
  const prefix = CITY_META[city]?.urlPrefix ?? "nyc";
  const boroughLower = boroughName.toLowerCase();
  const nbhLower = (neighborhoodName ?? "").toLowerCase();

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href="/">home</Link><span className="sep">/</span>
      <Link href={`/${prefix}`}>{prefix}</Link><span className="sep">/</span>
      {/* Borough buildings list — must match the BreadcrumbList JSON-LD on the
          building page, which points at cityPath(`/buildings/${boroughSlug}`). */}
      <Link href={`/${prefix}/buildings/${boroughSlug}`}>{boroughLower}</Link><span className="sep">/</span>
      {neighborhoodSlug && neighborhoodName ? (
        <>
          <Link href={`/${prefix}/neighborhood/${neighborhoodSlug}`}>{nbhLower}</Link><span className="sep">/</span>
        </>
      ) : null}
      <span className="now">{addressLabel.toLowerCase()}</span>
    </nav>
  );
}
