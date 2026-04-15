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
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
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
  // Derive rent comparison rows for each common bedroom band.
  const bedBands = [0, 1, 2, 3, 4];
  const rentRows = bedBands.map((beds) => {
    const mine = data.rents.current.find((r) => r.bedrooms === beds);
    // Area average: fall back to latest neighborhood median.
    const area = data.rents.neighborhood[0]?.median_rent ?? null;
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

      {/* 4 · Walkability & Transit summary — placeholder scores (see S06 for rings) */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2"/><path d="M10 22v-7l-2 1-3-4 4-3 4 2 3 4-3 2-1 5z"/></svg></span>
          <h4>Walkability &amp; Transit</h4>
        </header>
        <div className="walk-top">
          <div className="walk-score-ring">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="95 100" strokeDashoffset="25" transform="rotate(-90 18 18)"/>
            </svg>
            <span className="n">95</span>
          </div>
          <div className="walk-summary">
            <b>Walker&apos;s Paradise</b>
            <small>Estimated walk score for this area</small>
          </div>
        </div>
      </section>

      {/* 5 · Nearby Transit — placeholder until nearby queries land */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="16" rx="2"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M4 11h16"/></svg></span>
          <h4>Nearby Transit</h4>
        </header>
        <div className="sr-foot" style={{ padding: "12px 0" }}>
          Nearby transit lookup is wired in the production route. This preview card is a placeholder.
        </div>
      </section>

      {/* 6 · Nearby Schools — placeholder */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg></span>
          <h4>Nearby Schools &amp; Colleges</h4>
        </header>
        <div className="sr-foot" style={{ padding: "12px 0" }}>
          Nearby schools lookup will populate here once the sidebar data sync lands for v2.
        </div>
      </section>

      {/* 7 · Nearby Recreation — placeholder */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22V12M6 8a6 6 0 0 1 12 0c0 5-6 10-6 10S6 13 6 8z"/></svg></span>
          <h4>Nearby Recreation</h4>
        </header>
        <div className="sr-foot" style={{ padding: "12px 0" }}>
          Parks, gyms &amp; libraries appear here once the sidebar data sync lands for v2.
        </div>
      </section>

      {/* 8 · Safety & Crime — placeholder values styled to mockup */}
      <section className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
          <h4>Safety &amp; Crime</h4>
        </header>
        <div className="walk-top">
          <div className="walk-score-ring">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3B82F6" strokeWidth="3" strokeDasharray="78 100" strokeDashoffset="25" transform="rotate(-90 18 18)"/>
            </svg>
            <span className="n">78</span>
          </div>
          <div className="walk-summary">
            <b>Area average</b>
            <small>Safety score · placeholder</small>
          </div>
        </div>
        <div className="sr-divline"></div>
        <div className="sr-sub">LAST 12 MONTHS · LIVE DATA SOON</div>
        <div className="sr-foot" style={{ paddingTop: 8 }}>NYPD CompStat aggregation will replace these placeholders.</div>
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
