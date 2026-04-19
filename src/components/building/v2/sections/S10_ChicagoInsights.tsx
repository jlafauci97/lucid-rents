/**
 * S10 Chicago-Specific Insights — v2-styled card surfacing Chicago-only
 * regulatory and city-program data: RLTO protection, scofflaw status,
 * RLTO violations, lead inspections, demolition permits, affordable
 * housing, and energy benchmarking.
 *
 * Renders nothing if the building has no Chicago-specific data at all.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";

interface Props {
  building: Building;
  chicagoData: BuildingV2Data["chicagoData"];
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function S10_ChicagoInsights({ building, chicagoData }: Props) {
  const hasRLTO = building.is_rlto_protected || building.ward != null || !!building.community_area;
  const hasScofflaw = building.is_scofflaw;
  const hasRltoViolations = chicagoData.rltoViolations.length > 0;
  const hasLead = chicagoData.leadInspections.length > 0;
  const hasDemolitions = chicagoData.demolitions.length > 0;
  const hasAffordable = chicagoData.affordableUnits.length > 0;
  const hasEnergy = !!chicagoData.energyRating && (
    chicagoData.energyRating.energy_star_score != null
    || chicagoData.energyRating.site_eui != null
  );

  const hasAnyData = hasRLTO || hasScofflaw || hasRltoViolations || hasLead || hasDemolitions || hasAffordable || hasEnergy;
  if (!hasAnyData) return null;

  // Lead inspections by risk level
  const leadByRisk = chicagoData.leadInspections.reduce<Record<string, number>>((acc, l) => {
    const k = (l.risk_level ?? "Unknown").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const highLead = (leadByRisk["high"] ?? 0) + (leadByRisk["severe"] ?? 0);

  // Affordable units totals
  const affordableTotals = chicagoData.affordableUnits.reduce(
    (a, u) => ({
      affordable: a.affordable + (u.affordable_units ?? 0),
      total: a.total + (u.total_units ?? 0),
    }),
    { affordable: 0, total: 0 },
  );

  const recentRlto = [...chicagoData.rltoViolations]
    .sort((a, b) => (b.violation_date ?? "").localeCompare(a.violation_date ?? ""))
    .slice(0, 3);
  const recentDemos = [...chicagoData.demolitions]
    .sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))
    .slice(0, 3);

  return (
    <section className="section" id="chicago-insights">
      <div className="section-head">
        <div>
          <div className="num">10 / 10</div>
          <h2>Chicago-specific insights.</h2>
          <p className="ww-sub" style={{ marginTop: 4 }}>RLTO, scofflaw, and city programs</p>
        </div>
        <div className="meta"></div>
      </div>

      {/* ─── Scofflaw warning (top — most urgent) ─────────────── */}
      {hasScofflaw && (
        <div className="ri-card" style={{ borderLeft: "4px solid #dc2626" }}>
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.14)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#991b1b" }}>
                Scofflaw status
                <span className="ri-pill" style={{ background: "rgba(220,38,38,0.14)", color: "#991b1b" }}>City warning</span>
              </h3>
              <p className="ri-sub">This owner is on the City of Chicago&rsquo;s scofflaw list</p>
            </div>
          </header>
          <p className="prose" style={{ fontSize: 14, marginTop: 10, color: "#7f1d1d" }}>
            Scofflaw owners have repeatedly failed to address building code violations or pay city debts. Tenants of scofflaw buildings should be aware of potential maintenance and habitability issues.
          </p>
        </div>
      )}

      {/* ─── RLTO Protection ─────────────────────────────────── */}
      {hasRLTO && (
        <div className={`ri-card ${hasScofflaw ? "ri-mt" : ""}`}>
          <header className="ri-head">
            <span className={`ri-icon ${building.is_rlto_protected ? "good" : "violet"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                RLTO protection
                {building.is_rlto_protected
                  ? <span className="ri-pill" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>Protected</span>
                  : <span className="ri-pill" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>Not covered</span>}
              </h3>
              <p className="ri-sub">Chicago Residential Landlord and Tenant Ordinance</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className={`n ${building.is_rlto_protected ? "good" : ""}`}>{building.is_rlto_protected ? "Yes" : "No"}</div>
              <div className="l">RLTO covered</div>
            </div>
            <div className="s">
              <div className="n">{building.ward != null ? `Ward ${building.ward}` : "—"}</div>
              <div className="l">alderperson</div>
            </div>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{building.community_area ?? "—"}</div>
              <div className="l">community area</div>
            </div>
          </div>

          <small style={{ display: "block", marginTop: 8, opacity: 0.65 }}>
            RLTO grants tenants security-deposit protections, repair-and-deduct rights, and limits on lease terms.
          </small>
        </div>
      )}

      {/* ─── RLTO Violations ─────────────────────────────────── */}
      {hasRltoViolations && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>RLTO violations <span className="ri-pill">{chicagoData.rltoViolations.length}</span></h3>
              <p className="ri-sub">Tenant-protection ordinance enforcement actions</p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentRlto.map((v) => (
              <li key={v.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(v.violation_date)}</span>
                <span className="ll-tl-body">
                  <b>{v.case_number ?? "RLTO violation"}</b>
                  <small>
                    {v.violation_description ?? "Description not on file"}
                    {v.status ? ` · ${v.status}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Lead inspections ─────────────────────────────────── */}
      {hasLead && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v6"/><path d="M12 22v-6"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M2 12h6"/><path d="M16 12h6"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Lead inspections <span className="ri-pill">{chicagoData.leadInspections.length}</span></h3>
              <p className="ri-sub">Lead-paint and water-line risk assessments</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className={`n ${highLead > 0 ? "bad" : "good"}`}>{highLead}</div>
              <div className="l">high risk</div>
            </div>
            <div className="s">
              <div className="n">{leadByRisk["medium"] ?? leadByRisk["moderate"] ?? 0}</div>
              <div className="l">moderate</div>
            </div>
            <div className="s">
              <div className="n good">{leadByRisk["low"] ?? leadByRisk["none"] ?? 0}</div>
              <div className="l">low / clear</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Demolition permits ───────────────────────────────── */}
      {hasDemolitions && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(245,158,11,0.14)", color: "#b45309" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Demolition permits <span className="ri-pill">{chicagoData.demolitions.length}</span></h3>
              <p className="ri-sub">Filed work orders — partial or full demo</p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentDemos.map((d) => (
              <li key={d.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(d.issue_date)}</span>
                <span className="ll-tl-body">
                  <b>{d.permit_number ?? "Permit"}</b>
                  <small>
                    {d.work_description ?? "—"}
                    {d.status ? ` · ${d.status}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Affordable units ─────────────────────────────────── */}
      {hasAffordable && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon good">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Affordable housing <span className="ri-pill">{affordableTotals.affordable.toLocaleString()} units</span></h3>
              <p className="ri-sub">
                {chicagoData.affordableUnits[0]?.project_name ?? "Income-restricted units on site"}
              </p>
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

      {/* ─── Energy benchmarking ──────────────────────────────── */}
      {hasEnergy && chicagoData.energyRating && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Energy benchmark</h3>
              <p className="ri-sub">Chicago Energy Rating disclosure{chicagoData.energyRating.report_year ? ` · ${chicagoData.energyRating.report_year}` : ""}</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className={`n ${(chicagoData.energyRating.energy_star_score ?? 0) >= 75 ? "good" : (chicagoData.energyRating.energy_star_score ?? 0) >= 50 ? "" : "bad"}`}>
                {chicagoData.energyRating.energy_star_score ?? "—"}
              </div>
              <div className="l">ENERGY STAR score</div>
            </div>
            <div className="s">
              <div className="n">{chicagoData.energyRating.site_eui != null ? chicagoData.energyRating.site_eui.toFixed(1) : "—"}</div>
              <div className="l">Site EUI (kBtu/sf)</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
