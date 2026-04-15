/**
 * S07 History of the building — verbatim port of mockup lines 4212–4257.
 *
 *   <section class="section" id="history">
 *     <div class="section-head">…07 / 09 History of the building.…</div>
 *     <div class="timeline">
 *       <div class="tl-years">decade markers</div>
 *       <div class="tl-track"></div>
 *       <div class="tl-events">.tl-event with .y / .t / .d</div>
 *     </div>
 *   </section>
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { Building } from "@/types";

interface Props {
  timeline: BuildingV2Data["timeline"];
  building: Building;
}

export function S07_History({ timeline, building }: Props) {
  // Derive decade markers that cover the building's history.
  const startYear = building.year_built ?? new Date().getFullYear() - 50;
  const endYear = new Date().getFullYear();
  const spanStart = Math.floor(startYear / 10) * 10;
  const spanEnd = Math.ceil(endYear / 10) * 10;
  const decadeMarkers: number[] = [];
  for (let y = spanStart; y <= spanEnd; y += 10) decadeMarkers.push(y);

  // Fold all source events into the display timeline. Always start with
  // "Building constructed" when we know the year.
  const events: Array<{ year: string; title: string; desc: string }> = [];
  if (building.year_built) {
    events.push({
      year: String(building.year_built),
      title: "Building constructed",
      desc: [
        building.total_units ? `${building.total_units.toLocaleString()} units` : null,
        building.num_floors ? `${building.num_floors} floors` : null,
        building.building_class ? `class ${building.building_class}` : null,
      ].filter(Boolean).join(" · "),
    });
  }
  // Bring in the loaded timeline events (bounded to 10).
  for (const ev of timeline.slice(0, 10)) {
    const yr = (ev.date ?? "").slice(0, 4);
    if (!yr) continue;
    events.push({ year: yr, title: ev.title, desc: ev.description });
  }
  // Sort ascending.
  events.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  return (
    <section className="section" id="history">
      <div className="section-head">
        <div>
          <div className="num">07 / 09</div>
          <h2>History of the building.</h2>
        </div>
        <div className="meta"></div>
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
              <div className="t">No recorded events</div>
              <div className="d">Timeline events (violations, evictions, deeds) will appear as they&apos;re filed.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
