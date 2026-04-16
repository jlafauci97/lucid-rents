/**
 * SideRail — verbatim port of mockup right rail, lines 4579–5008.
 *
 *   <aside class="sr" aria-label="Building side info">
 *     1. Rent Comparison     (.sr-card with .sr-rent-list)
 *     2. Review Summary      (.sr-card .rs-card)
 *     3. Energy Score        (.sr-card)
 *     4. Walkability & Transit (.sr-card)
 *     5. Nearby Transit      (.sr-card)
 *     6. Nearby Schools      (.sr-card)
 *     7. Nearby Recreation   (.sr-card)
 *     8. Safety & Crime      (.sr-card)
 *     9. At a glance         (.sr-card .sr-facts)
 *    10. Similar Buildings   (.sr-card .sr-similar)
 *   </aside>
 */

import Link from "next/link";
import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { City } from "@/lib/cities";
import { buildingUrl } from "@/lib/seo";

interface Props {
  building: Building;
  data: BuildingV2Data;
  city: City;
  cityPrefix: string;
}

function money(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString();
}

function bedLabel(beds: number): string {
  if (beds === 0) return "Studio";
  if (beds >= 4) return "4+ Bed";
  if (beds === 1) return "1 Bed";
  return `${beds} Bed`;
}

function BuildingMiniIllust() {
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <rect x="18" y="22" width="84" height="88" fill="#dbeafe" stroke="#3B82F6" strokeWidth="2"/>
      <path d="M18 22 L60 6 L102 22" fill="#bfdbfe" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round"/>
      <g fill="#3B82F6">
        <rect x="30" y="36" width="12" height="14"/><rect x="54" y="36" width="12" height="14"/><rect x="78" y="36" width="12" height="14"/>
        <rect x="30" y="58" width="12" height="14"/><rect x="54" y="58" width="12" height="14"/><rect x="78" y="58" width="12" height="14"/>
        <rect x="30" y="80" width="12" height="14"/><rect x="54" y="80" width="12" height="14"/><rect x="78" y="80" width="12" height="14"/>
      </g>
      <rect x="52" y="98" width="16" height="12" fill="#1e40af"/>
    </svg>
  );
}

export function SideRail({ building, data, city, cityPrefix }: Props) {
  // Derive rent comparison rows — only for bedrooms with real per-bedroom data.
  // Never show a row that falls back to a generic median from a different bedroom count.
  const bedBands = [0, 1, 2, 3, 4];
  const latestNbhMonth = data.rents.neighborhood[0]?.month?.slice(0, 7) ?? "";
  const rentRows = bedBands.map((beds) => {
    const mine = data.rents.current.find((r) => r.bedrooms === beds);
    // Only use neighborhood median that matches this exact bedroom count
    const nbhForBed = data.rents.neighborhood.find(
      (r) => r.beds === beds && r.month?.startsWith(latestNbhMonth) && r.median_rent
    );
    const area = nbhForBed?.median_rent ?? null;
    // Skip rows with no building data AND no per-bedroom area data
    if (!mine && !area) return null;
    const lo = mine?.min_rent ?? mine?.median_rent ?? null;
    const hi = mine?.max_rent ?? mine?.median_rent ?? null;
    const mid = mine?.median_rent ?? null;
    const deltaPct = mid && area ? Math.round(((mid - area) / area) * 100) : null;
    return { beds, lo, hi, area, deltaPct };
  }).filter(Boolean) as Array<{ beds: number; lo: number | null; hi: number | null; area: number | null; deltaPct: number | null }>;

  // Review summary stats.
  const rating = data.reviews.avgRating;
  const recommendPct = rating > 0 ? Math.round((rating / 5) * 100) : 0;

  return (
    <aside className="sr" aria-label="Building side info">

      {/* 1 · Rent Comparison */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
          <h4>Rent Comparison</h4>
        </header>
        <div className="sr-banner">— Rents relative to area median</div>
        <ul className="sr-rent-list">
          {rentRows.length ? rentRows.map((r) => (
            <li key={r.beds}>
              <div className="rc-bed">{bedLabel(r.beds)}</div>
              <div className="rc-line">This building: <b>{money(r.lo)} – {money(r.hi)}</b></div>
              <div className="rc-area">
                {r.deltaPct != null
                  ? <>{r.deltaPct === 0 ? "Average (0%)" : r.deltaPct > 0 ? `${r.deltaPct}% above` : `${Math.abs(r.deltaPct)}% below`}</>
                  : "—"}
                <span>Area: {money(r.area)}</span>
              </div>
            </li>
          )) : <li><div className="rc-bed">—</div><div className="rc-line">No rent data</div><div className="rc-area">Check listings</div></li>}
        </ul>
        <footer className="sr-foot">Compared to median rents in {building.zip_code ?? building.borough}</footer>
      </section>

      {/* 2 · Review Summary */}
      <section className="sr-card rs-card">
        <header className="sr-head">
          <span className="sr-icon good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></span>
          <h4>Review Summary</h4>
          <span className="rs-verified">{data.reviews.total.toLocaleString()} reviews</span>
        </header>

        <div className="rs-reco">
          <div className="rs-reco-num">
            <span className="n">{recommendPct}%</span>
            <span className="rs-reco-bar"><span style={{ width: `${recommendPct}%` }}></span></span>
          </div>
          <div className="rs-reco-meta">
            <b>{rating >= 3.5 ? "Would recommend" : "Mixed feedback"}</b>
            <small>Based on {data.reviews.total} reviews{rating > 0 ? ` · avg ${rating.toFixed(1)} ★` : ""}</small>
          </div>
        </div>

        {data.reviews.pullQuotes.length > 0 ? (
          <div className="rs-quotes">
            {data.reviews.pullQuotes.slice(0, 1).map((q) => (
              <div key={q.id} className={`rs-quote ${q.rating >= 4 ? "positive" : "critical"}`}>
                <div className="rs-qhead">
                  {q.rating >= 4
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/></svg>}
                  {q.rating >= 4 ? "MOST HELPFUL POSITIVE" : "MOST HELPFUL CRITICAL"}
                </div>
                <blockquote>&quot;{q.body.length > 160 ? q.body.slice(0, 160).trimEnd() + "…" : q.body}&quot;</blockquote>
                <cite>— {q.display_name ?? "Anonymous"} · {new Date(q.created_at).toLocaleString("en-US", { month: "short", year: "numeric" })}</cite>
              </div>
            ))}
          </div>
        ) : null}

        <a className="sr-link" href="#reviews">Read all {data.reviews.total} reviews →</a>
      </section>

      {/* 3 · Energy Score */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
          <h4>Energy Score</h4>
        </header>
        {data.energy ? (
          <>
            <div className="energy-top">
              <div className="energy-score">
                <div className="n">{(data.energy as unknown as { energy_star_score?: number | null }).energy_star_score ?? "—"}</div>
                <div className="l">
                  <b>{((data.energy as unknown as { energy_star_score?: number | null }).energy_star_score ?? 0) >= 75 ? "High Efficiency" : ((data.energy as unknown as { energy_star_score?: number | null }).energy_star_score ?? 0) >= 50 ? "Average" : "Low Efficiency"}</b>
                  ENERGY STAR Score
                </div>
              </div>
            </div>
            <div className="energy-stats">
              <div className="es-row"><span className="k">Site EUI</span><span className="v">{(data.energy as unknown as { site_eui?: number | null }).site_eui ?? "—"} kBtu/ft²</span></div>
              <div className="es-row"><span className="k">GHG Emissions</span><span className="v">{(data.energy as unknown as { total_ghg_emissions?: number | null }).total_ghg_emissions ?? "—"} tCO<sub>2</sub>e</span></div>
            </div>
            <div className="sr-foot">{(data.energy as unknown as { report_year?: number | null }).report_year ?? ""} benchmarking data</div>
          </>
        ) : (
          <div className="sr-foot" style={{ padding: "12px 0" }}>No energy benchmarking on file.</div>
        )}
      </section>

      {/* 4 · Walkability & Transit — derived from real nearby-stop data */}
      {(() => {
        const subwayCount = data.nearby.transitSubway.length;
        const busCount = data.nearby.transitBus.length;
        const closestSubwayMi = data.nearby.transitSubway[0]?.distMiles ?? 2;
        const closestBusMi = data.nearby.transitBus[0]?.distMiles ?? 2;
        let transitScore = 0;
        if (subwayCount > 0) transitScore += 40 + Math.max(0, 30 - closestSubwayMi * 60);
        if (busCount > 0) transitScore += 20 + Math.max(0, 10 - closestBusMi * 30);
        transitScore = Math.min(100, Math.round(transitScore));
        const label = transitScore >= 90 ? "Walker's Paradise" : transitScore >= 70 ? "Very walkable" : transitScore >= 50 ? "Somewhat walkable" : transitScore >= 25 ? "Car-dependent" : "Limited transit";
        const closest = subwayCount > 0 && closestSubwayMi < closestBusMi
          ? { mode: "Subway", min: Math.max(1, Math.round(closestSubwayMi * 20)) }
          : busCount > 0
            ? { mode: "Bus", min: Math.max(1, Math.round(closestBusMi * 20)) }
            : null;
        return (
          <section className="sr-card">
            <header className="sr-head">
              <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2"/><path d="M10 22v-7l-2 1-3-4 4-3 4 2 3 4-3 2-1 5z"/></svg></span>
              <h4>Walkability &amp; Transit</h4>
            </header>
            <div className="walk-top">
              <div className="walk-score-ring">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray={`${transitScore} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)"/>
                </svg>
                <span className="n">{transitScore}</span>
              </div>
              <div className="walk-summary">
                <b>{label}</b>
                <small>Transit score · {subwayCount + busCount} nearby stops</small>
              </div>
            </div>
            {closest ? (
              <>
                <div className="sr-divline"></div>
                <div className="walk-sub">
                  <div className="ws-row"><span className="k">Nearest Transit</span><span className="v">{closest.mode} · {closest.min} min walk</span></div>
                  <div className="ws-row"><span className="k">Nearby Stops</span><span className="v">{subwayCount + busCount}</span></div>
                </div>
                <div className="sr-tagrow">
                  {subwayCount > 0 ? <span className="sr-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="16" rx="2"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M4 11h16"/></svg>Subway</span> : null}
                  {busCount > 0 ? <span className="sr-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6v6M16 6v6M2 12h20M7 18h.01M17 18h.01M20 18V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10"/></svg>Bus</span> : null}
                </div>
              </>
            ) : null}
          </section>
        );
      })()}

      {/* 5 · Nearby Transit — subway + bus from transit_stops */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="16" rx="2"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M4 11h16"/></svg></span>
          <h4>Nearby Transit</h4>
        </header>
        {data.nearby.transitSubway.length > 0 ? (
          <>
            <div className="sr-sub">SUBWAY</div>
            <ul className="sr-list">
              {data.nearby.transitSubway.map((s) => (
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
        {data.nearby.transitBus.length > 0 ? (
          <>
            <div className="sr-sub">BUS</div>
            <ul className="sr-list">
              {data.nearby.transitBus.map((s) => (
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
        {data.nearby.transitSubway.length === 0 && data.nearby.transitBus.length === 0 ? (
          <div className="sr-foot" style={{ padding: "12px 0" }}>No transit stops within 0.8 mi on file.</div>
        ) : null}
      </section>

      {/* 6 · Nearby Schools & Colleges — from nearby_schools */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg></span>
          <h4>Nearby Schools &amp; Colleges</h4>
        </header>
        {data.nearby.schoolsPublic.length > 0 ? (
          <>
            <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>PUBLIC SCHOOLS</div>
            <ul className="sr-list">
              {data.nearby.schoolsPublic.map((s) => (
                <li key={s.school_id}>
                  <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                  <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {data.nearby.schoolsCharter.length > 0 ? (
          <>
            <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>CHARTER SCHOOLS</div>
            <ul className="sr-list">
              {data.nearby.schoolsCharter.map((s) => (
                <li key={s.school_id}>
                  <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                  <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {data.nearby.schoolsPrivate.length > 0 ? (
          <>
            <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>PRIVATE SCHOOLS</div>
            <ul className="sr-list">
              {data.nearby.schoolsPrivate.map((s) => (
                <li key={s.school_id}>
                  <div className="nt-info"><b>{s.name}</b>{s.grades ? <span className="grade">{s.grades}</span> : null}</div>
                  <div className="nt-dist">{s.distMiles.toFixed(1)} mi<small>{s.walkMin} min</small></div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {data.nearby.schoolsPublic.length === 0 && data.nearby.schoolsCharter.length === 0 && data.nearby.schoolsPrivate.length === 0 ? (
          <div className="sr-foot" style={{ padding: "12px 0" }}>No schools within 0.8 mi on file.</div>
        ) : null}
      </section>

      {/* 7 · Nearby Recreation — client-side fetch from /api/recreation/nearby (Overpass) */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M6 8a6 6 0 0 1 12 0c0 5-6 10-6 10S6 13 6 8z"/></svg></span>
          <h4>Nearby Recreation</h4>
        </header>
        <div className="sr-foot" style={{ padding: "12px 0" }}>
          Parks, gyms &amp; entertainment load on-demand from OpenStreetMap. See the Location section for live data.
        </div>
      </section>

      {/* 8 · Safety & Crime — aggregated from nypd_complaints in this zip, last 12 months */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
          <h4>Safety &amp; Crime</h4>
        </header>
        <div className="walk-top">
          <div className="walk-score-ring">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={data.crime.safetyScore >= 70 ? "#10b981" : data.crime.safetyScore >= 40 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${data.crime.safetyScore} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)"/>
            </svg>
            <span className="n">{data.crime.safetyScore}</span>
          </div>
          <div className="walk-summary">
            <b>{data.crime.safetyScore >= 80 ? "Very safe" : data.crime.safetyScore >= 60 ? "Above average" : data.crime.safetyScore >= 40 ? "Area average" : "Below average"}</b>
            <small>Safety score · last 12 months</small>
          </div>
        </div>
        <div className="sr-divline"></div>

        <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>LAST 12 MONTHS · {building.zip_code ?? "AREA"}</div>
        <div className="es-row"><span className="k">Violent</span><span className="v">{data.crime.violent.toLocaleString()}</span></div>
        <div className="es-row"><span className="k">Property</span><span className="v">{data.crime.property.toLocaleString()}</span></div>
        <div className="es-row"><span className="k">Quality-of-life</span><span className="v">{data.crime.qualityOfLife.toLocaleString()}</span></div>
        <div className="es-row"><span className="k">Total incidents</span><span className="v">{data.crime.total12mo.toLocaleString()}</span></div>

        {data.crime.precinct ? (
          <>
            <div className="sr-sub" style={{ marginTop: 16 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>PRECINCT</div>
            <div className="es-row"><span className="k">Top precinct</span><span className="v">#{data.crime.precinct}</span></div>
          </>
        ) : null}

        <div className="sr-foot">NYPD CompStat · {data.crime.total12mo > 0 ? "updated weekly" : "no records in this zip"}</div>
      </section>

      {/* 9 · At a glance */}
      <section className="sr-card sr-facts">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-6h6v6M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg></span>
          <h4>At a glance</h4>
        </header>
        <div className="es-row"><span className="k">Year built</span><span className="v">{building.year_built ?? "—"}</span></div>
        <div className="es-row"><span className="k">Floors</span><span className="v">{building.num_floors ?? "—"}</span></div>
        <div className="es-row"><span className="k">Total units</span><span className="v">{building.total_units?.toLocaleString() ?? "—"}</span></div>
        <div className="es-row"><span className="k">Rent-stab units</span><span className="v">{building.is_rent_stabilized && building.total_units ? `${building.total_units.toLocaleString()}` : "—"}</span></div>
        <div className="es-row"><span className="k">Class</span><span className="v">{building.building_class ?? "—"}</span></div>
        {building.bbl ? <div className="es-row"><span className="k">BBL</span><span className="v mono-v">{building.bbl}</span></div> : null}
        {building.bin ? <div className="es-row"><span className="k">BIN</span><span className="v mono-v">{building.bin}</span></div> : null}
      </section>

      {/* 10 · Similar Buildings (5 cards) */}
      <section className="sr-card sr-similar">
        <header className="sr-head">
          <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
          <h4>Similar Buildings</h4>
        </header>

        <div className="sr-sb-list">
          {data.similar.slice(0, 5).map((b) => {
            const street = b.full_address.split(",")[0] ?? b.full_address;
            return (
              <article key={b.id} className="sr-sb">
                <div className="sr-sb-illust">
                  <BuildingMiniIllust />
                </div>
                <div className="sr-sb-body">
                  <h5>{street}</h5>
                  {b.full_address !== street ? <div className="sr-sb-addr">{b.full_address}</div> : null}
                  <div className="sr-sb-meta">
                    <span className="sb-chip">{b.borough}</span>
                    {b.year_built ? <span className="sb-year">Built {b.year_built}</span> : null}
                  </div>
                  <Link className="sb-btn" href={buildingUrl({ borough: b.borough, slug: b.slug }, city)}>View building</Link>
                </div>
              </article>
            );
          })}
          {data.similar.length === 0 ? (
            <article className="sr-sb">
              <div className="sr-sb-illust"><BuildingMiniIllust /></div>
              <div className="sr-sb-body">
                <h5>No similar buildings found</h5>
                <div className="sr-sb-meta"><span className="sb-chip">—</span></div>
              </div>
            </article>
          ) : null}
        </div>
      </section>

    </aside>
  );
}
