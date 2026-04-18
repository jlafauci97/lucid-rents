import { Suspense } from "react";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { HeroV2 } from "../HeroV2";
import {
  loadRentsData,
  loadReviewsData,
  loadLandlordData,
} from "@/app/[city]/building/[borough]/[slug]/_data";

/**
 * HeroV2 is above-the-fold and needs `rents`, `reviews`, and `landlord`. We
 * stream it anyway — the alternative is blocking the whole first render on
 * these three queries. With this wrapper the HTML shell + breadcrumbs flush
 * immediately, then the hero hydrates as its data arrives.
 *
 * The skeleton matches HeroV2's visual footprint so there's no layout shift.
 */

interface Props {
  building: Building;
  city: City;
}

async function HeroInner({ building, city }: Props) {
  const [rentsBundle, reviews, landlord] = await Promise.all([
    loadRentsData(building.id, building.metro, building.zip_code ?? null),
    loadReviewsData(building.id),
    loadLandlordData(building),
  ]);
  return (
    <HeroV2
      building={building}
      rents={rentsBundle.rents}
      reviews={reviews}
      landlord={landlord}
      city={city}
    />
  );
}

function HeroSkeleton({ building }: { building: Building }) {
  const street = building.full_address.split(",")[0] ?? building.full_address;
  const rest = building.full_address.slice((street ?? "").length).replace(/^,\s*/, "");
  return (
    <section className="hero" aria-busy="true">
      <div className="hero-left">
        <h1>{street}</h1>
        {rest ? <div className="hero-address"><span>{rest}</span></div> : null}
        <div className="hero-meta">
          {building.year_built ? <span>Built {building.year_built}</span> : null}
          {building.num_floors ? <span>{building.num_floors} floors</span> : null}
          {building.total_units ? <span>{building.total_units.toLocaleString()} units</span> : null}
        </div>
        <div
          className="v2-skeleton"
          style={{ height: 96, background: "var(--v2-border, rgba(0,0,0,0.06))", borderRadius: 14, marginTop: 18 }}
        />
      </div>
      <div
        className="v2-skeleton"
        style={{ height: 260, background: "var(--v2-border, rgba(0,0,0,0.06))", borderRadius: 14 }}
      />
    </section>
  );
}

export function HeroV2Streamed(props: Props) {
  return (
    <Suspense fallback={<HeroSkeleton building={props.building} />}>
      <HeroInner {...props} />
    </Suspense>
  );
}
