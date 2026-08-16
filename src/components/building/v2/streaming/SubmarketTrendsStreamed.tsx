import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { submarketSlugForZip } from "@/lib/submarkets";
import {
  SubmarketTrendsChart,
  type SubmarketRentRow,
} from "@/components/building/SubmarketTrendsChart";
import { SectionSkeleton } from "./SectionSkeleton";
import { VALID_CITIES, type City } from "@/lib/cities";
import type { Building } from "@/types";

function metroToCity(metro: string | null | undefined): City {
  if (metro && (VALID_CITIES as readonly string[]).includes(metro)) return metro as City;
  return "nyc";
}

// Quarterly data shared by every building in the submarket — cache one week
// per (city, slug) so cold building renders don't re-run the 2-query fetch.
const loadSubmarketTrends = (city: City, submarketSlug: string) =>
  unstable_cache(
    async (): Promise<{ name: string; rows: SubmarketRentRow[] } | null> => {
      const supabase = createCacheClient();
      const { data: sub } = await supabase
        .from("submarkets")
        .select("id, name")
        .eq("city", city)
        .eq("slug", submarketSlug)
        .maybeSingle();
      if (!sub) return null;

      const { data: rows } = await supabase
        .from("submarket_rent_history")
        .select("quarter, beds, rent_type, rent_per_unit")
        .eq("submarket_id", sub.id)
        .order("quarter", { ascending: true });
      if (!rows || rows.length === 0) return null;
      return { name: sub.name, rows: rows as SubmarketRentRow[] };
    },
    ["submarket-trends", city, submarketSlug],
    { revalidate: 604800, tags: ["submarket-trends"] },
  )();

async function Inner({ building }: { building: Building }) {
  const city = metroToCity(building.metro);
  const zip = building.zip_code?.trim().slice(0, 5);
  if (!zip) return null;

  const submarketSlug = submarketSlugForZip(city, zip);
  if (!submarketSlug) return null;

  const trends = await loadSubmarketTrends(city, submarketSlug);
  if (!trends) return null;
  const { name, rows } = trends;

  const latestQuarter = rows[rows.length - 1].quarter;

  return (
    <section className="section" id="submarket-trends">
      <div className="section-head">
        <div>
          <div className="num">01b / 09</div>
          <h2>Rent trends.</h2>
        </div>
        <div className="meta"></div>
      </div>
      <div className="ri-card">
        <SubmarketTrendsChart
          submarketName={name}
          latestQuarter={latestQuarter}
          rows={rows}
        />
      </div>
    </section>
  );
}

export function SubmarketTrendsStreamed({ building }: { building: Building }) {
  return (
    <Suspense
      fallback={
        <SectionSkeleton num="01b / 09" title="Rent trends." id="submarket-trends" />
      }
    >
      <Inner building={building} />
    </Suspense>
  );
}
