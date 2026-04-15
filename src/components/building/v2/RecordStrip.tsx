/**
 * RecordStrip — verbatim port of the mockup at public/mockups/building-v1.html, lines 3086–3117.
 *
 *   <section class="record" aria-label="The record">
 *     <div class="r-cell [warn|ok]">
 *       <span class="r-k">Label</span>
 *       <span class="r-v">Value</span>
 *       <span class="r-sub">Subtext</span>
 *     </div>
 *     … 6 cells total
 *   </section>
 *
 * Only mechanical transforms (class→className) and data substitutions.
 */

import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  building: Building;
  reviews: BuildingV2Data["reviews"];
}

function yearsSince(year: number | null | undefined): string {
  if (!year) return "—";
  const now = new Date().getFullYear();
  const diff = now - year;
  return diff >= 0 ? `${diff} y` : "—";
}

export function RecordStrip({ building, reviews }: Props) {
  const hpdCount = building.violation_count ?? 0;
  const evictCount = building.eviction_count ?? 0;
  const comp311Count = building.complaint_count ?? 0;
  const rentStabDisplay = building.is_rent_stabilized && building.total_units
    ? building.total_units.toLocaleString()
    : building.is_rent_stabilized ? "Yes" : "—";

  const hpdClass = hpdCount > 100 ? "r-cell warn" : "r-cell";
  const rentStabClass = building.is_rent_stabilized ? "r-cell ok" : "r-cell";
  const comp311Class = comp311Count > 200 ? "r-cell warn" : "r-cell";

  return (
    <section className="record" aria-label="The record">
      <div className={hpdClass}>
        <span className="r-k">HPD violations</span>
        <span className="r-v">{hpdCount.toLocaleString()}</span>
        <span className="r-sub">last 7 years · class A, B, C</span>
      </div>
      <div className="r-cell">
        <span className="r-k">Evictions filed</span>
        <span className="r-v">{evictCount.toLocaleString()}</span>
        <span className="r-sub">last 7 years</span>
      </div>
      <div className="r-cell">
        <span className="r-k">Tenant reviews</span>
        <span className="r-v">{reviews.total.toLocaleString()}</span>
        <span className="r-sub">{reviews.total > 0 ? `${reviews.avgRating.toFixed(1)} ★ avg` : "no reviews yet"}</span>
      </div>
      <div className={rentStabClass}>
        <span className="r-k">Rent-stab units</span>
        <span className="r-v">{rentStabDisplay}</span>
        <span className="r-sub">{building.is_rent_stabilized ? "DHCR records" : "no coverage"}</span>
      </div>
      <div className="r-cell">
        <span className="r-k">Building age</span>
        <span className="r-v">{yearsSince(building.year_built)}</span>
        <span className="r-sub">{building.year_built ? `built ${building.year_built}` : "year unknown"}</span>
      </div>
      <div className={comp311Class}>
        <span className="r-k">311 complaints</span>
        <span className="r-v">{comp311Count.toLocaleString()}</span>
        <span className="r-sub">last 7 years</span>
      </div>
    </section>
  );
}
