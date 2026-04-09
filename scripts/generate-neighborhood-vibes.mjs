#!/usr/bin/env node
/**
 * Generate vibe check data for all neighborhoods using stats + demographics.
 * Run: node scripts/generate-neighborhood-vibes.mjs
 *
 * Creates data-driven descriptions, tags, pros, and cons for each neighborhood
 * based on building quality, crime, demographics, and transit data.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync } from "fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Import existing vibes to preserve hand-written ones
const EXISTING_VIBES_PATH = "src/lib/neighborhood-vibes.ts";

// City neighborhood mappings
const CITY_MODULES = {
  nyc: { file: "src/lib/nyc-neighborhoods.ts", varName: "NYC_ZIP_NEIGHBORHOODS", regionVar: "NYC_ZIP_BOROUGHS" },
  "los-angeles": { file: "src/lib/la-neighborhoods.ts", varName: "LA_ZIP_NEIGHBORHOODS", regionVar: "LA_ZIP_REGIONS" },
  chicago: { file: "src/lib/chicago-neighborhoods.ts", varName: "CHICAGO_ZIP_NEIGHBORHOODS", regionVar: "CHICAGO_ZIP_REGIONS" },
  miami: { file: "src/lib/miami-neighborhoods.ts", varName: "MIAMI_ZIP_NEIGHBORHOODS", regionVar: "MIAMI_ZIP_REGIONS" },
  houston: { file: "src/lib/houston-neighborhoods.ts", varName: "HOUSTON_ZIP_NEIGHBORHOODS", regionVar: "HOUSTON_ZIP_REGIONS" },
};

const CITY_NAMES = { nyc: "NYC", "los-angeles": "Los Angeles", chicago: "Chicago", miami: "Miami", houston: "Houston" };

async function fetchStats(city) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/neighborhood_index`, {
    method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_city: city }),
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCrime(city) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/crime_by_zip`, {
    method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ metro: city }),
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchDemographics() {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SB_URL}/rest/v1/census_demographics?select=*&offset=${offset}&limit=1000`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const data = await res.json();
    if (data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < 1000) break;
  }
  return all;
}

function extractNeighborhoodNames(city) {
  const content = readFileSync(CITY_MODULES[city].file, "utf-8");
  const names = {};
  const regex = /"(\d{5})"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content))) {
    names[match[1]] = match[2];
  }
  return names;
}

function extractRegions(city) {
  const content = readFileSync(CITY_MODULES[city].file, "utf-8");
  const regionVar = CITY_MODULES[city].regionVar;
  // Parse the region assignments from the file
  const regions = {};
  // For NYC, boroughs are computed from zip ranges
  if (city === "nyc") {
    for (const [zip] of Object.entries(extractNeighborhoodNames(city))) {
      if (zip >= "10001" && zip <= "10282") regions[zip] = "Manhattan";
      else if (zip >= "10301" && zip <= "10314") regions[zip] = "Staten Island";
      else if (zip >= "10451" && zip <= "10475") regions[zip] = "Bronx";
      else if (zip >= "11201" && zip <= "11239") regions[zip] = "Brooklyn";
      else regions[zip] = "Queens";
    }
  }
  return regions;
}

// Generate vibe tags based on data
function generateTags(stats, crime, demo, cityKey) {
  const tags = [];
  const violPerBldg = stats ? stats.total_violations / Math.max(stats.building_count, 1) : 0;
  const avgScore = stats?.avg_score ? Number(stats.avg_score) : 5;

  // Building quality
  if (avgScore >= 8) tags.push("Well-Maintained");
  else if (avgScore < 5) tags.push("Needs Work");

  // Safety
  if (crime) {
    const crimeRate = crime.total / Math.max(stats?.building_count || 100, 1);
    if (crimeRate < 0.3) tags.push("Safe");
    else if (crimeRate > 2) tags.push("Higher Crime");
    if (crime.violent < 20) tags.push("Low Violence");
  }

  // Demographics
  if (demo) {
    if (demo.median_household_income > 100000) tags.push("Affluent");
    else if (demo.median_household_income > 60000) tags.push("Middle-Income");
    else if (demo.median_household_income && demo.median_household_income < 35000) tags.push("Affordable");

    if (demo.renter_occupied_pct > 70) tags.push("Renter-Heavy");
    else if (demo.renter_occupied_pct && demo.renter_occupied_pct < 30) tags.push("Owner-Dominated");

    if (demo.median_age && demo.median_age < 30) tags.push("Young Crowd");
    else if (demo.median_age && demo.median_age > 45) tags.push("Established");

    if (demo.population > 50000) tags.push("Dense");
    else if (demo.population && demo.population < 10000) tags.push("Quiet");
  }

  // Building density
  if (stats) {
    if (stats.building_count > 5000) tags.push("Dense Housing");
    else if (stats.building_count < 200) tags.push("Low-Rise");
  }

  // City-specific
  if (cityKey === "miami") tags.push("Tropical");
  if (cityKey === "houston" && !tags.includes("Dense")) tags.push("Sprawling");

  return tags.slice(0, 5); // Max 5 tags
}

function generatePros(name, stats, crime, demo, region) {
  const pros = [];
  const avgScore = stats?.avg_score ? Number(stats.avg_score) : 5;
  const violPerBldg = stats ? stats.total_violations / Math.max(stats.building_count, 1) : 0;

  if (avgScore >= 7) pros.push("High building quality scores");
  if (violPerBldg < 2) pros.push("Low violation rates");
  if (crime && crime.violent < 30) pros.push("Low violent crime");
  if (crime && crime.total < 200) pros.push("Relatively safe area");
  if (demo?.median_household_income > 80000) pros.push("Strong local economy");
  if (demo?.renter_occupied_pct > 50) pros.push("Active rental market");
  if (stats?.building_count > 1000) pros.push("Many housing options");
  if (stats?.total_reviews > 100) pros.push("Well-reviewed by tenants");
  if (region) pros.push(`${region} location`);

  return pros.slice(0, 4);
}

function generateCons(name, stats, crime, demo) {
  const cons = [];
  const avgScore = stats?.avg_score ? Number(stats.avg_score) : 5;
  const violPerBldg = stats ? stats.total_violations / Math.max(stats.building_count, 1) : 0;

  if (avgScore < 5) cons.push("Below-average building quality");
  if (violPerBldg > 10) cons.push("High violation rates");
  else if (violPerBldg > 5) cons.push("Moderate violation rates");
  if (crime && crime.violent > 100) cons.push("Elevated violent crime");
  if (crime && crime.total > 1000) cons.push("High overall crime");
  if (crime && crime.property > 300) cons.push("Property crime concerns");
  if (demo?.median_household_income && demo.median_household_income < 30000) cons.push("Lower income area");
  if (stats?.building_count < 50) cons.push("Limited housing stock");

  if (cons.length === 0) cons.push("Limited data for detailed assessment");
  return cons.slice(0, 3);
}

function generateDescription(name, zip, stats, crime, demo, region, cityName) {
  const parts = [];
  const avgScore = stats?.avg_score ? Number(stats.avg_score) : null;
  const buildingCount = stats?.building_count || 0;
  const violPerBldg = stats ? stats.total_violations / Math.max(stats.building_count, 1) : 0;

  // Opening with building quality
  let opener = `${name}`;
  if (region) opener += ` in ${region}`;

  if (buildingCount > 0) {
    if (avgScore && avgScore >= 8) {
      opener += ` is one of ${cityName}'s better-maintained areas, with ${buildingCount.toLocaleString()} tracked buildings and above-average quality scores`;
    } else if (avgScore && avgScore >= 6) {
      opener += ` has ${buildingCount.toLocaleString()} tracked buildings with solid maintenance records`;
    } else if (avgScore && avgScore < 5) {
      opener += ` has ${buildingCount.toLocaleString()} tracked buildings, though building quality scores are below the city average`;
    } else {
      opener += ` has ${buildingCount.toLocaleString()} tracked buildings`;
    }
  }
  parts.push(opener);

  // Safety
  if (crime) {
    if (crime.total < 100) {
      parts.push("Crime rates are well below average, making it one of the safer neighborhoods");
    } else if (crime.total < 500) {
      parts.push("Crime levels are moderate compared to the broader metro");
    } else if (crime.total > 1000) {
      parts.push("Crime rates are elevated — renters should research specific blocks carefully");
    }
  }

  // Demographics
  if (demo) {
    const demoNotes = [];
    if (demo.median_household_income > 100000) demoNotes.push("an affluent area");
    else if (demo.median_household_income && demo.median_household_income < 35000) demoNotes.push("a more affordable area");
    if (demo.renter_occupied_pct > 70) demoNotes.push("predominantly renters");
    if (demo.median_age && demo.median_age < 30) demoNotes.push("a younger population");

    if (demoNotes.length > 0) {
      parts.push(`The area has ${demoNotes.join(" with ")}`);
    }
  }

  // Closing
  if (violPerBldg < 2) {
    parts.push("Violation density is low, suggesting responsive landlords");
  } else if (violPerBldg > 10) {
    parts.push("Check individual building report cards before signing — violation rates vary significantly");
  }

  return parts.join(". ") + ".";
}

function parseExistingVibes() {
  const content = readFileSync(EXISTING_VIBES_PATH, "utf-8");
  const existing = {};
  // Match both quoted and unquoted city keys (nyc: { or "nyc": { or "los-angeles": {)
  for (const city of Object.keys(CITY_MODULES)) {
    existing[city] = new Set();
    // Try both formats
    const patterns = [
      new RegExp(`["']?${city.replace('-', '[-]?')}["']?\\s*:\\s*\\{`),
      new RegExp(`"${city}"\\s*:\\s*\\{`),
    ];
    for (const pat of patterns) {
      const match = pat.exec(content);
      if (!match) continue;
      // Scan forward from the match to find all zip codes in this city block
      let depth = 0;
      let i = content.indexOf("{", match.index + match[0].length - 1);
      const start = i;
      for (; i < content.length; i++) {
        if (content[i] === "{") depth++;
        if (content[i] === "}") { depth--; if (depth === 0) break; }
      }
      const block = content.slice(start, i + 1);
      const zipRegex = /"(\d{5})"\s*:/g;
      let zipMatch;
      while ((zipMatch = zipRegex.exec(block))) {
        existing[city].add(zipMatch[1]);
      }
      break;
    }
  }
  return existing;
}

async function main() {
  console.log("Generating neighborhood vibes for all cities...\n");

  const existingVibes = parseExistingVibes();
  const demographics = await fetchDemographics();
  const demoMap = new Map(demographics.map(d => [d.zip_code, d]));

  const allVibes = {};
  let generated = 0;
  let preserved = 0;

  for (const [city, mod] of Object.entries(CITY_MODULES)) {
    console.log(`Processing ${CITY_NAMES[city]}...`);
    const names = extractNeighborhoodNames(city);
    const regions = extractRegions(city);
    const [stats, crime] = await Promise.all([fetchStats(city), fetchCrime(city)]);
    const statsMap = new Map(stats.map(s => [s.zip_code, s]));
    const crimeMap = new Map(crime.map(c => [c.zip_code, c]));

    allVibes[city] = {};

    for (const [zip, name] of Object.entries(names)) {
      const s = statsMap.get(zip);
      const c = crimeMap.get(zip);
      const d = demoMap.get(zip);
      const region = regions[zip] || "";

      // Skip if no building data
      if (!s || s.building_count === 0) continue;

      // Keep hand-written vibes (they're better)
      if (existingVibes[city]?.has(zip)) {
        preserved++;
        continue; // Will be preserved from original file
      }

      allVibes[city][zip] = {
        description: generateDescription(name, zip, s, c, d, region, CITY_NAMES[city]),
        vibeTags: generateTags(s, c, d, city),
        pros: generatePros(name, s, c, d, region),
        cons: generateCons(name, s, c, d),
      };
      generated++;
    }
    console.log(`  ${Object.keys(allVibes[city]).length} new + ${existingVibes[city]?.size || 0} preserved`);
  }

  // Now merge: read existing file, inject new vibes while preserving hand-written ones
  const existingContent = readFileSync(EXISTING_VIBES_PATH, "utf-8");

  // Build the new vibes object combining existing + generated
  let output = `export interface NeighborhoodVibe {
  description: string;
  vibeTags: string[];
  pros: string[];
  cons: string[];
}

// Keyed by city → zip code → vibe data
// Hand-written vibes for major neighborhoods are preserved; data-driven vibes fill the gaps.
export const NEIGHBORHOOD_VIBES: Record<string, Record<string, NeighborhoodVibe>> = {\n`;

  for (const [city, mod] of Object.entries(CITY_MODULES)) {
    output += `  "${city}": {\n`;

    // First, write the existing hand-written vibes
    const handWrittenBlock = extractHandWrittenBlock(existingContent, city);
    if (handWrittenBlock) {
      output += handWrittenBlock;
    }

    // Then add generated vibes
    for (const [zip, vibe] of Object.entries(allVibes[city])) {
      output += `    "${zip}": {\n`;
      output += `      description: ${JSON.stringify(vibe.description)},\n`;
      output += `      vibeTags: ${JSON.stringify(vibe.vibeTags)},\n`;
      output += `      pros: ${JSON.stringify(vibe.pros)},\n`;
      output += `      cons: ${JSON.stringify(vibe.cons)},\n`;
      output += `    },\n`;
    }

    output += `  },\n`;
  }

  output += `};

export function getNeighborhoodVibe(city: string, zipCode: string): NeighborhoodVibe | null {
  return NEIGHBORHOOD_VIBES[city]?.[zipCode] ?? null;
}
`;

  writeFileSync(EXISTING_VIBES_PATH, output);
  console.log(`\nDone! Generated ${generated} vibes, preserved ${preserved} hand-written ones.`);
  console.log(`Written to ${EXISTING_VIBES_PATH}`);
}

function extractHandWrittenBlock(content, city) {
  // Extract all entries for a city from the original file
  const cityKey = city === "los-angeles" ? '"los-angeles"' : `"${city}"`;
  const cityStart = content.indexOf(`${cityKey}: {`);
  if (cityStart === -1) return null;

  const blockStart = content.indexOf("{", cityStart + cityKey.length) + 1;
  // Find the matching closing brace
  let depth = 1;
  let i = blockStart;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") depth--;
    i++;
  }
  const blockEnd = i - 1;
  const block = content.slice(blockStart, blockEnd).trim();
  if (!block) return null;
  return block + "\n";
}

main().catch(e => { console.error(e); process.exit(1); });
