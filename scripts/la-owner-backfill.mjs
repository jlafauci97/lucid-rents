import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";

// ── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}
const FLAG_ZIP = flag("zip");        // e.g. --zip 90028
const FLAG_LIMIT = flag("limit");    // e.g. --limit 1000
const DRY_RUN = args.includes("--dry-run");

// ── Street type abbreviation map (bidirectional) ───────────────────────
const STREET_ABBREVS = {
  AVENUE: "AVE", BOULEVARD: "BLVD", CIRCLE: "CIR", COURT: "CT",
  CRESCENT: "CRES", DRIVE: "DR", EXPRESSWAY: "EXPY", FREEWAY: "FWY",
  HIGHWAY: "HWY", LANE: "LN", PARKWAY: "PKWY", PLACE: "PL",
  PLAZA: "PLZ", ROAD: "RD", SQUARE: "SQ", STREET: "ST",
  TERRACE: "TER", TRAIL: "TRL", WAY: "WAY", ALLEY: "ALY",
  CANYON: "CYN", CENTER: "CTR", CROSSING: "XING", GROVE: "GRV",
  HEIGHTS: "HTS", HILL: "HL", HILLS: "HLS", HOLLOW: "HOLW",
  JUNCTION: "JCT", KNOLL: "KNL", LANDING: "LNDG", LOOP: "LOOP",
  MANOR: "MNR", MEADOW: "MDW", MEADOWS: "MDWS", MOUNT: "MT",
  MOUNTAIN: "MTN", PASS: "PASS", PATH: "PATH", PIKE: "PIKE",
  POINT: "PT", PORT: "PRT", RANCH: "RNCH", RIDGE: "RDG",
  RUN: "RUN", SHORE: "SHR", SPRING: "SPG", SPRINGS: "SPGS",
  STATION: "STA", SUMMIT: "SMT", VALLEY: "VLY", VIEW: "VW",
  VILLAGE: "VLG", VISTA: "VIS", WALK: "WALK",
};

// Build reverse map: abbrev -> abbrev (identity), full -> abbrev
const TO_ABBREV = {};
for (const [full, abbr] of Object.entries(STREET_ABBREVS)) {
  TO_ABBREV[full] = abbr;
  TO_ABBREV[abbr] = abbr; // already abbreviated stays same
}

// Direction normalization
const DIR_MAP = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
  N: "N", S: "S", E: "E", W: "W",
  NE: "NE", NW: "NW", SE: "SE", SW: "SW",
  "N.": "N", "S.": "S", "E.": "E", "W.": "W",
};

// All city names that might appear in LA-area full_address
const CITY_NAMES = [
  "LOS ANGELES", "LA", "L\\.A\\.", "HOLLYWOOD", "NORTH HOLLYWOOD",
  "WEST HOLLYWOOD", "EAST HOLLYWOOD", "EAST LOS ANGELES",
  "SOUTH LOS ANGELES", "VAN NUYS", "RESEDA", "CANOGA PARK",
  "WOODLAND HILLS", "ENCINO", "TARZANA", "NORTHRIDGE", "GRANADA HILLS",
  "SYLMAR", "SAN PEDRO", "WILMINGTON", "HARBOR CITY", "WATTS",
  "EAGLE ROCK", "HIGHLAND PARK", "ECHO PARK", "SILVER LAKE",
  "KOREATOWN", "WESTWOOD", "BEL AIR", "BRENTWOOD", "PACIFIC PALISADES",
  "VENICE", "MAR VISTA", "PLAYA DEL REY", "WESTCHESTER",
  "SAN FERNANDO", "PANORAMA CITY", "ARLETA", "PACOIMA", "SUN VALLEY",
  "LAKE BALBOA", "CHATSWORTH", "PORTER RANCH", "MISSION HILLS",
  "SHERMAN OAKS", "STUDIO CITY", "TOLUCA LAKE", "VALLEY VILLAGE",
  "BURBANK", "GLENDALE", "PASADENA", "LONG BEACH", "TORRANCE",
  "INGLEWOOD", "COMPTON", "CARSON", "GARDENA", "HAWTHORNE",
  "LAWNDALE", "LOMITA", "RANCHO PALOS VERDES", "REDONDO BEACH",
  "HERMOSA BEACH", "MANHATTAN BEACH", "EL SEGUNDO",
  "CULVER CITY", "SANTA MONICA", "BEVERLY HILLS", "WEST HILLS",
  "WINNETKA", "LAKE VIEW TERRACE", "LA CRESCENTA", "MONTROSE",
  "SUNLAND", "TUJUNGA", "BOYLE HEIGHTS", "LINCOLN HEIGHTS",
  "EL SERENO", "CYPRESS PARK", "GLASSELL PARK", "ATWATER VILLAGE",
  "LOS FELIZ", "MOUNT WASHINGTON",
];
const CITY_PATTERN = new RegExp(
  `[,\\s]+(${CITY_NAMES.join("|")})[,\\s]*(CA)?[,\\s]*\\d{0,5}.*$`,
  "i"
);

// ── Address normalization (multi-level) ────────────────────────────────

/**
 * Strip everything after the street address:
 * "946 E IMPERIAL HWY, Los Angeles, CA 90059" -> "946 E IMPERIAL HWY"
 */
function stripCityStateZip(addr) {
  if (!addr) return "";
  let s = addr.toUpperCase().trim();
  // Remove city/state/zip suffix — try specific city names first, then generic patterns
  s = s.replace(CITY_PATTERN, "");
  // Fallback: strip ", CA 90XXX" or ", CA" patterns
  s = s.replace(/[,\s]+CA\s*\d{0,5}(-\d{4})?\s*$/i, "");
  // Strip trailing zip code
  s = s.replace(/[,\s]+\d{5}(-\d{4})?\s*$/, "");
  // Strip unit/apt suffixes
  s = s.replace(/[,\s]+(APT|UNIT|STE|SUITE|#|NO)\s*\.?\s*\S*$/i, "");
  return s.trim();
}

/**
 * Level 1: Canonical normalization — abbreviate street types + directions,
 * remove punctuation, normalize spaces. Two addresses that refer to the same
 * place should produce identical output.
 */
function normalizeL1(addr) {
  if (!addr) return "";
  let s = stripCityStateZip(addr);
  // Remove periods (N. -> N, St. -> St)
  s = s.replace(/\./g, "");
  // Normalize directions
  s = s.replace(/\b(NORTH|SOUTH|EAST|WEST|NORTHEAST|NORTHWEST|SOUTHEAST|SOUTHWEST|N|S|E|W|NE|NW|SE|SW)\b/g, (m) => DIR_MAP[m] || m);
  // Normalize "1/2" addresses: "4861 1/2 S MARIONWOOD DR" -> "4861 1/2 S MARIONWOOD DR"
  // Keep 1/2 but normalize spacing around it
  s = s.replace(/\s*1\s*\/\s*2\s*/g, " 1/2 ");
  // Normalize street types to abbreviations
  const words = s.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (TO_ABBREV[words[i]]) words[i] = TO_ABBREV[words[i]];
  }
  s = words.join(" ");
  // Remove commas and extra whitespace
  s = s.replace(/,/g, "").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Level 2: Aggressive normalization — strip "1/2", strip street type entirely.
 * Used as fallback when L1 doesn't match.
 * "4861 1/2 S MARIONWOOD DR" -> "4861 S MARIONWOOD"
 */
function normalizeL2(addr) {
  let s = normalizeL1(addr);
  if (!s) return "";
  // Strip "1/2"
  s = s.replace(/\s*1\/2\s*/g, " ");
  // Strip trailing street type
  const streetTypes = new Set(Object.values(STREET_ABBREVS));
  const words = s.split(/\s+/);
  // Remove last word if it's a street type
  if (words.length > 2 && streetTypes.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ").trim();
}

/**
 * Level 3: House number + street name only (no direction, no type).
 * "946 E IMPERIAL HWY" -> "946 IMPERIAL"
 */
function normalizeL3(addr) {
  let s = normalizeL2(addr);
  if (!s) return "";
  const words = s.split(/\s+/);
  if (words.length < 2) return s;
  // Remove direction (2nd word if it's a direction abbreviation)
  const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  const result = [words[0]]; // house number
  for (let i = 1; i < words.length; i++) {
    if (!dirs.has(words[i])) result.push(words[i]);
  }
  return result.join(" ").trim();
}

// ── Main logic ─────────────────────────────────────────────────────────

async function run() {
  console.log("=== LA Property Data Enrichment (Assessor) ===");
  console.log("Fields: year_built, units, sqft, APN, lat/lng, use_type");
  if (DRY_RUN) console.log("** DRY RUN — no writes **");
  if (FLAG_ZIP) console.log(`Filtering to zip: ${FLAG_ZIP}`);
  if (FLAG_LIMIT) console.log(`Limit: ${FLAG_LIMIT} buildings`);
  console.log();

  // ── Load buildings ──
  console.log("Loading LA buildings...");

  // Three lookup maps for tiered matching
  const mapL1 = new Map(); // normalizeL1(addr)|zip -> building
  const mapL2 = new Map(); // normalizeL2(addr)|zip -> building
  const mapL3 = new Map(); // normalizeL3(addr)|zip -> building

  let offset = 0, totalBuildings = 0;
  const limit = FLAG_LIMIT ? parseInt(FLAG_LIMIT) : Infinity;

  while (totalBuildings < limit) {
    let query = supabase
      .from("buildings")
      .select("id, full_address, zip_code, year_built, total_units, latitude, longitude, apn, house_number, street_name, city")
      .eq("metro", "los-angeles")
      .not("zip_code", "is", null);

    if (FLAG_ZIP) query = query.eq("zip_code", FLAG_ZIP);
    query = query.range(offset, offset + 4999);

    const { data, error } = await query;
    if (error) { console.error("Query error:", error.message); break; }
    if (!data?.length) break;

    for (const b of data) {
      if (totalBuildings >= limit) break;
      const zip = b.zip_code;
      if (!zip) continue;

      const l1 = normalizeL1(b.full_address);
      const l2 = normalizeL2(b.full_address);
      const l3 = normalizeL3(b.full_address);

      if (l1) mapL1.set(`${l1}|${zip}`, b);
      if (l2 && !mapL2.has(`${l2}|${zip}`)) mapL2.set(`${l2}|${zip}`, b);
      if (l3 && !mapL3.has(`${l3}|${zip}`)) mapL3.set(`${l3}|${zip}`, b);

      totalBuildings++;
    }

    offset += data.length;
    if (data.length < 5000) break;
  }

  const zips = [...new Set([...mapL1.values()].map(b => b.zip_code))].sort();
  console.log(`Loaded ${totalBuildings} buildings across ${zips.length} zip codes`);
  console.log(`  L1 keys: ${mapL1.size}, L2 keys: ${mapL2.size}, L3 keys: ${mapL3.size}\n`);

  // ── Iterate assessor data by zip ──
  let totalMatched = 0;
  let matchedL1 = 0, matchedL2 = 0, matchedL3 = 0;
  let totalAssessor = 0;
  let totalUpdated = 0;
  const matchedIds = new Set(); // avoid double-matching

  const CONCURRENCY = 3; // be nicer to the API

  for (let z = 0; z < zips.length; z += CONCURRENCY) {
    const zipBatch = zips.slice(z, z + CONCURRENCY);

    await Promise.all(zipBatch.map(async (zip) => {
      try {
        let assessorOffset = 0;
        let zipMatched = 0;
        let zipAssessor = 0;
        let zipUpdated = 0;

        while (true) {
          // Query WITHOUT SitusCity filter — our buildings may have various
          // city names (Hollywood, Van Nuys, etc.) that don't match 'LOS ANGELES'
          const params = new URLSearchParams({
            where: `SitusZIP LIKE '${zip}%'`,
            outFields: "SitusFullAddress,SitusHouseNo,SitusDirection,SitusStreet,SitusAddress,SitusZIP,SitusUnit,APN,UseType,UseDescription,YearBuilt1,Units1,SQFTmain1,CENTER_LAT,CENTER_LON",
            returnGeometry: "false",
            resultRecordCount: "1000",
            resultOffset: String(assessorOffset),
            f: "json",
          });

          const res = await fetch(`${BASE}?${params}`, {
            headers: { "User-Agent": "lucid-rents-enrichment/1.0" },
          });
          if (!res.ok) {
            console.error(`  ${zip}: HTTP ${res.status}`);
            break;
          }
          const json = await res.json();
          if (json.error) {
            console.error(`  ${zip}: API error: ${json.error.message || JSON.stringify(json.error)}`);
            break;
          }
          if (!json.features?.length) break;

          zipAssessor += json.features.length;

          const updates = [];
          for (const f of json.features) {
            const a = f.attributes;

            // Build raw address from assessor fields
            let rawAddr;
            if (a.SitusFullAddress) {
              rawAddr = a.SitusFullAddress;
            } else if (a.SitusAddress) {
              rawAddr = a.SitusAddress;
            } else if (a.SitusHouseNo && a.SitusStreet) {
              rawAddr = [a.SitusHouseNo, a.SitusDirection?.trim(), a.SitusStreet]
                .filter(Boolean).join(" ");
            }
            if (!rawAddr) continue;

            const al1 = normalizeL1(rawAddr);
            const al2 = normalizeL2(rawAddr);
            const al3 = normalizeL3(rawAddr);

            // Tiered matching
            let building = null;
            let level = 0;

            const k1 = `${al1}|${zip}`;
            const k2 = `${al2}|${zip}`;
            const k3 = `${al3}|${zip}`;

            if (al1 && mapL1.has(k1) && !matchedIds.has(mapL1.get(k1).id)) {
              building = mapL1.get(k1);
              level = 1;
            } else if (al2 && mapL2.has(k2) && !matchedIds.has(mapL2.get(k2).id)) {
              building = mapL2.get(k2);
              level = 2;
            } else if (al3 && mapL3.has(k3) && !matchedIds.has(mapL3.get(k3).id)) {
              building = mapL3.get(k3);
              level = 3;
            }

            if (!building) continue;
            matchedIds.add(building.id);
            zipMatched++;
            if (level === 1) matchedL1++;
            else if (level === 2) matchedL2++;
            else matchedL3++;

            // Build update payload
            const update = { id: building.id };
            let hasUpdate = false;

            if (a.YearBuilt1 && parseInt(a.YearBuilt1) > 1800 && !building.year_built) {
              update.year_built = parseInt(a.YearBuilt1);
              hasUpdate = true;
            }
            if (a.Units1 && parseInt(a.Units1) > 0 && !building.total_units) {
              update.total_units = parseInt(a.Units1);
              update.residential_units = parseInt(a.Units1);
              hasUpdate = true;
            }
            if (a.APN && !building.apn) {
              update.apn = a.APN;
              hasUpdate = true;
            }
            if (a.CENTER_LAT && a.CENTER_LON && (!building.latitude || !building.longitude)) {
              update.latitude = a.CENTER_LAT;
              update.longitude = a.CENTER_LON;
              hasUpdate = true;
            }
            if (a.UseDescription) {
              update.land_use = a.UseDescription;
              hasUpdate = true;
            }

            if (hasUpdate) updates.push(update);
          }

          // Write updates
          if (updates.length > 0 && !DRY_RUN) {
            for (let i = 0; i < updates.length; i += 100) {
              const batch = updates.slice(i, i + 100);
              let batchOk = 0;
              await Promise.all(batch.map(async (row) => {
                const { id, ...fields } = row;
                const { error: e } = await supabase.from("buildings").update(fields).eq("id", id);
                if (!e) batchOk++;
                else console.error(`    update ${id}: ${e.message}`);
              }));
              zipUpdated += batchOk;
            }
          } else {
            zipUpdated += updates.length;
          }

          assessorOffset += json.features.length;
          if (json.features.length < 1000) break;
        }

        totalAssessor += zipAssessor;
        totalMatched += zipMatched;
        totalUpdated += zipUpdated;

        const pct = zipAssessor > 0 ? ((zipMatched / zipAssessor) * 100).toFixed(1) : "0.0";
        if (zipMatched > 0 || zipAssessor > 500) {
          console.log(
            `  ${zip}: ${zipMatched}/${zipAssessor} matched (${pct}%) | ` +
            `${zipUpdated} updated | cumulative: ${totalMatched}/${totalBuildings} (${((totalMatched / totalBuildings) * 100).toFixed(1)}%)`
          );
        }
      } catch (e) {
        console.error(`  ${zip}: ${e.message}`);
      }
    }));
  }

  console.log("\n=== Summary ===");
  console.log(`Buildings loaded:    ${totalBuildings}`);
  console.log(`Assessor records:    ${totalAssessor}`);
  console.log(`Matched:             ${totalMatched} (${((totalMatched / totalBuildings) * 100).toFixed(1)}%)`);
  console.log(`  L1 (exact norm):   ${matchedL1}`);
  console.log(`  L2 (no type/half): ${matchedL2}`);
  console.log(`  L3 (num+name):     ${matchedL3}`);
  console.log(`Updated:             ${totalUpdated}`);
  if (DRY_RUN) console.log("(dry run - no writes performed)");
}

run().catch(console.error);
