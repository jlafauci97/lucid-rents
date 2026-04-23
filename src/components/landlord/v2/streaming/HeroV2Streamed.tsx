import { Suspense } from "react";
import { HeroV2 } from "../HeroV2";
import { loadLandlordHero } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const landlord = await loadLandlordHero(slug, city);
  return <HeroV2 landlord={landlord} city={city} />;
}

function HeroFallback({ displayName, fullCity }: { displayName: string; fullCity: string }) {
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
        <h1>{displayName}</h1>
        <div className="hero-address"><span>{fullCity}</span></div>
        <div
          className="leasing-card"
          style={{
            minHeight: 120,
            background: "rgba(0,0,0,0.03)",
            animation: "v2-pulse 1.4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
      </div>
      <aside
        className="verdict"
        style={{
          minHeight: 300,
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}

export function HeroV2Streamed({
  slug,
  city,
  displayName,
  fullCity,
}: {
  slug: string;
  city: City;
  displayName: string;
  fullCity: string;
}) {
  return (
    <Suspense fallback={<HeroFallback displayName={displayName} fullCity={fullCity} />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
