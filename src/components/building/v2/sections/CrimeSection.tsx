/**
 * Crime & safety — dedicated main-column section.
 *
 * Ported from the old SideRail "Safety & Crime" card (right rail, now cleared)
 * into a full section with its own wayfinder entry. Aggregated from crime data
 * in this zip over the last 12 months.
 *
 * Renders nothing when there's no crime data to show:
 *   - Miami has no crime dataset loaded yet.
 *   - Any building whose zip has zero incidents on file.
 * The wayfinder omits the "Crime" entry for Miami so the anchor is never dead.
 */

import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { City } from "@/lib/cities";

interface Props {
  building: Building;
  city: City;
  crime: BuildingV2Data["crime"];
}

function crimeSourceLabel(city: string): string {
  switch (city) {
    case "nyc": return "NYPD CompStat";
    case "chicago": return "Chicago Police Dept";
    case "los-angeles": return "LAPD";
    case "miami": return "FDLE UCR (annual)";
    case "houston": return "Houston PD";
    default: return "Local police data";
  }
}

export function CrimeSection({ building, city, crime }: Props) {
  // Mirror the old SideRail condition: Miami has no crime data, and an empty
  // zip shouldn't render a section of zeroes.
  if (city === "miami" || crime.total12mo <= 0) return null;

  const safetyLabel =
    crime.safetyScore >= 80 ? "Very safe"
      : crime.safetyScore >= 60 ? "Above average"
        : crime.safetyScore >= 40 ? "Area average"
          : "Below average";
  const ringColor = crime.safetyScore >= 70 ? "#10b981" : crime.safetyScore >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <section className="section" id="crime">
      <div className="section-head">
        <div>
          <div className="num">06 / 10</div>
          <h2>Crime &amp; safety.</h2>
        </div>
        <div className="meta">{building.zip_code ?? "Area"} · last 12 months</div>
      </div>

      <div className="sr-card">
        <header className="sr-head">
          <span className="sr-icon navy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
          <h4>Safety &amp; Crime</h4>
        </header>

        <div className="crime-grid">
          <div className="crime-score">
            <div className="walk-top">
              <div className="walk-score-ring">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={ringColor} strokeWidth="3" strokeDasharray={`${crime.safetyScore} 100`} strokeDashoffset="25" transform="rotate(-90 18 18)"/>
                </svg>
                <span className="n">{crime.safetyScore}</span>
              </div>
              <div className="walk-summary">
                <b>{safetyLabel}</b>
                <small>Safety score · last 12 months</small>
              </div>
            </div>
            <div className="sr-foot">{crimeSourceLabel(city)} · updated weekly</div>
          </div>

          <div className="crime-breakdown">
            <div className="sr-sub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>LAST 12 MONTHS · {building.zip_code ?? "AREA"}</div>
            <div className="es-row"><span className="k">Violent</span><span className="v">{crime.violent.toLocaleString()}</span></div>
            <div className="es-row"><span className="k">Property</span><span className="v">{crime.property.toLocaleString()}</span></div>
            <div className="es-row"><span className="k">Quality-of-life</span><span className="v">{crime.qualityOfLife.toLocaleString()}</span></div>
            <div className="es-row"><span className="k">Total incidents</span><span className="v">{crime.total12mo.toLocaleString()}</span></div>
            {crime.precinct ? (
              <div className="es-row"><span className="k">Top precinct</span><span className="v">#{crime.precinct}</span></div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
