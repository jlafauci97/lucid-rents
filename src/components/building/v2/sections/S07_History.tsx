/**
 * S07 History of the building — verbatim port of mockup lines 4212–4257.
 *
 * Only shows building-level lifecycle milestones: construction, ownership
 * changes, major permits. Individual HPD violations / 311 complaints /
 * evictions live in the Violations section (S02) — they don't belong here.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";
import type { TimelineEvent } from "@/lib/timeline";

interface Props {
  building: Building;
  landlord: BuildingV2Data["landlord"];
  timeline: TimelineEvent[];
}

function formatTimelineDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sourceColor(type: string): string {
  switch (type) {
    case "hpd_violation": return "#ef4444";
    case "dob_violation": return "#f97316";
    case "complaint_311": return "#eab308";
    case "eviction": return "#991b1b";
    case "litigation": return "#8b5cf6";
    case "permit": return "#3b82f6";
    case "bedbug": return "#92400e";
    default: return "#64748b";
  }
}

function sourceLabel(type: string): string {
  switch (type) {
    case "hpd_violation": return "HPD";
    case "dob_violation": return "DOB";
    case "complaint_311": return "311";
    case "eviction": return "Eviction";
    case "litigation": return "Litigation";
    case "permit": return "Permit";
    case "bedbug": return "Bedbug";
    default: return "Event";
  }
}

export function S07_History({ building, landlord, timeline }: Props) {
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

      {/* Recent Activity — from timeline events */}
      {timeline.length > 0 && (
        <div className="ww-card ww-mt">
          <header className="ww-head">
            <h3>Recent Activity</h3>
            <span className="ri-pill">{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
          </header>
          <ul className="rec-list">
            {timeline.slice(0, 10).map((ev) => (
              <li key={ev.id} className="rec-item">
                <header className="rec-item-head">
                  <span className="rec-class" style={{ color: sourceColor(ev.type) }}>{sourceLabel(ev.type)}</span>
                  <span className={`rec-status ${ev.severity === "high" ? "open" : "closed"}`}>
                    {ev.severity === "high" ? "HIGH" : ev.severity === "medium" ? "MEDIUM" : ev.severity === "info" ? "INFO" : "LOW"}
                  </span>
                  <span className="rec-date">{formatTimelineDate(ev.date)}</span>
                </header>
                <p className="rec-body">{ev.title}{ev.description && ev.description !== ev.title ? ` \u2014 ${ev.description.slice(0, 120)}` : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
