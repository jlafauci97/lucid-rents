import type { Detector } from "./types";
import { median, neighborhoodOf } from "./_helpers";

/**
 * Best bang-for-buck neighborhoods: high review-weighted LucidIQ relative to
 * median rent. Joins `zillow_rents` (rent per neighborhood) with `buildings`
 * (quality per neighborhood). value = avg_score / (median_rent / 1000).
 */
export const detectHoodValuePick: Detector = async ({ city, supabase, today }) => {
  const d90 = new Date(
    new Date(today + "T00:00:00Z").getTime() - 90 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const [rentsRes, bldgRes] = await Promise.all([
    supabase
      .from("zillow_rents")
      .select("zip_code, borough, median_rent, date")
      .eq("metro", city)
      .gte("date", d90),
    supabase
      .from("buildings")
      .select("zip_code, borough, overall_score, review_count")
      .eq("metro", city)
      .gte("review_count", 5)
      .not("overall_score", "is", null)
      .limit(5000),
  ]);

  const rents = rentsRes.data;
  const blds = bldgRes.data;
  if (!rents || !blds || rents.length === 0 || blds.length === 0) return [];

  const latestByZip = new Map<string, { rent: number; date: string; borough: string | null }>();
  for (const r of rents as {
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
  const rentByHood = new Map<string, number[]>();
  for (const [zip, v] of latestByZip) {
    const name = neighborhoodOf(zip, v.borough, city);
    const arr = rentByHood.get(name) ?? [];
    arr.push(v.rent);
    rentByHood.set(name, arr);
  }

  const qualByHood = new Map<string, { sum: number; w: number; n: number }>();
  for (const b of blds as {
    zip_code: string | null;
    borough: string | null;
    overall_score: number | null;
    review_count: number | null;
  }[]) {
    if (b.overall_score == null) continue;
    const name = neighborhoodOf(b.zip_code, b.borough, city);
    const w = b.review_count ?? 1;
    const cur = qualByHood.get(name) ?? { sum: 0, w: 0, n: 0 };
    cur.sum += b.overall_score * w;
    cur.w += w;
    cur.n += 1;
    qualByHood.set(name, cur);
  }

  const rows: { name: string; rent: number; avg: number; value: number }[] = [];
  for (const [name, rentList] of rentByHood) {
    const q = qualByHood.get(name);
    if (!q || q.n < 4) continue;
    const rent = median(rentList);
    if (!rent || rent <= 0) continue;
    const avg = q.sum / q.w;
    rows.push({ name, rent: Math.round(rent), avg: Number(avg.toFixed(2)), value: avg / (rent / 1000) });
  }
  if (rows.length < 5) return [];

  const best = rows.sort((a, b) => b.value - a.value).slice(0, 6);
  return [
    {
      type: "hood-value-pick",
      score: 3.2,
      headline_seed: `Best value ${city.toUpperCase()} neighborhoods: high scores, lower rent`,
      metadata: {
        neighborhood: best[0].name,
        ranking: "best-value",
        neighborhoods: best.map((b) => ({ name: b.name, median_rent: b.rent, avg_score: b.avg })),
      },
      image_hint: `${best[0].name} ${city} neighborhood street`,
    },
  ];
};
