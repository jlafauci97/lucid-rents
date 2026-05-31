import { Suspense } from "react";
import { CrimeSection } from "../sections/CrimeSection";
import { AboutThisArea } from "../sections/AboutThisArea";
import { loadLocationData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

// Crime + About-this-area both read from the same location slice (nearby
// transit/schools, vibe, demographics, crime). We load it once here and render
// both sections so they stream in together right after the Landlord section.
async function Inner({ building, city }: { building: Building; city: City }) {
  const data = await loadLocationData(building);
  return (
    <>
      <CrimeSection building={building} city={city} crime={data.crime} />
      <AboutThisArea
        building={building}
        city={city}
        nearby={data.nearby}
        neighborhoodStats={data.neighborhoodStats}
        demographics={data.demographics}
        vibe={data.vibe}
      />
    </>
  );
}

/** Shared placeholder used both while lazy-mounting and while data streams. */
export function AreaSkeletons({ city }: { city: City }) {
  return (
    <>
      {city !== "miami" && <SectionSkeleton num="06 / 10" title="Crime & safety." id="crime" />}
      <SectionSkeleton num="07 / 10" title="About this area." id="about-this-area" />
    </>
  );
}

export function AreaSectionsStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={<AreaSkeletons city={city} />}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
