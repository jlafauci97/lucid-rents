/**
 * S10 Houston-Specific Insights — v2-styled card surfacing Houston-only
 * data: dangerous building cases, industrial/petrochemical proximity,
 * tax appraisal protests, affordable housing, and floodplain info.
 *
 * Renders nothing if the building has no Houston-specific data at all.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";

interface Props {
  building: Building;
  houstonData: BuildingV2Data["houstonData"];
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export function S10_HoustonInsights({ building, houstonData }: Props) {
  const hasDangerous = houstonData.dangerousBuildings.length > 0;
  const hasIndustrial = houstonData.industrialProximity.length > 0;
  const hasTax = houstonData.taxProtests.length > 0;
  const hasAffordable = houstonData.affordableHousing.length > 0;
  const hasFlood = !!building.flood_zone || building.in_floodplain;

  const hasAnyData = hasDangerous || hasIndustrial || hasTax || hasAffordable || hasFlood;
  if (!hasAnyData) return null;

  // Recent dangerous building cases
  const recentDangerous = [...houstonData.dangerousBuildings]
    .sort((a, b) => (b.case_date ?? "").localeCompare(a.case_date ?? ""))
    .slice(0, 3);
  const openDangerous = houstonData.dangerousBuildings.filter(
    (d) => !/closed|resolved|complete/i.test(d.status ?? ""),
  );

  // Industrial proximity — sort by distance, top 3 closest
  const closestFacilities = [...houstonData.industrialProximity]
    .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999))
    .slice(0, 3);
  const totalReleases = houstonData.industrialProximity.reduce(
    (s, f) => s + (f.total_releases_lbs ?? 0),
    0,
  );

  // Tax protests — most recent first
  const recentProtests = [...houstonData.taxProtests]
    .sort((a, b) => (b.protest_year ?? 0) - (a.protest_year ?? 0))
    .slice(0, 3);
  const avgReduction = recentProtests.length
    ? recentProtests.reduce((s, p) => s + (p.reduction_pct ?? 0), 0) / recentProtests.length
    : 0;

  // Affordable
  const affordableTotals = houstonData.affordableHousing.reduce(
    (a, u) => ({
      affordable: a.affordable + (u.affordable_units ?? 0),
      total: a.total + (u.total_units ?? 0),
    }),
    { affordable: 0, total: 0 },
  );

  return (
    <section className="section" id="houston-insights">
      <div className="section-head">
        <div>
          <div className="num">10 / 10</div>
          <h2>Houston-specific insights.</h2>
          <p className="ww-sub" style={{ marginTop: 4 }}>Building safety, environmental, and tax history</p>
        </div>
        <div className="meta"></div>
      </div>

      {/* ─── Dangerous building cases ─────────────────────────── */}
      {hasDangerous && (
        <div className="ri-card" style={openDangerous.length > 0 ? { borderLeft: "4px solid #dc2626" } : undefined}>
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Dangerous building cases
                <span className="ri-pill">{houstonData.dangerousBuildings.length}</span>
                {openDangerous.length > 0 && (
                  <span className="ri-pill" style={{ background: "rgba(220,38,38,0.12)", color: "#991b1b", marginLeft: 6 }}>
                    {openDangerous.length} open
                  </span>
                )}
              </h3>
              <p className="ri-sub">Houston Public Works enforcement actions</p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentDangerous.map((d) => (
              <li key={d.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(d.case_date)}</span>
                <span className="ll-tl-body">
                  <b>{d.case_number ?? "Dangerous structure case"}</b>
                  <small>
                    {d.violation_description ?? "—"}
                    {d.status ? ` · ${d.status}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Industrial proximity (TRI / petrochemical) ──────── */}
      {hasIndustrial && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Industrial proximity
                <span className="ri-pill">{houstonData.industrialProximity.length} facilities</span>
              </h3>
              <p className="ri-sub">Nearby TRI-reporting facilities · {totalReleases > 0 ? <>{Math.round(totalReleases).toLocaleString()} lbs annual releases</> : "no reported releases"}</p>
            </div>
          </header>

          <ul className="ll-others" style={{ marginTop: 12 }}>
            {closestFacilities.map((f) => (
              <li key={f.id} className="ll-other">
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px" }}>
                  <span className="ll-addr" style={{ flex: 1 }}>
                    <b>{f.facility_name ?? "Facility"}</b>
                    <small>{f.industry_type ?? "Industry not classified"}</small>
                  </span>
                  <span className="ll-score">
                    {f.distance_miles != null ? `${f.distance_miles.toFixed(2)} mi` : "—"}
                  </span>
                  {f.total_releases_lbs != null && f.total_releases_lbs > 0 && (
                    <span className="ri-pill" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>
                      {Math.round(f.total_releases_lbs).toLocaleString()} lbs
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Tax protests ─────────────────────────────────────── */}
      {hasTax && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Property tax protests
                <span className="ri-pill">{houstonData.taxProtests.length}</span>
              </h3>
              <p className="ri-sub">HCAD appraisal challenges · avg reduction <b>{avgReduction.toFixed(1)}%</b></p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentProtests.map((p) => (
              <li key={p.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{p.protest_year ?? "—"}</span>
                <span className="ll-tl-body">
                  <b>{fmtMoney(p.original_value)} → {fmtMoney(p.final_value)}</b>
                  <small>
                    {p.reduction_pct != null
                      ? <>Reduction: <b>{p.reduction_pct.toFixed(1)}%</b></>
                      : "Outcome not on file"}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Affordable housing ───────────────────────────────── */}
      {hasAffordable && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon good">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Affordable housing
                <span className="ri-pill">{affordableTotals.affordable.toLocaleString()} units</span>
              </h3>
              <p className="ri-sub">{houstonData.affordableHousing[0]?.project_name ?? "Income-restricted units on site"}</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className="n good">{affordableTotals.affordable.toLocaleString()}</div>
              <div className="l">affordable units</div>
            </div>
            <div className="s">
              <div className="n">{affordableTotals.total.toLocaleString()}</div>
              <div className="l">total units</div>
            </div>
            <div className="s">
              <div className="n">{affordableTotals.total > 0 ? Math.round((affordableTotals.affordable / affordableTotals.total) * 100) + "%" : "—"}</div>
              <div className="l">affordable share</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floodplain ───────────────────────────────────────── */}
      {hasFlood && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><path d="M2 18c2 0 4-2 6-2s4 2 6 2 4-2 6-2 4 2 6 2"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Floodplain
                {building.in_floodplain && (
                  <span className="ri-pill" style={{ background: "rgba(220,38,38,0.12)", color: "#991b1b" }}>In floodplain</span>
                )}
              </h3>
              <p className="ri-sub">FEMA flood hazard layer</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            {building.flood_zone && (
              <div className="s">
                <div className={`n ${/^(A|V)/i.test(building.flood_zone) ? "bad" : ""}`} style={{ fontSize: 18 }}>
                  {building.flood_zone}
                </div>
                <div className="l">FEMA flood zone</div>
              </div>
            )}
            <div className="s">
              <div className={`n ${building.in_floodplain ? "bad" : "good"}`}>{building.in_floodplain ? "Yes" : "No"}</div>
              <div className="l">in floodplain</div>
            </div>
          </div>

          {building.in_floodplain && (
            <small style={{ display: "block", marginTop: 8, color: "#991b1b" }}>
              Flood insurance is typically required for federally-backed mortgages on properties in this floodplain.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
