/**
 * S05 The Landlord — verbatim port of mockup lines 3954–4106.
 *
 *   <section class="section" id="landlord">
 *     <div class="section-head">…05 / 09 The landlord.…</div>
 *     <div class="landlord-card">  (identity + portfolio shield + stats)
 *     <div class="landlord-card ll-mt">  (Their Other Buildings — .ll-others)
 *     <div class="landlord-card ll-mt">  (Ownership timeline — .ll-timeline)
 *   </section>
 */

import Link from "next/link";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { landlordUrl, buildingUrl } from "@/lib/seo";
import { normalizeScore } from "@/lib/constants";

interface Props {
  building: Building;
  landlord: BuildingV2Data["landlord"];
  city: City;
}

// Maps an overall_score (stored 0-5, sometimes 0-100) to {letter, CSS class,
// 0-10 formatted string} for the landlord shield + building-list badges.
function scoreToGrade10(score: number | null): { letter: string; cls: string; score10: string } {
  if (score == null) return { letter: "—", cls: "ll-g-c", score10: "—" };
  const s = normalizeScore(score); // → 0-5
  const score10 = (s * 2).toFixed(1); // display as X.X / 10
  if (s >= 4.5) return { letter: "A", cls: "ll-g-a", score10 };
  if (s >= 4.0) return { letter: "A-", cls: "ll-g-a", score10 };
  if (s >= 3.65) return { letter: "B+", cls: "ll-g-b", score10 };
  if (s >= 3.3) return { letter: "B", cls: "ll-g-b", score10 };
  if (s >= 3.0) return { letter: "B-", cls: "ll-g-b", score10 };
  if (s >= 2.65) return { letter: "C+", cls: "ll-g-c", score10 };
  if (s >= 2.3) return { letter: "C", cls: "ll-g-c", score10 };
  if (s >= 2.0) return { letter: "C-", cls: "ll-g-c", score10 };
  if (s >= 1.0) return { letter: "D", cls: "ll-g-c", score10 };
  return { letter: "F", cls: "ll-g-c", score10 };
}

export function S05_Landlord({ building, landlord, city }: Props) {
  const portfolio = scoreToGrade10(landlord.portfolioAvgScore);
  const landlordSlug = landlord.name ? landlordUrl(landlord.name, city) : "#";
  // Sort other buildings by score desc, then cap at 5.
  const others = [...landlord.otherBuildings]
    .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
    .slice(0, 5);

  return (
    <section className="section" id="landlord">
      <div className="section-head">
        <div>
          <div className="num">05 / 09</div>
          <h2>The landlord.</h2>
        </div>
        <div className="meta"></div>
      </div>

      {/* Landlord identity card with portfolio grade shield */}
      <div className="landlord-card">
        <div className="ll-id">
          <div className="ll-id-main">
            <h3 className="landlord-name">{landlord.name ?? "Owner not yet identified"}</h3>
            <div className="landlord-meta">
              {landlord.name ? <span><b>Portfolio of {landlord.portfolioSize.toLocaleString()} building{landlord.portfolioSize === 1 ? "" : "s"}</b></span> : null}
              {building.management_company && building.management_company !== landlord.name
                ? <span>Managed by {building.management_company}</span>
                : null}
            </div>
            <p className="prose" style={{ fontSize: "var(--f-16)", maxWidth: "none", marginTop: "var(--s-3)" }}>
              {landlord.name
                ? `Portfolio-level grade reflects the landlord's buildings across ${city === "nyc" ? "NYC" : "the city"}, weighted by unit count. Individual building grades may differ.`
                : `No owner is currently linked to this building in public records. Ownership data is pulled from ACRIS deeds and HPD registrations.`}
            </p>
            {landlord.name ? (
              <Link className="ll-profile" href={landlordSlug}>
                View full landlord profile
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            ) : null}
          </div>

          {/* Portfolio Grade shield */}
          <aside className="ll-grade">
            <div className="ll-grade-eyebrow">Portfolio Grade</div>
            <div className="ll-grade-badge">
              <svg viewBox="0 0 64 76" width="64" height="76">
                <path d="M32 2L4 14V34C4 54 32 72 32 72C32 72 60 54 60 34V14L32 2Z" fill="#3B82F6"/>
              </svg>
              <div className="ll-grade-text">
                <span className="letter">{portfolio.letter}</span>
                <span className="score">{portfolio.score10}</span>
              </div>
            </div>
            <div className="ll-grade-meta">
              {landlord.portfolioSize > 0
                ? <>Averaged across <b>{landlord.portfolioSize} building{landlord.portfolioSize === 1 ? "" : "s"}</b></>
                : <>No portfolio data</>}
            </div>
          </aside>
        </div>

        <div className="landlord-stats">
          <div className="s"><div className="n blue">{landlord.portfolioSize.toLocaleString()}</div><div className="l">buildings</div></div>
          <div className="s"><div className="n">{landlord.portfolioAvgScore != null ? normalizeScore(landlord.portfolioAvgScore).toFixed(1) : "—"}</div><div className="l">avg score / 5</div></div>
          <div className="s"><div className="n good">{portfolio.letter}</div><div className="l">portfolio grade</div></div>
          <div className="s"><div className="n">{landlord.otherBuildings.length}</div><div className="l">nearby owned</div></div>
        </div>
      </div>

      {/* Their Other Buildings */}
      {others.length > 0 ? (
        <div className="landlord-card ll-mt">
          <header className="ww-head">
            <div>
              <h3>Their Other Buildings</h3>
              <p className="ww-sub">Top {others.length} by score{landlord.portfolioSize > others.length ? ` · of ${landlord.portfolioSize} total` : ""}</p>
            </div>
            {landlord.name ? <Link className="ri-pill ll-see-all" href={landlordSlug}>See all {landlord.portfolioSize} →</Link> : null}
          </header>
          <ul className="ll-others">
            {others.map((b) => {
              const g = scoreToGrade10(b.overall_score);
              return (
                <li key={b.id} className="ll-other">
                  <Link href={buildingUrl({ borough: b.borough, slug: b.slug }, city)}>
                    <span className={`ll-g ${g.cls}`}>{g.letter}</span>
                    <span className="ll-addr">
                      <b>{b.full_address.split(",")[0] ?? b.full_address}</b>
                      <small>{b.borough}</small>
                    </span>
                    <span className="ll-score">{g.score10} / 10</span>
                    <svg className="ll-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Ownership timeline · placeholder until ACRIS deed data is loaded */}
      <div className="landlord-card ll-mt">
        <header className="ww-head">
          <div>
            <h3>Ownership timeline · this building</h3>
            <p className="ww-sub">ACRIS deeds and regulatory filings</p>
          </div>
        </header>
        <ol className="ll-timeline">
          {building.year_built ? (
            <li className="ll-tl">
              <span className="ll-tl-dot"></span>
              <span className="ll-tl-year">{building.year_built}</span>
              <span className="ll-tl-body"><b>Building constructed</b><small>{building.total_units ? `${building.total_units.toLocaleString()} units` : ""}{building.num_floors ? `${building.total_units ? " · " : ""}${building.num_floors} floors` : ""}</small></span>
            </li>
          ) : null}
          <li className="ll-tl">
            <span className="ll-tl-dot current"></span>
            <span className="ll-tl-year">now</span>
            <span className="ll-tl-body"><b>{landlord.name ?? "Current owner"}</b><small>Owner of record per HPD registration{landlord.portfolioSize > 1 ? ` · manages ${landlord.portfolioSize} buildings` : ""}.</small></span>
          </li>
          <li className="ll-tl future">
            <span className="ll-tl-dot"></span>
            <span className="ll-tl-year">tbd</span>
            <span className="ll-tl-body"><b>Deed history</b><small>ACRIS deed aggregation coming in a follow-up.</small></span>
          </li>
        </ol>
      </div>
    </section>
  );
}
