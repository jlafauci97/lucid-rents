import { Suspense } from "react";
import { HeroV2 } from "../HeroV2";
import {
  loadRentsData,
  loadReviewsData,
  loadLandlordData,
} from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

async function Inner({ building, city }: { building: Building; city: City }) {
  const [rentsSlice, reviews, landlord] = await Promise.all([
    loadRentsData(building.id, building.metro, building.zip_code),
    loadReviewsData(building.id),
    loadLandlordData(building),
  ]);
  const rents = {
    current: rentsSlice.current,
    historic: rentsSlice.historic,
    neighborhood: rentsSlice.neighborhood,
  };
  return <HeroV2 building={building} rents={rents} reviews={reviews} landlord={landlord} city={city} />;
}

function HeroFallback({ building }: { building: Building }) {
  // Minimal hero skeleton — keeps the address visible while the verdict + rent
  // range stream in. Reuses the existing .hero layout hooks.
  const street = building.full_address.split(",")[0] ?? building.full_address;
  const rest = building.full_address.slice(street.length + 1).trim();
  return (
    <section className="hero" aria-busy="true">
      <style>{`
        @keyframes v2-pulse {
          0%   { opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
      <div className="hero-left">
        <h1>{street}</h1>
        {rest ? <div className="hero-address"><span>{rest}</span></div> : null}
        <div
          className="leasing-card"
          style={{
            minHeight: 200,
            background: "rgba(0,0,0,0.03)",
            animation: "v2-pulse 1.4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
      </div>
      <aside
        className="verdict"
        style={{
          minHeight: 600,
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}

export function HeroV2Streamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={<HeroFallback building={building} />}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
