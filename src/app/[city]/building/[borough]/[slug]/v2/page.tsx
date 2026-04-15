/**
 * Building V2 page — skeleton that matches the mockup structure.
 *
 * Mockup reference: public/mockups/building-v1.html
 *
 * Structure being built out section by section (verbatim ports):
 *   <nav class="nav">              ← NavV2            ✅ done
 *   <main class="container">
 *     <nav class="crumbs">         ← Crumbs           ✅ done
 *     <section class="hero">       ← Hero             ⏳ TODO
 *     <section class="record">     ← RecordStrip      ⏳ TODO
 *     <div class="layout">
 *       <aside class="wayfinder">  ← WayfinderRail    ⏳ TODO
 *       <main class="main">
 *         9 sections               ← S01–S09          ⏳ TODO
 *       <aside class="sr">         ← Right rail       ⏳ TODO
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { cache } from "react";
import type { Building } from "@/types";
import { loadBuildingV2Data } from "./_data";
import { NavV2 } from "@/components/building/v2/NavV2";
import { Crumbs } from "@/components/building/v2/Crumbs";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro: string) => {
  const city = metro as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough)
    .eq("metro", metro)
    .limit(1);
  return (data?.[0] as Building) ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) {
    return { title: "Building · v2 preview", robots: { index: false, follow: false } };
  }
  const building = await getBuilding(borough, slug, city);
  if (!building) {
    return { title: "Building · v2 preview", robots: { index: false, follow: false } };
  }
  const productionPath = buildingUrl({ borough: building.borough, slug: building.slug }, city as City);
  return {
    title: `${building.full_address} · v2 preview`,
    description: `Preview of redesigned building page for ${building.full_address}.`,
    robots: { index: false, follow: false },
    alternates: { canonical: canonicalUrl(productionPath) },
  };
}

export default async function BuildingV2Page({ params }: Props) {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) notFound();
  const typedCity = city as City;
  const building = await getBuilding(borough, slug, typedCity);
  if (!building) notFound();

  const data = await loadBuildingV2Data(building);
  // Suppress unused-var lint while sections are being built; the loader still
  // runs so we catch data issues early.
  void data;

  const addressFirstLine = building.full_address.split(",")[0] ?? building.full_address;

  return (
    <>
      {/* Skip to main content (a11y) */}
      <a href="#main-content" className="v2-skip-link">Skip to main content</a>

      {/* ────── <nav class="nav"> ────── */}
      <NavV2 city={typedCity} />

      {/* ────── <main class="container"> ────── */}
      <main className="container">
        {/* ── <nav class="crumbs"> ── */}
        <Crumbs
          city={typedCity}
          boroughSlug={borough}
          boroughName={building.borough}
          neighborhoodSlug={null}
          neighborhoodName={null}
          addressLabel={addressFirstLine}
        />

        {/* Placeholders for the sections we're rebuilding verbatim */}
        <div id="main-content" style={{ padding: "48px 0", color: "var(--ink-mute)", fontFamily: "var(--mono)", fontSize: "var(--f-14)" }}>
          <p style={{ marginBottom: 12 }}>
            V2 preview — rebuilding section-by-section from mockup.
          </p>
          <p style={{ marginBottom: 4 }}>✅ NavV2 (lines 2940–2961)</p>
          <p style={{ marginBottom: 4 }}>✅ Crumbs (lines 2966–2972)</p>
          <p style={{ marginBottom: 4, opacity: 0.5 }}>⏳ Hero, RecordStrip, Wayfinder, 9 sections, right rail</p>
        </div>
      </main>
    </>
  );
}
