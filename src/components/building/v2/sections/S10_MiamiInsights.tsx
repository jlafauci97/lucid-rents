/**
 * S10 Miami-Specific Insights — v2-styled card surfacing Miami-only
 * coastal and structural risk data: 40-year recertification, unsafe
 * structures, sea-level risk, storm damage history, NFIP flood claims,
 * and FEMA flood zone.
 *
 * Renders nothing if the building has no Miami-specific data at all.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";

interface Props {
  building: Building;
  miamiData: BuildingV2Data["miamiData"];
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

export function S10_MiamiInsights({ building, miamiData }: Props) {
  const hasRecerts = miamiData.recerts.length > 0;
  const hasUnsafe = miamiData.unsafeStructures.length > 0;
  const hasSeaLevel = !!building.sea_level_risk_zone || building.sea_level_risk_feet != null;
  const hasStorm = miamiData.stormDamage.length > 0;
  const hasFloodClaims = miamiData.floodClaims.length > 0;
  const hasFloodZone = !!building.flood_zone;

  const hasAnyData = hasRecerts || hasUnsafe || hasSeaLevel || hasStorm || hasFloodClaims || hasFloodZone;
  if (!hasAnyData) return null;

  // Latest recert
  const latestRecert = [...miamiData.recerts]
    .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))[0];
  const recertOverdue = latestRecert
    && !latestRecert.completion_date
    && latestRecert.due_date
    && new Date(latestRecert.due_date) < new Date();

  // Recent unsafe structures (top 3)
  const recentUnsafe = [...miamiData.unsafeStructures]
    .sort((a, b) => (b.case_date ?? "").localeCompare(a.case_date ?? ""))
    .slice(0, 3);
  const openUnsafe = miamiData.unsafeStructures.filter((u) => !/closed|resolved|complete/i.test(u.status ?? ""));

  // Storm damage aggregates
  const totalLoss = miamiData.stormDamage.reduce((s, d) => s + (d.fema_verified_loss ?? 0), 0);
  const recentStorms = [...miamiData.stormDamage]
    .sort((a, b) => (b.disaster_date ?? "").localeCompare(a.disaster_date ?? ""))
    .slice(0, 3);

  // Flood claims aggregates
  const totalFloodPaid = miamiData.floodClaims.reduce((s, c) => s + (c.amount_paid ?? 0), 0);

  return (
    <section className="section" id="miami-insights">
      <div className="section-head">
        <div>
          <div className="num">10 / 10</div>
          <h2>Miami-specific insights.</h2>
          <p className="ww-sub" style={{ marginTop: 4 }}>Coastal risks, recertification, and storm history</p>
        </div>
        <div className="meta"></div>
      </div>

      {/* ─── 40-Year Recertification (top — critical safety) ──── */}
      {hasRecerts && latestRecert && (
        <div className="ri-card" style={recertOverdue ? { borderLeft: "4px solid #dc2626" } : undefined}>
          <header className="ri-head">
            <span className={`ri-icon ${recertOverdue ? "" : "good"}`} style={recertOverdue ? { background: "rgba(220,38,38,0.14)", color: "#dc2626" } : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                40-Year recertification
                {recertOverdue
                  ? <span className="ri-pill" style={{ background: "rgba(220,38,38,0.14)", color: "#991b1b" }}>Overdue</span>
                  : latestRecert.completion_date
                    ? <span className="ri-pill" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>Completed</span>
                    : <span className="ri-pill" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>Pending</span>}
              </h3>
              <p className="ri-sub">Miami-Dade structural &amp; electrical safety review</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{latestRecert.recertification_status ?? "—"}</div>
              <div className="l">status</div>
            </div>
            <div className="s">
              <div className={`n ${recertOverdue ? "bad" : ""}`} style={{ fontSize: 16 }}>{fmtMonth(latestRecert.due_date)}</div>
              <div className="l">due date</div>
            </div>
            <div className="s">
              <div className="n good" style={{ fontSize: 16 }}>{fmtMonth(latestRecert.completion_date)}</div>
              <div className="l">completed</div>
            </div>
          </div>

          {recertOverdue && (
            <div style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.18)",
              fontSize: 13,
              color: "#7f1d1d",
            }}>
              <b>Recertification overdue.</b> Miami-Dade requires structural and electrical recertification at 40 years and every 10 years thereafter. Overdue buildings can be deemed unsafe.
            </div>
          )}
        </div>
      )}

      {/* ─── Unsafe Structures ────────────────────────────────── */}
      {hasUnsafe && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Unsafe structures
                <span className="ri-pill">{miamiData.unsafeStructures.length} cases</span>
                {openUnsafe.length > 0 && (
                  <span className="ri-pill" style={{ background: "rgba(220,38,38,0.12)", color: "#991b1b", marginLeft: 6 }}>
                    {openUnsafe.length} open
                  </span>
                )}
              </h3>
              <p className="ri-sub">Building code enforcement actions</p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentUnsafe.map((u) => (
              <li key={u.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(u.case_date)}</span>
                <span className="ll-tl-body">
                  <b>{u.case_number ?? "Unsafe structure case"}</b>
                  <small>
                    {u.violation_type ?? "—"}
                    {u.status ? ` · ${u.status}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Sea level + Flood zone ──────────────────────────── */}
      {(hasSeaLevel || hasFloodZone) && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><path d="M2 18c2 0 4-2 6-2s4 2 6 2 4-2 6-2 4 2 6 2"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>Coastal &amp; flood risk</h3>
              <p className="ri-sub">FEMA zones and projected sea level exposure</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            {hasFloodZone && (
              <div className="s">
                <div className={`n ${/^(A|V)/i.test(building.flood_zone ?? "") ? "bad" : ""}`} style={{ fontSize: 18 }}>
                  {building.flood_zone}
                </div>
                <div className="l">FEMA flood zone</div>
              </div>
            )}
            {building.sea_level_risk_zone && (
              <div className="s">
                <div className={`n ${/high|severe/i.test(building.sea_level_risk_zone) ? "bad" : ""}`} style={{ fontSize: 16 }}>
                  {building.sea_level_risk_zone}
                </div>
                <div className="l">sea level zone</div>
              </div>
            )}
            {building.sea_level_risk_feet != null && (
              <div className="s">
                <div className={`n ${building.sea_level_risk_feet >= 3 ? "bad" : ""}`}>
                  {building.sea_level_risk_feet.toFixed(1)}<small style={{ fontSize: 11 }}> ft</small>
                </div>
                <div className="l">projected rise</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Storm damage ─────────────────────────────────────── */}
      {hasStorm && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(245,158,11,0.14)", color: "#b45309" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Storm damage history
                <span className="ri-pill">{miamiData.stormDamage.length} events</span>
              </h3>
              <p className="ri-sub">FEMA-verified disaster losses · total <b>{fmtMoney(totalLoss)}</b></p>
            </div>
          </header>

          <ol className="ll-timeline" style={{ marginTop: 12 }}>
            {recentStorms.map((s) => (
              <li key={s.id} className="ll-tl">
                <span className="ll-tl-dot"></span>
                <span className="ll-tl-year">{fmtMonth(s.disaster_date)}</span>
                <span className="ll-tl-body">
                  <b>{s.disaster_name ?? "Disaster event"}</b>
                  <small>
                    {s.damage_category ?? "—"}
                    {s.fema_verified_loss != null ? ` · ${fmtMoney(s.fema_verified_loss)} verified loss` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── Flood claims (NFIP) ─────────────────────────────── */}
      {hasFloodClaims && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                NFIP flood claims
                <span className="ri-pill">{miamiData.floodClaims.length} claims</span>
              </h3>
              <p className="ri-sub">Federal flood insurance payouts · total <b>{fmtMoney(totalFloodPaid)}</b></p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className="n bad">{miamiData.floodClaims.length}</div>
              <div className="l">total claims</div>
            </div>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{fmtMoney(totalFloodPaid)}</div>
              <div className="l">total paid</div>
            </div>
            <div className="s">
              <div className="n" style={{ fontSize: 16 }}>{fmtMonth(miamiData.floodClaims[0]?.claim_date ?? null)}</div>
              <div className="l">most recent</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
