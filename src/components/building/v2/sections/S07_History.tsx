/**
 * S07 History of the building — verbatim port of mockup lines 4212–4257.
 *
 * Only shows building-level lifecycle milestones: construction, ownership
 * changes, major permits. Individual HPD violations / 311 complaints /
 * evictions live in the Violations section (S02) — they don't belong here.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { Building } from "@/types";

interface Props {
  building: Building;
  landlord: BuildingV2Data["landlord"];
}

export function S07_History({ building, landlord }: Props) {
  // Decade markers that span the building's lifetime.
  const startYear = building.year_built ?? new Date().getFullYear() - 50;
  const endYear = new Date().getFullYear();
  const spanStart = Math.floor(startYear / 10) * 10;
  const spanEnd = Math.ceil(endYear / 10) * 10;
  const decadeMarkers: number[] = [];
  for (let y = spanStart; y <= spanEnd; y += 10) decadeMarkers.push(y);

  // Building-level events ONLY. No violations/complaints/evictions.
  const events: Array<{ year: string; title: string; desc: string }> = [];

  if (building.year_built) {
    const specBits = [
      building.total_units ? `${building.total_units.toLocaleString()} units` : null,
      building.num_floors ? `${building.num_floors} floors` : null,
      building.building_class ? `class ${building.building_class}` : null,
    ].filter(Boolean).join(" · ");
    events.push({
      year: String(building.year_built),
      title: "Building constructed",
      desc: specBits || "Construction completed",
    });
  }

  if (landlord.name) {
    events.push({
      year: "now",
      title: `Current owner: ${landlord.name}`,
      desc: landlord.portfolioSize > 1
        ? `Portfolio includes ${landlord.portfolioSize.toLocaleString()} buildings.`
        : "Registered owner on file.",
    });
  }

  if (building.is_rent_stabilized && (building as unknown as { stabilized_units?: number | null }).stabilized_units) {
    const su = (building as unknown as { stabilized_units?: number | null }).stabilized_units!;
    events.push({
      year: String((building as unknown as { stabilized_year?: number | null }).stabilized_year ?? new Date().getFullYear()),
      title: "Rent stabilization on file",
      desc: `${su.toLocaleString()} stabilized unit${su === 1 ? "" : "s"} registered.`,
    });
  }

  // Sort: year-first; "now" always last.
  events.sort((a, b) => {
    if (a.year === "now") return 1;
    if (b.year === "now") return -1;
    return parseInt(a.year) - parseInt(b.year);
  });

  return (
    <section className="section" id="history">
      <div className="section-head">
        <div>
          <div className="num">07 / 09</div>
          <h2>History of the building.</h2>
        </div>
        <div className="meta">construction · ownership · permits</div>
      </div>

      <div className="timeline">
        <div className="tl-years">
          {decadeMarkers.map((y) => <span key={y}>{y}</span>)}
        </div>
        <div className="tl-track"></div>
        <div className="tl-events">
          {events.length ? events.map((ev, i) => (
            <div key={`${ev.year}-${i}`} className="tl-event">
              <div className="y">{ev.year}</div>
              <div className="t">{ev.title}</div>
              <div className="d">{ev.desc}</div>
            </div>
          )) : (
            <div className="tl-event">
              <div className="y">—</div>
              <div className="t">No building history on file</div>
              <div className="d">Major milestones (construction, ownership changes, permits) appear here once recorded.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
