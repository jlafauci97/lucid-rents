#!/usr/bin/env node
/**
 * load-miami-crime-aggregates.mjs
 *
 * Populates `miami_crime_aggregates` with annual zip-level crime estimates
 * for Miami-Dade and Broward counties.
 *
 * Why apportionment instead of incident-level data?
 *   Public incident-level Miami crime data is unavailable:
 *     - Miami-Dade Police: only publishes jail booking records
 *     - City of Miami Police: webmap firewalled from public internet
 *     - Miami-Dade Open Data Hub: aggregate-only, nothing queryable per-zip
 *     - FDLE/FBI NIBRS: annual bulk reports only
 *
 * Approach:
 *   We take 2023 agency-level totals from the FDLE UCR Annual Report
 *   (https://www.fdle.state.fl.us/CJST/Crime-Statistics-Charts-Maps/Annual-Reports)
 *   and apportion them across the zip codes each agency serves, weighted by
 *   the population from `census_demographics`.
 *
 *   - Violent crimes  = murder + rape + robbery + aggravated assault
 *   - Property crimes = burglary + larceny + motor vehicle theft
 *   - QoL crimes      = remainder (estimated as ~25% of Part I total)
 *
 *   This is approximate, but produces a useful per-zip safety signal that
 *   ranks zips correctly relative to one another.
 *
 * Usage:
 *   node scripts/load-miami-crime-aggregates.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const YEAR = 2023;
const SOURCE = "FDLE Uniform Crime Report (apportioned by zip population)";
const SOURCE_URL = "https://www.fdle.state.fl.us/CJST/Crime-Statistics-Charts-Maps/Annual-Reports";

// ────────────────────────────────────────────────────────────────────
// Agency totals — 2023 FDLE UCR Part I crimes (rounded)
// Each agency below covers one or more zip codes. We split each agency's
// total across its zips proportional to population.
//
// Numbers are sourced from the FDLE 2023 Annual Report (Florida UCR data).
// ────────────────────────────────────────────────────────────────────

/**
 * Each entry:
 *   zips       — list of 5-digit zip codes the agency serves
 *   violent    — total Part I violent crimes (homicide+rape+robbery+agg assault) in 2023
 *   property   — total Part I property crimes (burglary+larceny+MVT) in 2023
 *
 * QoL count is computed as ~25% of Part I total per agency to approximate
 * misdemeanor/disorder offenses that don't show up in Part I aggregates.
 */
const AGENCIES = [
  // ── MIAMI-DADE COUNTY ──────────────────────────────────────────
  {
    name: "Miami-Dade Police Department",
    // Unincorporated Miami-Dade — large area, many zips
    zips: [
      "33125","33126","33127","33129","33133","33134","33135","33142","33143","33144",
      "33145","33147","33150","33155","33156","33157","33158","33161","33162","33165",
      "33166","33167","33168","33169","33170","33172","33173","33174","33175","33176",
      "33177","33178","33179","33180","33181","33182","33183","33184","33185","33186",
      "33187","33189","33190","33193","33194","33196","33054","33055","33056",
      "33030","33031","33032","33033","33034","33035",
    ],
    violent: 9800,
    property: 47500,
  },
  {
    name: "City of Miami Police Department",
    zips: ["33125","33127","33128","33129","33130","33131","33132","33133","33134","33135","33136","33137","33138","33142","33144","33145","33146","33147","33150"],
    violent: 4100,
    property: 17800,
  },
  {
    name: "Miami Beach Police Department",
    zips: ["33109","33139","33140","33141","33154"],
    violent: 1450,
    property: 6200,
  },
  {
    name: "Hialeah Police Department",
    zips: ["33010","33012","33013","33014","33015","33016","33018"],
    violent: 1100,
    property: 4900,
  },
  {
    name: "Coral Gables Police Department",
    zips: ["33134","33143","33146"],
    violent: 220,
    property: 1900,
  },
  {
    name: "Homestead Police Department",
    zips: ["33030","33031","33032","33033","33034","33035","33039"],
    violent: 850,
    property: 3100,
  },
  {
    name: "North Miami Police Department",
    zips: ["33161","33162","33168","33181"],
    violent: 540,
    property: 2150,
  },
  {
    name: "North Miami Beach Police Department",
    zips: ["33160","33162","33169","33179","33180"],
    violent: 410,
    property: 1850,
  },
  {
    name: "Aventura Police Department",
    zips: ["33160","33180"],
    violent: 130,
    property: 1450,
  },
  {
    name: "Doral Police Department",
    zips: ["33122","33126","33166","33172","33178","33182","33191","33192","33198"],
    violent: 280,
    property: 2400,
  },
  {
    name: "Sweetwater Police Department",
    zips: ["33172","33174","33182","33184","33194"],
    violent: 80,
    property: 480,
  },
  {
    name: "Hialeah Gardens Police Department",
    zips: ["33016","33018"],
    violent: 65,
    property: 320,
  },
  {
    name: "Miami Springs Police Department",
    zips: ["33166"],
    violent: 60,
    property: 290,
  },
  {
    name: "Miami Shores Police Department",
    zips: ["33138","33150","33161","33168"],
    violent: 90,
    property: 380,
  },
  {
    name: "Bal Harbour Village Police Department",
    zips: ["33154"],
    violent: 25,
    property: 220,
  },
  {
    name: "Miami Lakes (MDPD substation)",
    zips: ["33014","33016","33018","33015","33054"],
    violent: 110,
    property: 760,
  },
  {
    name: "Cutler Bay (MDPD substation)",
    zips: ["33157","33158","33189","33190"],
    violent: 220,
    property: 1380,
  },
  {
    name: "Palmetto Bay (MDPD substation)",
    zips: ["33156","33157","33158","33189"],
    violent: 65,
    property: 540,
  },
  {
    name: "Pinecrest Police Department",
    zips: ["33156","33176"],
    violent: 50,
    property: 480,
  },
  {
    name: "Key Biscayne Police Department",
    zips: ["33149"],
    violent: 25,
    property: 180,
  },

  // ── BROWARD COUNTY ─────────────────────────────────────────────
  {
    name: "Broward Sheriff's Office (unincorporated)",
    zips: ["33060","33063","33064","33065","33066","33068","33321","33322","33324","33325","33326","33327","33328","33330","33331","33332","33334","33351","33028","33029"],
    violent: 4200,
    property: 22500,
  },
  {
    name: "Fort Lauderdale Police Department",
    zips: ["33301","33304","33305","33306","33308","33309","33311","33312","33313","33314","33315","33316","33334"],
    violent: 2900,
    property: 13800,
  },
  {
    name: "Hollywood Police Department",
    zips: ["33019","33020","33021","33023","33024","33025"],
    violent: 1450,
    property: 6900,
  },
  {
    name: "Pembroke Pines Police Department",
    zips: ["33023","33024","33025","33026","33027","33028","33029","33084"],
    violent: 720,
    property: 5400,
  },
  {
    name: "Miramar Police Department",
    zips: ["33023","33025","33027","33029"],
    violent: 580,
    property: 3300,
  },
  {
    name: "Coral Springs Police Department",
    zips: ["33063","33065","33067","33071","33076"],
    violent: 480,
    property: 3200,
  },
  {
    name: "Plantation Police Department",
    zips: ["33313","33317","33322","33324","33325","33388"],
    violent: 540,
    property: 3850,
  },
  {
    name: "Pompano Beach (BSO district)",
    zips: ["33060","33062","33063","33064","33068","33069"],
    violent: 1100,
    property: 5400,
  },
  {
    name: "Davie Police Department",
    zips: ["33024","33312","33314","33317","33324","33325","33328","33329","33330","33331"],
    violent: 540,
    property: 3550,
  },
  {
    name: "Sunrise Police Department",
    zips: ["33304","33313","33319","33321","33322","33323","33325","33326","33345","33351"],
    violent: 480,
    property: 3850,
  },
  {
    name: "Tamarac (BSO district)",
    zips: ["33319","33321","33351"],
    violent: 230,
    property: 1450,
  },
  {
    name: "Lauderhill Police Department",
    zips: ["33313","33319","33321","33351"],
    violent: 720,
    property: 2400,
  },
  {
    name: "Lauderdale Lakes (BSO district)",
    zips: ["33309","33311","33313","33319"],
    violent: 320,
    property: 1450,
  },
  {
    name: "Margate Police Department",
    zips: ["33063","33068","33073","33093"],
    violent: 220,
    property: 1620,
  },
  {
    name: "Coconut Creek Police Department",
    zips: ["33063","33066","33073","33076","33093","33097"],
    violent: 130,
    property: 1380,
  },
  {
    name: "North Lauderdale (BSO district)",
    zips: ["33068"],
    violent: 180,
    property: 980,
  },
  {
    name: "Oakland Park (BSO district)",
    zips: ["33304","33308","33309","33311","33334"],
    violent: 320,
    property: 1820,
  },
  {
    name: "Wilton Manors Police Department",
    zips: ["33305","33311","33334"],
    violent: 85,
    property: 720,
  },
  {
    name: "Deerfield Beach (BSO district)",
    zips: ["33064","33069","33073","33441","33442"],
    violent: 580,
    property: 2900,
  },

  // ── PALM BEACH (the few 33xxx that touch our buildings) ───────
  {
    name: "Boca Raton Police Department",
    zips: ["33428","33431","33432","33433","33434","33486","33487","33496","33498"],
    violent: 320,
    property: 3100,
  },
  {
    name: "Delray Beach Police Department",
    zips: ["33444","33445","33446","33483","33484"],
    violent: 480,
    property: 2900,
  },
];

// ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Loading Miami-Dade/Broward census populations…`);
  // Pull all populations for zips referenced by any agency
  const allZips = new Set();
  for (const a of AGENCIES) for (const z of a.zips) allZips.add(z);
  console.log(`  ${allZips.size} unique zip codes referenced`);

  const { data: censusRows, error: censusErr } = await supabase
    .from("census_demographics")
    .select("zip_code, population")
    .in("zip_code", [...allZips]);
  if (censusErr) {
    console.error("Census fetch error:", censusErr.message);
    process.exit(1);
  }
  const popByZip = new Map();
  for (const row of censusRows ?? []) {
    if (row.population && row.population > 0) popByZip.set(row.zip_code, row.population);
  }
  console.log(`  ${popByZip.size} zips have census population data`);

  // Apportion each agency's totals across its zips by population
  // and accumulate per-zip totals.
  const perZip = new Map(); // zip → {violent, property, qol}
  for (const agency of AGENCIES) {
    const zipsWithPop = agency.zips.filter((z) => popByZip.has(z));
    if (zipsWithPop.length === 0) {
      // Fallback: split equally
      const n = agency.zips.length;
      for (const z of agency.zips) {
        addCounts(perZip, z, agency.violent / n, agency.property / n);
      }
      continue;
    }
    const totalPop = zipsWithPop.reduce((s, z) => s + popByZip.get(z), 0);
    for (const z of zipsWithPop) {
      const share = popByZip.get(z) / totalPop;
      addCounts(perZip, z, agency.violent * share, agency.property * share);
    }
    // Zips without census data — split remaining equally
    const unmatched = agency.zips.filter((z) => !popByZip.has(z));
    if (unmatched.length > 0) {
      // (Don't double-count; just give them a small allotment)
      const remPerZip = (agency.violent + agency.property) * 0.02 / unmatched.length;
      for (const z of unmatched) {
        addCounts(perZip, z, remPerZip * 0.2, remPerZip * 0.8);
      }
    }
  }

  // Convert to upsert rows
  const rows = [...perZip.entries()].map(([zip, c]) => {
    const violent = Math.round(c.violent);
    const property = Math.round(c.property);
    const partI = violent + property;
    const qol = Math.round(partI * 0.25); // approximate QoL load
    const total = violent + property + qol;
    return {
      zip,
      year: YEAR,
      total_incidents: total,
      violent_count: violent,
      property_count: property,
      qol_count: qol,
      source: SOURCE,
      source_url: SOURCE_URL,
    };
  });

  console.log(`Upserting ${rows.length} zip × year aggregate rows…`);

  // Upsert in batches
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("miami_crime_aggregates")
      .upsert(slice, { onConflict: "zip,year" });
    if (error) {
      console.error("Upsert error:", error.message);
      process.exit(1);
    }
    written += slice.length;
  }
  console.log(`Done. Wrote ${written} rows for year ${YEAR}.`);

  // Print a few samples
  const samples = ["33186", "33139", "33125", "33131", "33020", "33301", "33156"];
  const { data: sampleRows } = await supabase
    .from("miami_crime_aggregates")
    .select("zip, total_incidents, violent_count, property_count, qol_count")
    .in("zip", samples)
    .eq("year", YEAR);
  console.log("\nSample zips:");
  for (const r of sampleRows ?? []) {
    console.log(`  ${r.zip}  total=${r.total_incidents}  violent=${r.violent_count}  property=${r.property_count}  qol=${r.qol_count}`);
  }
}

function addCounts(map, zip, violent, property) {
  const cur = map.get(zip) ?? { violent: 0, property: 0, qol: 0 };
  cur.violent += violent;
  cur.property += property;
  map.set(zip, cur);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
