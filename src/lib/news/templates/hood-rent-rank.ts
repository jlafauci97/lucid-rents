import type { Detector } from "./types";
import { median, neighborhoodOf } from "./_helpers";

/**
 * Ranks neighborhoods by current median rent (cheapest + priciest). Reads the
 * latest month per ZIP from `zillow_rents`, rolls ZIPs up into neighborhoods,
 * and emits both a "cheapest 5" and a "priciest 5" candidate.
 */
export const detectHoodRentRank: Detector = async ({ city, supabase, today }) => {
  const d90 = new Date(
    new Date(today + "T00:00:00Z").getTime() - 90 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("zillow_rents")
    .select("zip_code, borough, median_rent, date")
    .eq("metro", city)
    .gte("date", d90);

  if (error || !data || data.length === 0) return [];

  const latestByZip = new Map<string, { rent: number; date: string; borough: string | null }>();
  for (const r of data as {
    zip_code: string | null;
    borough: string | null;
    median_rent: number | null;
    date: string;
  }[]) {
    if (!r.zip_code || !r.median_rent) continue;
    const prev = latestByZip.get(r.zip_code);
    if (!prev || r.date > prev.date) {
      latestByZip.set(r.zip_code, { rent: r.median_rent, date: r.date, borough: r.borough });
    }
  }

  const byHood = new Map<string, number[]>();
  for (const [zip, v] of latestByZip) {
    const name = neighborhoodOf(zip, v.borough, city);
    const arr = byHood.get(name) ?? [];
    arr.push(v.rent);
    byHood.set(name, arr);
  }

  const ranked = [...byHood.entries()]
    .map(([name, rents]) => ({ name, rent: median(rents) ?? 0 }))
    .filter((x) => x.rent > 0)
    .sort((a, b) => a.rent - b.rent);
  if (ranked.length < 6) return [];

  const cheapest = ranked.slice(0, 5);
  const priciest = ranked.slice(-5).reverse();

  return [
    {
      type: "hood-rent-rank",
      score: 3,
      headline_seed: `The 5 most affordable ${city.toUpperCase()} neighborhoods to rent right now`,
      metadata: {
        neighborhood: cheapest[0].name,
        ranking: "cheapest",
        neighborhoods: cheapest.map((c) => ({ name: c.name, median_rent: Math.round(c.rent) })),
      },
      image_hint: `${city} affordable neighborhood street`,
    },
    {
      type: "hood-rent-rank",
      score: 3,
      headline_seed: `The 5 priciest ${city.toUpperCase()} neighborhoods to rent right now`,
      metadata: {
        neighborhood: priciest[0].name,
        ranking: "priciest",
        neighborhoods: priciest.map((c) => ({ name: c.name, median_rent: Math.round(c.rent) })),
      },
      image_hint: `${city} luxury neighborhood skyline`,
    },
  ];
};
