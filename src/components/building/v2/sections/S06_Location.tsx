/**
 * S06 Location & daily life — verbatim port of mockup lines 4109–4209.
 *
 *   <section class="section" id="location">
 *     <div class="section-head">…06 / 09 Location & daily life.…</div>
 *     <div class="location-grid">
 *       <div class="big-map">.pin + .mlabel</div>
 *       <div class="walk-panel">.walk-scores (3 rings) + .nearby (rows)</div>
 *     </div>
 *     <a class="nb-card" href="…">neighborhood feature card</a>
 *     <a class="nb-allcta">Browse all neighborhoods</a>
 *   </section>
 */

import Link from "next/link";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { neighborhoodUrl, neighborhoodsUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { getNeighborhoodVibe } from "@/lib/neighborhood-vibes";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import { BigMap } from "@/components/building/v2/BigMap";

interface Props {
  building: Building;
  city: City;
  nearby: BuildingV2Data["nearby"];
  neighborhoodStats: BuildingV2Data["neighborhoodStats"];
}

// Derive walk/transit/bike scores from real nearby-stop data.
// Transit = capped by count + proximity of subway/bus stops.
// Walk = transit + schools + amenity density proxy.
// Bike = walk * 0.85 (softer — city-dependent bike infra not yet modeled).
function deriveScores(nearby: BuildingV2Data["nearby"]): { walk: number; transit: number; bike: number } {
  const subwayCount = nearby.transitSubway.length;
  const busCount = nearby.transitBus.length;
  const schoolCount = nearby.schoolsPublic.length + nearby.schoolsCharter.length + nearby.schoolsPrivate.length;
  const closestSubwayMi = nearby.transitSubway[0]?.distMiles ?? 2;
  const closestBusMi = nearby.transitBus[0]?.distMiles ?? 2;

  // Transit score: 0..100.  Closer + more stops → higher.
  let transit = 0;
  if (subwayCount > 0) transit += 40 + Math.max(0, 30 - closestSubwayMi * 60); // up to 70 from subway
  if (busCount > 0) transit += 20 + Math.max(0, 10 - closestBusMi * 30);      // up to 30 from bus
  transit = Math.min(100, Math.round(transit));

  // Walk score: transit + school density.
  const walk = Math.min(100, Math.round(transit * 0.7 + Math.min(schoolCount * 4, 30)));

  const bike = Math.max(0, Math.round(walk * 0.85));
  return { walk, transit, bike };
}

function coords(b: Building): string {
  const lat = b.latitude; const lon = b.longitude;
  if (lat != null && lon != null) return `${Number(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}, ${Number(lon).toFixed(3)}° ${lon >= 0 ? "E" : "W"}`;
  return "";
}

export function S06_Location({ building, city, nearby, neighborhoodStats }: Props) {
  const { walk: w, transit: t, bike: bk } = deriveScores(nearby);
  const cityName = ((CITY_META as Record<string, { name?: string; fullName?: string }>)[city])?.name ?? city;
  const borough = building.borough;
  const street = building.full_address.split(",")[0] ?? building.full_address;

  // Resolve the *real* neighborhood name + description by zip (Hell's Kitchen,
  // Chelsea, Park Slope, etc.) rather than falling back to the borough label.
  const realNbhName = building.zip_code ? getNeighborhoodNameByCity(building.zip_code, city) : null;
  const neighborhoodName = realNbhName || borough;
  const neighborhoodHref = building.zip_code ? neighborhoodUrl(building.zip_code, city) : "#";
  const vibe = building.zip_code ? getNeighborhoodVibe(city, building.zip_code) : null;
  const nbhDescription = vibe?.description
    ?? `Learn more about ${neighborhoodName}${cityName ? ` in ${cityName}` : ""} — buildings tracked, typical rents, and resident sentiment.`;

  const ring = (val: number) => (
    <svg className="ring" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(0.92 0.01 240)" strokeWidth="3"/>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(0.32 0.10 250)" strokeWidth="3" strokeDasharray={`${val} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)"/>
    </svg>
  );

  return (
    <section className="section" id="location">
      <div className="section-head">
        <div>
          <div className="num">06 / 09</div>
          <h2>Location &amp; daily life.</h2>
        </div>
        <div className="meta"></div>
      </div>

      <div className="location-grid">
        {building.latitude != null && building.longitude != null ? (
          <BigMap
            latitude={building.latitude}
            longitude={building.longitude}
            address={building.full_address}
            labelLine={`${street} · ${borough}${coords(building) ? ` · ${coords(building)}` : ""}`}
          />
        ) : (
          <div className="big-map" role="img" aria-label="Map unavailable">
            <span className="pin"></span>
            <div className="mlabel">{street} · {borough} · coordinates missing</div>
          </div>
        )}

        <div className="walk-panel">
          <div className="walk-scores">
            <div className="walk-score">{ring(w)}<div className="n">{w}</div><div className="l">Walk</div></div>
            <div className="walk-score">{ring(t)}<div className="n">{t}</div><div className="l">Transit</div></div>
            <div className="walk-score">{ring(bk)}<div className="n">{bk}</div><div className="l">Bike</div></div>
          </div>
          <div className="nearby">
            <div className="row"><span>Live nearby data in right-rail cards</span><span className="d">→</span></div>
            <div className="row"><span>Transit stops · schools · recreation</span><span className="d">see rail</span></div>
          </div>
        </div>
      </div>

      {/* Neighborhood feature */}
      <Link className="nb-card" href={neighborhoodHref}>
        <div className="nb-glyph">
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="nb-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dbeafe"/>
                <stop offset="100%" stopColor="#bfdbfe"/>
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="120" height="120" fill="url(#nb-sky)"/>
            <rect x="10" y="52" width="18" height="58" fill="#3B82F6" opacity="0.8"/>
            <rect x="32" y="40" width="22" height="70" fill="#1e40af"/>
            <rect x="58" y="28" width="18" height="82" fill="#3B82F6" opacity="0.9"/>
            <rect x="80" y="46" width="14" height="64" fill="#1e40af" opacity="0.75"/>
            <rect x="98" y="58" width="16" height="52" fill="#3B82F6" opacity="0.7"/>
            <g fill="white" opacity="0.85">
              <rect x="14" y="60" width="4" height="5"/><rect x="20" y="60" width="4" height="5"/>
              <rect x="14" y="72" width="4" height="5"/><rect x="20" y="72" width="4" height="5"/>
              <rect x="14" y="84" width="4" height="5"/><rect x="20" y="84" width="4" height="5"/>
              <rect x="36" y="48" width="4" height="5"/><rect x="44" y="48" width="4" height="5"/>
              <rect x="36" y="60" width="4" height="5"/><rect x="44" y="60" width="4" height="5"/>
              <rect x="36" y="72" width="4" height="5"/><rect x="44" y="72" width="4" height="5"/>
              <rect x="36" y="84" width="4" height="5"/><rect x="44" y="84" width="4" height="5"/>
              <rect x="62" y="36" width="4" height="5"/><rect x="68" y="36" width="4" height="5"/>
              <rect x="62" y="48" width="4" height="5"/><rect x="68" y="48" width="4" height="5"/>
              <rect x="62" y="60" width="4" height="5"/><rect x="68" y="60" width="4" height="5"/>
              <rect x="62" y="72" width="4" height="5"/><rect x="68" y="72" width="4" height="5"/>
              <rect x="62" y="84" width="4" height="5"/><rect x="68" y="84" width="4" height="5"/>
            </g>
          </svg>
        </div>
        <div className="nb-body">
          <div className="nb-eyebrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            The neighborhood
          </div>
          <h3 className="nb-name">{neighborhoodName}</h3>
          <p className="nb-desc">{nbhDescription}</p>
          <div className="nb-meta">
            <span className="nb-stat">
              <b>{neighborhoodStats.buildingsTracked > 0 ? neighborhoodStats.buildingsTracked.toLocaleString() : "—"}</b>
              <small>buildings tracked</small>
            </span>
            <span className="nb-stat">
              <b>{neighborhoodStats.avgLucidIQ != null ? neighborhoodStats.avgLucidIQ.toFixed(1) : "—"}</b>
              <small>avg LucidIQ</small>
            </span>
            <span className="nb-stat">
              <b>{neighborhoodStats.median1BR != null ? "$" + Math.round(neighborhoodStats.median1BR).toLocaleString() : "—"}</b>
              <small>median 1BR</small>
            </span>
          </div>
          <span className="nb-cta">
            Explore {neighborhoodName}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </Link>

      <Link className="nb-allcta" href={neighborhoodsUrl(city)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Browse all {cityName} neighborhoods
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </Link>
    </section>
  );
}
