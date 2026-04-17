/**
 * S10 LA-Specific Insights — v2-styled card surfacing Los Angeles-only
 * regulatory and hazard data: RSO, fire/soft-story hazards, earthquake
 * retrofit, tenant buyouts, SCEP inspections, CalEnviroScreen, Ellis Act,
 * parking, and Fair Plan insurance risk.
 *
 * Renders nothing if the building has no LA-specific data at all.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";

interface Props {
  building: Building;
  laData: BuildingV2Data["laData"];
}

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
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

// Pick an accent class for fire-hazard severity.
function fireSeverityClass(zone: string | null): "good" | "amber" | "bad" {
  if (!zone) return "good";
  const z = zone.toLowerCase();
  if (/very\s*high/.test(z)) return "bad";
  if (/high/.test(z)) return "bad";
  if (/moderate/.test(z)) return "amber";
  return "good";
}

export function S10_LAInsights({ building, laData }: Props) {
  // ─── Determine which sub-cards have meaningful data ────────
  const hasRSO = building.is_rent_stabilized || (building.stabilized_units ?? 0) > 0 || building.stabilized_year != null;
  const hasHazards = !!building.fire_hazard_zone || building.is_soft_story || !!building.soft_story_status;
  const hasRetrofit = !!laData.earthquakeRetrofit && (
    !!laData.earthquakeRetrofit.retrofit_type
    || !!laData.earthquakeRetrofit.compliance_status
    || !!laData.earthquakeRetrofit.deadline
  );
  const hasBuyouts = laData.buyouts.length > 0;
  const hasScep = laData.scepInspections.length > 0;
  const hasEnviro = building.calenviroscreen_percentile != null;
  const hasEllis = building.ellis_act_filing;
  const hasParking = !!building.parking_type || building.car_dependency_score != null;
  const hasFairPlan = building.fair_plan_risk;

  const hasAnyData = hasRSO || hasHazards || hasRetrofit || hasBuyouts || hasScep || hasEnviro || hasEllis || hasParking || hasFairPlan;
  if (!hasAnyData) return null;

  // Buyouts aggregates
  const buyoutTotal = laData.buyouts.reduce((sum, b) => sum + (b.compensation_amount ?? 0), 0);
  const recentBuyouts = [...laData.buyouts]
    .sort((a, b) => (b.disclosure_date ?? "").localeCompare(a.disclosure_date ?? ""))
    .slice(0, 3);

  // SCEP latest
  const latestScep = [...laData.scepInspections]
    .sort((a, b) => (b.inspection_date ?? "").localeCompare(a.inspection_date ?? ""))[0];

  const fireCls = fireSeverityClass(building.fire_hazard_zone);

  return (
    <section className="section" id="la-insights">
      <div className="section-head">
        <div>
          <div className="num">10 / 10</div>
          <h2>LA-specific insights.</h2>
          <p className="ww-sub" style={{ marginTop: 4 }}>RSO, hazards, and tenant protections</p>
        </div>
        <div className="meta"></div>
      </div>

      {/* ─── RSO + Ellis Act ─────────────────────────────────── */}
      {(hasRSO || hasEllis) && (
        <div className="ri-card">
          <header className="ri-head">
            <span className={`ri-icon ${building.is_rent_stabilized ? "good" : "violet"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Rent Stabilization (RSO)
                {building.is_rent_stabilized
                  ? <span className="ri-pill" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>Protected</span>
                  : <span className="ri-pill" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>Not RSO</span>}
              </h3>
              <p className="ri-sub">Los Angeles Rent Stabilization Ordinance</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className={`n ${building.is_rent_stabilized ? "good" : ""}`}>{building.is_rent_stabilized ? "Yes" : "No"}</div>
              <div className="l">RSO protected</div>
            </div>
            <div className="s">
              <div className="n">{building.stabilized_units != null ? building.stabilized_units.toLocaleString() : "—"}</div>
              <div className="l">stabilized units</div>
            </div>
            <div className="s">
              <div className="n">{building.stabilized_year ?? "—"}</div>
              <div className="l">since</div>
            </div>
            <div className="s">
              <div className={`n ${hasEllis ? "bad" : ""}`}>{hasEllis ? "Filed" : "None"}</div>
              <div className="l">Ellis Act</div>
            </div>
          </div>

          {hasEllis && (
            <div style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.18)",
              fontSize: 13,
              color: "#7f1d1d",
            }}>
              <b>Ellis Act filing on record.</b> Owners may withdraw rent-stabilized units from the rental market under California&rsquo;s Ellis Act, which can lead to mass evictions of tenants.
            </div>
          )}

          <small style={{ display: "block", marginTop: 8, opacity: 0.65 }}>
            RSO buildings have annual rent-increase caps and just-cause eviction protections.
          </small>
        </div>
      )}

      {/* ─── Hazard Zones (Fire + Soft Story) ─────────────────── */}
      {hasHazards && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17h2a2.5 2.5 0 0 0 0-5H10A2.5 2.5 0 0 1 10 7h4a2.5 2.5 0 0 1 2.45 2"/><path d="M12 4v16"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Hazard zones <span className="ri-pill" style={{ background: "rgba(220,38,38,0.12)", color: "#991b1b" }}>Safety</span></h3>
              <p className="ri-sub">Fire severity and seismic risk</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            {building.fire_hazard_zone && (
              <div className="s">
                <div className={`n ${fireCls === "bad" ? "bad" : fireCls === "amber" ? "" : "good"}`} style={{ fontSize: 18 }}>
                  {building.fire_hazard_zone}
                </div>
                <div className="l">fire hazard zone</div>
              </div>
            )}
            <div className="s">
              <div className={`n ${building.is_soft_story ? "bad" : "good"}`}>{building.is_soft_story ? "Yes" : "No"}</div>
              <div className="l">soft story</div>
            </div>
            {building.soft_story_status && (
              <div className="s">
                <div className="n" style={{ fontSize: 16 }}>{building.soft_story_status}</div>
                <div className="l">retrofit status</div>
              </div>
            )}
            {hasFairPlan && (
              <div className="s">
                <div className="n bad">High</div>
                <div className="l">FAIR Plan risk</div>
              </div>
            )}
          </div>

          {hasFairPlan && (
            <div style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.22)",
              fontSize: 13,
              color: "#78350f",
            }}>
              <b>FAIR Plan insurance risk.</b> Standard insurers may decline coverage in this area. Tenants and owners may need to use California&rsquo;s insurer of last resort (FAIR Plan) for fire coverage.
            </div>
          )}
        </div>
      )}

      {/* ─── Earthquake Retrofit ─────────────────────────────── */}
      {hasRetrofit && laData.earthquakeRetrofit && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h2l3-9 4 18 3-9 2 4h4"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Earthquake retrofit</h3>
              <p className="ri-sub">Seismic compliance under LA mandatory ordinance</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{laData.earthquakeRetrofit.retrofit_type ?? "—"}</div>
              <div className="l">retrofit type</div>
            </div>
            <div className="s">
              <div className={`n ${/complete|compliant/i.test(laData.earthquakeRetrofit.compliance_status ?? "") ? "good" : "bad"}`} style={{ fontSize: 16 }}>
                {laData.earthquakeRetrofit.compliance_status ?? "—"}
              </div>
              <div className="l">compliance</div>
            </div>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{fmtMonth(laData.earthquakeRetrofit.deadline)}</div>
              <div className="l">deadline</div>
            </div>
            <div className="s">
              <div className="n good" style={{ fontSize: 16 }}>{fmtMonth(laData.earthquakeRetrofit.completion_date)}</div>
              <div className="l">completed</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tenant Buyouts ───────────────────────────────────── */}
      {hasBuyouts && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Tenant buyouts
                <span className="ri-pill">{laData.buyouts.length} on record</span>
              </h3>
              <p className="ri-sub">Total compensation: <b>{fmtMoney(buyoutTotal)}</b></p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentBuyouts.map((b) => (
              <li key={b.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(b.disclosure_date)}</span>
                <span className="ll-tl-body">
                  <b>Buyout disclosure</b>
                  <small>Compensation: {fmtMoney(b.compensation_amount)}</small>
                </span>
              </li>
            ))}
          </ol>

          <small style={{ display: "block", marginTop: 8, opacity: 0.65 }}>
            Owners must disclose tenant buyout agreements to LAHD within 60 days. Frequent buyouts can signal tenant turnover pressure.
          </small>
        </div>
      )}

      {/* ─── SCEP Inspections ─────────────────────────────────── */}
      {hasScep && latestScep && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                SCEP inspections
                <span className="ri-pill">{laData.scepInspections.length} on record</span>
              </h3>
              <p className="ri-sub">Systematic Code Enforcement Program</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{fmtMonth(latestScep.inspection_date)}</div>
              <div className="l">last inspection</div>
            </div>
            <div className="s">
              <div className={`n ${/compliant|pass/i.test(latestScep.compliance_status ?? "") ? "good" : "bad"}`} style={{ fontSize: 16 }}>
                {latestScep.compliance_status ?? "—"}
              </div>
              <div className="l">status</div>
            </div>
            <div className="s">
              <div className={`n ${(latestScep.violations_found ?? 0) > 0 ? "bad" : "good"}`}>
                {latestScep.violations_found ?? 0}
              </div>
              <div className="l">violations</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CalEnviroScreen + Parking ───────────────────────── */}
      {(hasEnviro || hasParking) && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon navy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Environment &amp; mobility</h3>
              <p className="ri-sub">Pollution burden and transportation context</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            {hasEnviro && building.calenviroscreen_percentile != null && (
              <div className="s">
                <div className={`n ${building.calenviroscreen_percentile >= 75 ? "bad" : building.calenviroscreen_percentile >= 50 ? "" : "good"}`}>
                  {Math.round(building.calenviroscreen_percentile)}<small style={{ fontSize: 11, marginLeft: 2 }}>th</small>
                </div>
                <div className="l">CalEnviroScreen</div>
              </div>
            )}
            {building.parking_type && (
              <div className="s">
                <div className="n" style={{ fontSize: 16 }}>{building.parking_type}</div>
                <div className="l">parking type</div>
              </div>
            )}
            {building.parking_spaces != null && (
              <div className="s">
                <div className="n">{building.parking_spaces.toLocaleString()}</div>
                <div className="l">parking spaces</div>
              </div>
            )}
            {building.car_dependency_score != null && (
              <div className="s">
                <div className={`n ${building.car_dependency_score >= 70 ? "bad" : building.car_dependency_score >= 40 ? "" : "good"}`}>
                  {Math.round(building.car_dependency_score)}
                </div>
                <div className="l">car dependency</div>
              </div>
            )}
          </div>

          {hasEnviro && building.calenviroscreen_percentile != null && building.calenviroscreen_percentile >= 75 && (
            <small style={{ display: "block", marginTop: 8, color: "#991b1b" }}>
              High pollution burden percentile — area faces significant environmental health stressors.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
