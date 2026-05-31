/**
 * "About this area" — the merged neighborhood hub.
 *
 * Consolidates what used to be three separate pieces:
 *   - S06 "Location & daily life" (map + walk/transit/bike rings + neighborhood
 *     feature card with demographics & vibe),
 *   - the right-rail "Nearby Transit" and "Nearby Schools" cards (now cleared
 *     from the side rail and surfaced here in full detail),
 *   - the old `BuildingAreaSection` cross-links (now <AreaCrossLinks/>).
 *
 * One section, one wayfinder entry (#about-this-area). The old standalone
 * "Location" nav entry is gone.
 */

import Link from "next/link";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { neighborhoodUrl, neighborhoodsUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { getNeighborhoodVibe } from "@/lib/neighborhood-vibes";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import { BigMap } from "@/components/building/v2/BigMap";
import { AreaCrossLinks } from "@/components/building/v2/sections/AreaCrossLinks";

interface Props {
  building: Building;
  city: City;
  nearby: BuildingV2Data["nearby"];
  neighborhoodStats: BuildingV2Data["neighborhoodStats"];
  demographics: BuildingV2Data["demographics"];
  vibe: BuildingV2Data["vibe"];
}

// Derive walk/transit/bike scores from real nearby-stop data.
function deriveScores(nearby: BuildingV2Data["nearby"]): { walk: number; transit: number; bike: number } {
  const subwayCount = nearby.transitSubway.length;
  const busCount = nearby.transitBus.length;
  const schoolCount = nearby.schoolsPublic.length + nearby.schoolsCharter.length + nearby.schoolsPrivate.length;
  const closestSubwayMi = nearby.transitSubway[0]?.distMiles ?? 2;
  const closestBusMi = nearby.transitBus[0]?.distMiles ?? 2;

  let transit = 0;
  if (subwayCount > 0) transit += 40 + Math.max(0, 30 - closestSubwayMi * 60);
  if (busCount > 0) transit += 20 + Math.max(0, 10 - closestBusMi * 30);
  transit = Math.min(100, Math.round(transit));

  const walk = Math.min(100, Math.round(transit * 0.7 + Math.min(schoolCount * 4, 30)));
  const bike = Math.max(0, Math.round(walk * 0.85));
  return { walk, transit, bike };
}

function coords(b: Building): string {
  const lat = b.latitude; const lon = b.longitude;
  if (lat != null && lon != null) return `${Number(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}, ${Number(lon).toFixed(3)}° ${lon >= 0 ? "E" : "W"}`;
  return "";
}

/** Detailed nearby transit (subway + bus). Ported from the cleared side rail. */
function NearbyTransitCard({ nearby }: { nearby: BuildingV2Data["nearby"] }) {
  return (
    <section className="sr-card">
      <header className="sr-head">
        <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="16" rx="2"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M4 11h16"/></svg></span>
        <h4>Nearby Transit</h4>
      </header>
      {nearby.transitSubway.length > 0 ? (
        <>
          <div className="sr-sub">SUBWAY</div>
          <ul className="sr-list">
            {nearby.transitSubway.map((s) => (
              <li key={s.stop_id}>
                <div className="nt-info">
                  <b>{s.name}</b>
                  {s.lines?.length ? <span className="lines">{s.lines.slice(0, 5).map((ln) => <span key={ln} className="line r1">{ln}</span>)}</span> : null}
                </div>
                <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {nearby.transitBus.length > 0 ? (
        <>
          <div className="sr-sub">BUS</div>
          <ul className="sr-list">
            {nearby.transitBus.map((s) => (
              <li key={s.stop_id}>
                <div className="nt-info">
                  <b>{s.name}</b>
                  {s.lines?.length ? <span className="lines">{s.lines.slice(0, 4).map((ln) => <span key={ln} className="line bus">{ln}</span>)}</span> : null}
                </div>
                <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/** Detailed nearby schools (public / charter / private). Ported from the cleared side rail. */
function NearbySchoolsCard({ nearby }: { nearby: BuildingV2Data["nearby"] }) {
  return (
    <section className="sr-card">
      <header className="sr-head">
        <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg></span>
        <h4>Nearby Schools &amp; Colleges</h4>
      </header>
      {nearby.schoolsPublic.length > 0 ? (
        <>
          <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>PUBLIC SCHOOLS</div>
          <ul className="sr-list">
            {nearby.schoolsPublic.map((s) => (
              <li key={s.school_id}>
                <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {nearby.schoolsCharter.length > 0 ? (
        <>
          <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>CHARTER SCHOOLS</div>
          <ul className="sr-list">
            {nearby.schoolsCharter.map((s) => (
              <li key={s.school_id}>
                <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {nearby.schoolsPrivate.length > 0 ? (
        <>
          <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>PRIVATE SCHOOLS</div>
          <ul className="sr-list">
            {nearby.schoolsPrivate.map((s) => (
              <li key={s.school_id}>
                <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export function AboutThisArea({ building, city, nearby, neighborhoodStats, demographics, vibe }: Props) {
  const { walk: w, transit: t, bike: bk } = deriveScores(nearby);
  const cityName = ((CITY_META as Record<string, { name?: string; fullName?: string }>)[city])?.name ?? city;
  const borough = building.borough;
  const street = building.full_address.split(",")[0] ?? building.full_address;

  const realNbhName = building.zip_code ? getNeighborhoodNameByCity(building.zip_code, city) : null;
  const neighborhoodName = realNbhName || borough;
  const neighborhoodHref = building.zip_code ? neighborhoodUrl(building.zip_code, city) : "#";
  const localVibe = building.zip_code ? getNeighborhoodVibe(city, building.zip_code) : null;
  const nbhDescription = vibe?.description
    ?? localVibe?.description
    ?? `Learn more about ${neighborhoodName}${cityName ? ` in ${cityName}` : ""} — buildings tracked, typical rents, and resident sentiment.`;
  const vibeTags = vibe?.tags?.length ? vibe.tags : localVibe?.vibeTags ?? [];

  const hasTransit = nearby.transitSubway.length > 0 || nearby.transitBus.length > 0;
  const hasSchools = nearby.schoolsPublic.length > 0 || nearby.schoolsCharter.length > 0 || nearby.schoolsPrivate.length > 0;

  const ring = (val: number) => (
    <svg className="ring" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(0.92 0.01 240)" strokeWidth="3"/>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(0.32 0.10 250)" strokeWidth="3" strokeDasharray={`${val} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)"/>
    </svg>
  );

  return (
    <section className="section" id="about-this-area">
      <div className="section-head">
        <div>
          <div className="num">07 / 10</div>
          <h2>About this area.</h2>
        </div>
        <div className="meta">{neighborhoodName}{building.zip_code ? ` · ${building.zip_code}` : ""}</div>
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
          <div style={{ fontSize: 11, opacity: 0.55, textAlign: "center", marginTop: 6 }}>Estimated from nearby transit &amp; amenity data</div>
          <div className="nearby">
            {nearby.transitSubway.length > 0 && (
              <div className="row">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 6, opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  {nearby.transitSubway[0].name}
                </span>
                <span className="d">{nearby.transitSubway[0].walkMin} min walk</span>
              </div>
            )}
            {nearby.transitBus.length > 0 && (
              <div className="row">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 6, opacity: 0.5 }}><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
                  {nearby.transitBus.length} bus stop{nearby.transitBus.length > 1 ? "s" : ""} nearby
                </span>
                <span className="d">{nearby.transitBus[0].walkMin} min</span>
              </div>
            )}
            {(nearby.schoolsPublic.length > 0 || nearby.schoolsCharter.length > 0) && (
              <div className="row">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 6, opacity: 0.5 }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 12 3 12 0v-5"/></svg>
                  {nearby.schoolsPublic.length + nearby.schoolsCharter.length} school{nearby.schoolsPublic.length + nearby.schoolsCharter.length > 1 ? "s" : ""} nearby
                </span>
                <span className="d">{(nearby.schoolsPublic[0] ?? nearby.schoolsCharter[0])?.walkMin} min</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed nearby transit + schools — moved out of the cleared side rail */}
      {(hasTransit || hasSchools) && (
        <div className="area-detail-grid">
          {hasTransit && <NearbyTransitCard nearby={nearby} />}
          {hasSchools && <NearbySchoolsCard nearby={nearby} />}
        </div>
      )}

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
          {(demographics?.population != null || demographics?.median_income != null || demographics?.renter_pct != null) && (
            <div className="nb-meta" style={{ marginTop: 4 }}>
              {demographics.population != null && (
                <span className="nb-stat">
                  <b>{demographics.population.toLocaleString()}</b>
                  <small>population</small>
                </span>
              )}
              {demographics.median_income != null && (
                <span className="nb-stat">
                  <b>${Math.round(demographics.median_income / 1000)}k</b>
                  <small>median income</small>
                </span>
              )}
              {demographics.renter_pct != null && (
                <span className="nb-stat">
                  <b>{Math.round(demographics.renter_pct)}%</b>
                  <small>renters</small>
                </span>
              )}
            </div>
          )}
          {vibeTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {vibeTags.slice(0, 6).map((tag) => (
                <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(59,130,246,0.08)", color: "oklch(0.45 0.10 250)" }}>{tag}</span>
              ))}
            </div>
          )}
          <span className="nb-cta">
            Explore {neighborhoodName}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </Link>

      {/* Internal cross-links to neighborhood / crime / rent hub pages */}
      <AreaCrossLinks city={city} zipCode={building.zip_code ?? null} />

      <Link className="nb-allcta" href={neighborhoodsUrl(city)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Browse all {cityName} neighborhoods
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </Link>
    </section>
  );
}
