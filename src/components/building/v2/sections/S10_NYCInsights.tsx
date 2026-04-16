/**
 * S10 NYC-Specific Insights — v2-styled card surfacing NYC-only data:
 * rent stabilization (DHCR registration) and seismic soft-story
 * retrofit information.
 *
 * Renders nothing if the building has no NYC-specific data at all.
 */

import type { Building } from "@/types";

interface Props {
  building: Building;
}

export function S10_NYCInsights({ building }: Props) {
  const hasRentStab = building.is_rent_stabilized
    || (building.stabilized_units ?? 0) > 0
    || building.stabilized_year != null;
  const hasSoftStory = building.is_soft_story || !!building.soft_story_status;

  const hasAnyData = hasRentStab || hasSoftStory;
  if (!hasAnyData) return null;

  return (
    <section className="section" id="nyc-insights">
      <div className="section-head">
        <div>
          <div className="num">10 / 10</div>
          <h2>NYC-specific insights.</h2>
          <p className="ww-sub" style={{ marginTop: 4 }}>Rent stabilization and seismic safety</p>
        </div>
        <div className="meta"></div>
      </div>

      {/* ─── Rent Stabilization ───────────────────────────────── */}
      {hasRentStab && (
        <div className="ri-card">
          <header className="ri-head">
            <span className={`ri-icon ${building.is_rent_stabilized ? "good" : "violet"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Rent stabilization
                {building.is_rent_stabilized
                  ? <span className="ri-pill" style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>Protected</span>
                  : <span className="ri-pill" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>Not stabilized</span>}
              </h3>
              <p className="ri-sub">DHCR registration &amp; tenant protections</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
            <div className="s">
              <div className={`n ${building.is_rent_stabilized ? "good" : ""}`}>{building.is_rent_stabilized ? "Yes" : "No"}</div>
              <div className="l">rent stabilized</div>
            </div>
            <div className="s">
              <div className="n">{building.stabilized_units != null ? building.stabilized_units.toLocaleString() : "—"}</div>
              <div className="l">stabilized units</div>
            </div>
            <div className="s">
              <div className="n">{building.stabilized_year ?? "—"}</div>
              <div className="l">since</div>
            </div>
          </div>

          <small style={{ display: "block", marginTop: 8, opacity: 0.65 }}>
            Stabilized units have annual rent-increase caps set by the Rent Guidelines Board and lease-renewal rights.
          </small>
        </div>
      )}

      {/* ─── Soft story retrofit ──────────────────────────────── */}
      {hasSoftStory && (
        <div className="ri-card ri-mt">
          <header className="ri-head">
            <span className="ri-icon" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h2l3-9 4 18 3-9 2 4h4"/></svg>
            </span>
            <div style={{ flex: 1 }}>
              <h3>
                Soft story retrofit
                {building.is_soft_story && (
                  <span className="ri-pill" style={{ background: "rgba(220,38,38,0.12)", color: "#991b1b" }}>Soft story</span>
                )}
              </h3>
              <p className="ri-sub">Seismic vulnerability assessment</p>
            </div>
          </header>

          <div className="landlord-stats" style={{ marginTop: 12 }}>
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
          </div>

          {building.is_soft_story && (
            <small style={{ display: "block", marginTop: 8, color: "#991b1b" }}>
              Soft-story buildings have weak ground-floor walls (often parking or open commercial space) and are at higher risk of collapse during seismic events.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
