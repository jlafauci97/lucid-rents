/**
 * Area cross-links — internal links from every building page to its
 * neighborhood overview, crime stats, rent trends, and adjacent neighborhoods.
 *
 * Previously its own `BuildingAreaSection` (a standalone `#about-this-area`
 * section). It now renders *inside* the merged "About this area" section as a
 * fragment (no `<section>`/section-head of its own), so the surrounding section
 * owns the heading and anchor.
 *
 * SEO note (unchanged): the neighborhood/crime/rent destinations are hub-style
 * URLs in the sitemap (568 ZIPs × 3 page types). Linking from ~3M building pages
 * concentrates internal link signal on these hubs.
 */

import Link from "next/link";
import { MapPin, Siren, DollarSign, Map as MapIcon } from "lucide-react";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { cityPath, neighborhoodUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { getAdjacentZips } from "@/lib/zip-adjacency";

interface Props {
  city: City;
  zipCode: string | null;
}

export function AreaCrossLinks({ city, zipCode }: Props) {
  // Nothing to render without a ZIP — every URL below depends on it.
  if (!zipCode) return null;

  const neighborhoodName = getNeighborhoodNameByCity(zipCode, city) ?? "this area";
  const cityName = CITY_META[city]?.fullName ?? city;

  const adjacent = getAdjacentZips(zipCode)
    .map((a) => ({
      ...a,
      name: getNeighborhoodNameByCity(a.zip, city),
    }))
    .filter((a) => !!a.name); // drop ZIPs that don't have a known neighborhood name

  return (
    <>
      <div className="area-grid">
        <Link href={neighborhoodUrl(zipCode, city)} className="area-card">
          <div className="area-card-label">
            <MapPin className="area-card-icon" aria-hidden="true" />
            Neighborhood overview
          </div>
          <div className="area-card-value">
            {neighborhoodName}
            <span className="area-card-arrow">→</span>
          </div>
          <div className="area-card-stat">
            Vibe · top buildings · landlords · schools · transit
          </div>
        </Link>

        <Link href={cityPath(`/crime/${zipCode}`, city)} className="area-card">
          <div className="area-card-label">
            <Siren className="area-card-icon" aria-hidden="true" />
            Crime in {zipCode}
          </div>
          <div className="area-card-value">
            See full breakdown
            <span className="area-card-arrow">→</span>
          </div>
          <div className="area-card-stat">
            Incident type · 6-month trend · vs. {cityName} average
          </div>
        </Link>

        <Link
          href={cityPath(`/rents/${neighborhoodSlugForUrl(zipCode, city, neighborhoodName)}`, city)}
          className="area-card area-card-wide"
        >
          <div className="area-card-label">
            <DollarSign className="area-card-icon" aria-hidden="true" />
            Rent trends in {neighborhoodName}
          </div>
          <div className="area-card-value">
            Median rent &amp; comparables
            <span className="area-card-arrow">→</span>
          </div>
          <div className="area-card-stat">
            1BR &amp; 2BR averages · month-over-month · current listings
          </div>
        </Link>
      </div>

      {adjacent.length > 0 && (
        <div className="area-adjacent">
          <div className="area-adjacent-label">
            <MapIcon className="area-card-icon" aria-hidden="true" />
            Nearby neighborhoods to explore
          </div>
          <div className="area-adjacent-chips">
            {adjacent.map((a) => (
              <Link
                key={a.zip}
                href={neighborhoodUrl(a.zip, city)}
                className="area-adjacent-chip"
              >
                {a.name}
                <span className="area-adjacent-dist">· {a.distance} mi</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .area-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }
        .area-card-wide { grid-column: 1 / -1; }
        .area-card {
          display: block;
          padding: 16px;
          background: oklch(0.97 0.005 240);
          border: 1px solid oklch(0.92 0.01 240);
          border-radius: 10px;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s, border-color 0.15s;
        }
        .area-card:hover {
          background: white;
          border-color: oklch(0.55 0.20 255);
        }
        .area-card-label {
          font-size: 11px;
          font-weight: 600;
          color: oklch(0.55 0.01 240);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .area-card-icon { width: 14px; height: 14px; }
        .area-card-value {
          font-size: 15px;
          font-weight: 600;
          color: oklch(0.20 0.04 245);
          margin-top: 6px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .area-card-arrow {
          color: oklch(0.55 0.20 255);
          font-size: 14px;
          font-weight: 500;
          transition: transform 0.15s;
        }
        .area-card:hover .area-card-arrow { transform: translateX(3px); }
        .area-card-stat {
          font-size: 12px;
          color: oklch(0.45 0.01 240);
          margin-top: 4px;
        }
        .area-adjacent {
          margin-top: 12px;
          padding: 16px;
          background: oklch(0.97 0.005 240);
          border-radius: 10px;
        }
        .area-adjacent-label {
          font-size: 11px;
          font-weight: 600;
          color: oklch(0.55 0.01 240);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .area-adjacent-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .area-adjacent-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: white;
          border: 1px solid oklch(0.92 0.01 240);
          border-radius: 999px;
          text-decoration: none;
          color: oklch(0.20 0.04 245);
          font-size: 13px;
          font-weight: 500;
          transition: border-color 0.15s, color 0.15s;
        }
        .area-adjacent-chip:hover {
          border-color: oklch(0.55 0.20 255);
          color: oklch(0.55 0.20 255);
        }
        .area-adjacent-dist {
          font-size: 11px;
          color: oklch(0.55 0.01 240);
        }
        @media (max-width: 640px) {
          .area-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

/**
 * Build the rents URL slug exactly like generate-sitemaps.mjs does so the
 * link matches what's in the sitemap. The script uses neighborhoodPageSlug()
 * which slugifies the name and appends the zip.
 */
function neighborhoodSlugForUrl(zip: string, city: City, name: string): string {
  if (!name || name === "this area") return zip;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  return `${slug}-${zip}`;
}
