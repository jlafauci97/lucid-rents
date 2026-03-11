#!/usr/bin/env node

/**
 * Scrape rent + amenity data from StreetEasy and Zillow for buildings.
 *
 * Usage:
 *   node scripts/scrape-rents.mjs                    # scrape next 50 buildings
 *   node scripts/scrape-rents.mjs --borough=Manhattan # filter by borough
 *   node scripts/scrape-rents.mjs --limit=100        # change batch size
 *   node scripts/scrape-rents.mjs --source=streeteasy # only StreetEasy
 *   node scripts/scrape-rents.mjs --source=zillow     # only Zillow
 */

import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ── ENV ──────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/\n$/, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── CLI ARGS ─────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v || "true"];
    })
);
const LIMIT = parseInt(args.limit || "50", 10);
const BOROUGH = args.borough || "";
const SOURCE = args.source || ""; // "streeteasy", "zillow", or "" for both
const DELAY_MS = 2000; // polite delay between requests

// ── HELPERS ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyForStreetEasy(address, borough) {
  // StreetEasy URLs: /building/{house-number}-{street-name}-{borough}
  // e.g. "123 EAST 4TH STREET" in Manhattan → "123-east-4-street-manhattan"
  const parts = address.split(",")[0].trim().toLowerCase();
  const slug = parts
    .replace(/\bstreet\b/g, "street")
    .replace(/\bavenue\b/g, "avenue")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bst\b/g, "street")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const boro = borough.toLowerCase().replace(/\s+/g, "-");
  return `${slug}-${boro}`;
}

async function fetchWithRetry(url, retries = 2) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow" });
      if (res.status === 404) return null;
      if (res.status === 429) {
        console.log(`  Rate limited, waiting 30s...`);
        await sleep(30000);
        continue;
      }
      if (!res.ok) {
        console.log(`  HTTP ${res.status} for ${url}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      if (i < retries) {
        await sleep(5000);
        continue;
      }
      console.log(`  Fetch error: ${err.message}`);
      return null;
    }
  }
  return null;
}

// ── AMENITY CATEGORIZATION ───────────────────────────────────────────────────
const AMENITY_CATEGORIES = {
  // Building
  doorman: "building", concierge: "building", elevator: "building",
  "live-in super": "building", superintendent: "building", lobby: "building",
  "package room": "building", "mail room": "building", "common area": "building",
  "community room": "building", "residents lounge": "building", lounge: "building",
  "co-working": "building", "coworking": "building", "business center": "building",
  "media room": "building", "game room": "building", "playroom": "building",
  "children's playroom": "building", library: "building", "wi-fi": "building",
  wifi: "building", "virtual doorman": "building", intercom: "building",
  "wheelchair accessible": "building", "ada accessible": "building",
  "smoke free": "building", "no smoking": "building",

  // Outdoor
  "roof deck": "outdoor", rooftop: "outdoor", terrace: "outdoor",
  balcony: "outdoor", patio: "outdoor", garden: "outdoor",
  "courtyard": "outdoor", backyard: "outdoor", "outdoor space": "outdoor",
  bbq: "outdoor", grill: "outdoor", "sun deck": "outdoor", pool: "outdoor",
  "swimming pool": "outdoor",

  // Fitness
  gym: "fitness", "fitness center": "fitness", "fitness room": "fitness",
  "yoga studio": "fitness", "yoga room": "fitness", sauna: "fitness",
  spa: "fitness", "steam room": "fitness", "basketball court": "fitness",
  "tennis court": "fitness", "rock climbing": "fitness",

  // Parking
  parking: "parking", garage: "parking", "bike room": "parking",
  "bike storage": "parking", "bicycle storage": "parking",
  "valet parking": "parking", "ev charging": "parking",

  // Laundry
  "laundry in unit": "laundry", "washer/dryer": "laundry",
  "in-unit laundry": "laundry", "laundry room": "laundry",
  "laundry in building": "laundry", "washer dryer": "laundry",

  // Security
  "security": "security", "video intercom": "security",
  "surveillance": "security", "key fob": "security", "cctv": "security",
  "security camera": "security", "24-hour security": "security",

  // Pet
  "pet friendly": "pet", "pets allowed": "pet", "dog friendly": "pet",
  "cat friendly": "pet", "pet spa": "pet", "dog run": "pet",
  "dog grooming": "pet", "pet grooming": "pet",

  // Storage
  storage: "storage", "storage room": "storage", "private storage": "storage",
  "wine storage": "storage", cellar: "storage",

  // Luxury
  "penthouse": "luxury", "private terrace": "luxury",
  "screening room": "luxury", "wine cellar": "luxury",
  "golf simulator": "luxury", "bowling alley": "luxury",
  "private dining": "luxury", "chef's kitchen": "luxury",
};

function categorizeAmenity(amenityText) {
  const lower = amenityText.toLowerCase().trim();
  for (const [keyword, category] of Object.entries(AMENITY_CATEGORIES)) {
    if (lower.includes(keyword)) return category;
  }
  return "other";
}

function normalizeAmenity(text) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── STREETEASY SCRAPER ───────────────────────────────────────────────────────
async function scrapeStreetEasy(building) {
  const slug = slugifyForStreetEasy(building.full_address, building.borough);
  const url = `https://streeteasy.com/building/${slug}`;

  console.log(`  StreetEasy: ${url}`);
  const html = await fetchWithRetry(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const rentData = new Map(); // bedrooms → { prices: [] }

  // StreetEasy rental listings appear in various formats.
  // Look for rental listing cards with price and bedroom info.

  // Method 1: Look for listing cards in the rentals section
  $('[data-testid="listing-card"], .listingCard, .listing-card, .SearchCardList .searchCard').each(
    (_, el) => {
      const card = $(el);
      const priceText =
        card.find('[data-testid="price"], .price, .listing-price').text() ||
        card.find("span").filter((_, s) => /\$[\d,]+/.test($(s).text())).first().text();

      const price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);
      if (!price || price < 500 || price > 50000) return;

      const bedText = card.text().toLowerCase();
      let beds = -1;
      if (/studio/i.test(bedText)) beds = 0;
      else {
        const m = bedText.match(/(\d)\s*(?:bed|br|bd)/);
        if (m) beds = parseInt(m[1], 10);
      }
      if (beds < 0) return;

      if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
      rentData.get(beds).prices.push(price);
    }
  );

  // Method 2: Look for rental summary/stats sections
  $(".building-stats, .rental-stats, [data-testid='rental-stats']").each(
    (_, el) => {
      const text = $(el).text();
      // Pattern: "Studio $X,XXX - $X,XXX" or "1 Bed $X,XXX"
      const patterns = [
        { re: /studio[^$]*\$?([\d,]+)(?:\s*[-–]\s*\$?([\d,]+))?/gi, beds: 0 },
        { re: /1\s*(?:bed|br|bd)[^$]*\$?([\d,]+)(?:\s*[-–]\s*\$?([\d,]+))?/gi, beds: 1 },
        { re: /2\s*(?:bed|br|bd)[^$]*\$?([\d,]+)(?:\s*[-–]\s*\$?([\d,]+))?/gi, beds: 2 },
        { re: /3\s*(?:bed|br|bd)[^$]*\$?([\d,]+)(?:\s*[-–]\s*\$?([\d,]+))?/gi, beds: 3 },
        { re: /4\+?\s*(?:bed|br|bd)[^$]*\$?([\d,]+)(?:\s*[-–]\s*\$?([\d,]+))?/gi, beds: 4 },
      ];
      for (const { re, beds } of patterns) {
        let m;
        while ((m = re.exec(text))) {
          const lo = parseInt(m[1].replace(/,/g, ""), 10);
          const hi = m[2] ? parseInt(m[2].replace(/,/g, ""), 10) : lo;
          if (lo >= 500 && lo <= 50000) {
            if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
            rentData.get(beds).prices.push(lo);
            if (hi !== lo) rentData.get(beds).prices.push(hi);
          }
        }
      }
    }
  );

  // Method 3: Scan entire page text for rent patterns near bedroom counts
  const fullText = $.text();
  const priceMatches = [
    ...fullText.matchAll(
      /(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)/gi
    ),
  ];
  for (const m of priceMatches) {
    const beds = m[1] ? parseInt(m[1], 10) : 0;
    const price = parseInt(m[2].replace(/,/g, ""), 10);
    if (price >= 500 && price <= 50000) {
      if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
      rentData.get(beds).prices.push(price);
    }
  }

  // ── Amenities ──
  const amenities = extractStreetEasyAmenities($);

  return { rents: aggregateRentData(rentData, "streeteasy"), amenities };
}

function extractStreetEasyAmenities($) {
  const amenities = new Set();

  // StreetEasy building pages have amenities sections
  // Look for amenity lists, features sections, etc.
  $(
    '.amenities li, .building-amenities li, [data-testid="amenities"] li, ' +
    '.BuildingAmenities li, .amenities-list li, .feature-list li, ' +
    '[class*="amenit"] li, [class*="Amenit"] li, [class*="feature"] li'
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1 && text.length < 80) {
      amenities.add(normalizeAmenity(text));
    }
  });

  // Also look for amenity tags/chips
  $(
    '.amenity-tag, .amenity-badge, [class*="amenity-tag"], [class*="AmenityTag"]'
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1 && text.length < 80) {
      amenities.add(normalizeAmenity(text));
    }
  });

  // Scan for known amenity keywords in the page text
  const fullText = $.text();
  const amenityKeywords = Object.keys(AMENITY_CATEGORIES);
  for (const kw of amenityKeywords) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (re.test(fullText)) {
      amenities.add(normalizeAmenity(kw));
    }
  }

  return [...amenities].map((a) => ({
    amenity: a,
    category: categorizeAmenity(a),
    source: "streeteasy",
  }));
}

// ── ZILLOW SCRAPER ───────────────────────────────────────────────────────────
async function scrapeZillow(building) {
  // Zillow uses address-based URLs
  const addr = building.full_address
    .replace(/,/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const url = `https://www.zillow.com/homes/${encodeURIComponent(addr)}_rb/`;

  console.log(`  Zillow: ${url}`);
  const html = await fetchWithRetry(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const rentData = new Map();

  // Zillow embeds data in JSON-LD and script tags
  $('script[type="application/ld-json"], script[type="application/json"]').each(
    (_, el) => {
      try {
        const json = JSON.parse($(el).html());
        // Look for rent/price data in various Zillow JSON structures
        extractZillowPrices(json, rentData);
      } catch {}
    }
  );

  // Also scan for __NEXT_DATA__ or preloaded state
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    if (text.includes("rentZestimate") || text.includes("price")) {
      try {
        // Extract JSON from script content
        const jsonMatch = text.match(/({.*})/s);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[1]);
          extractZillowPrices(json, rentData);
        }
      } catch {}
    }
  });

  // Scan page text for price patterns
  const fullText = $.text();
  const rentPatterns = [
    ...fullText.matchAll(
      /(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)(?:\s*[-–\/]\s*\$?\s*([\d,]+))?(?:\s*\/?\s*mo)/gi
    ),
  ];
  for (const m of rentPatterns) {
    const beds = m[1] ? parseInt(m[1], 10) : 0;
    const price = parseInt(m[2].replace(/,/g, ""), 10);
    if (price >= 500 && price <= 50000) {
      if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
      rentData.get(beds).prices.push(price);
      if (m[3]) {
        const hi = parseInt(m[3].replace(/,/g, ""), 10);
        if (hi >= 500 && hi <= 50000) rentData.get(beds).prices.push(hi);
      }
    }
  }

  // Look for Zestimate rent value
  const zestMatch = fullText.match(
    /(?:rent\s*zestimate|estimated\s*rent)[^$]*\$\s*([\d,]+)/i
  );
  if (zestMatch) {
    const price = parseInt(zestMatch[1].replace(/,/g, ""), 10);
    if (price >= 500 && price <= 50000) {
      // Without bedroom info, store as -1 (overall estimate)
      if (!rentData.has(-1)) rentData.set(-1, { prices: [] });
      rentData.get(-1).prices.push(price);
    }
  }

  // ── Amenities ──
  const amenities = extractZillowAmenities($);

  return { rents: aggregateRentData(rentData, "zillow"), amenities };
}

function extractZillowAmenities($) {
  const amenities = new Set();

  // Zillow has various amenity/feature sections
  $(
    '[class*="amenity"] li, [class*="Amenity"] li, ' +
    '[class*="feature"] li, [class*="Feature"] li, ' +
    '[data-testid*="amenity"] li, [data-testid*="feature"] li, ' +
    '.building-amenities li, .unit-features li'
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 1 && text.length < 80) {
      amenities.add(normalizeAmenity(text));
    }
  });

  // Look for amenities in JSON data
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    if (text.includes("amenities") || text.includes("features")) {
      try {
        const jsonMatch = text.match(/({.*})/s);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[1]);
          extractZillowAmenitiesFromJson(json, amenities);
        }
      } catch {}
    }
  });

  // Scan page text for known amenity keywords
  const fullText = $.text();
  const amenityKeywords = Object.keys(AMENITY_CATEGORIES);
  for (const kw of amenityKeywords) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (re.test(fullText)) {
      amenities.add(normalizeAmenity(kw));
    }
  }

  return [...amenities].map((a) => ({
    amenity: a,
    category: categorizeAmenity(a),
    source: "zillow",
  }));
}

function extractZillowAmenitiesFromJson(obj, amenities, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "string" && item.length > 1 && item.length < 80) {
        // Check if it looks like an amenity
        const lower = item.toLowerCase();
        for (const kw of Object.keys(AMENITY_CATEGORIES)) {
          if (lower.includes(kw)) {
            amenities.add(normalizeAmenity(item));
            break;
          }
        }
      }
      extractZillowAmenitiesFromJson(item, amenities, depth + 1);
    }
    return;
  }

  // Check for amenity-named fields
  for (const [key, val] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (
      (lk.includes("amenity") || lk.includes("feature")) &&
      Array.isArray(val)
    ) {
      for (const item of val) {
        const text = typeof item === "string" ? item : item?.name || item?.text;
        if (text && text.length > 1 && text.length < 80) {
          amenities.add(normalizeAmenity(text));
        }
      }
    }
    if (typeof val === "object") {
      extractZillowAmenitiesFromJson(val, amenities, depth + 1);
    }
  }
}

function extractZillowPrices(obj, rentData, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== "object") return;

  // Look for price/rent fields
  if (obj.rentZestimate || obj.rent_zestimate) {
    const price = parseInt(obj.rentZestimate || obj.rent_zestimate, 10);
    if (price >= 500 && price <= 50000) {
      const beds = obj.bedrooms ?? obj.beds ?? -1;
      if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
      rentData.get(beds).prices.push(price);
    }
  }

  if (obj.price && obj.bedrooms != null) {
    const price =
      typeof obj.price === "string"
        ? parseInt(obj.price.replace(/[^0-9]/g, ""), 10)
        : obj.price;
    if (price >= 500 && price <= 50000) {
      const beds = parseInt(obj.bedrooms, 10);
      if (!rentData.has(beds)) rentData.set(beds, { prices: [] });
      rentData.get(beds).prices.push(price);
    }
  }

  // Recurse
  if (Array.isArray(obj)) {
    for (const item of obj) extractZillowPrices(item, rentData, depth + 1);
  } else {
    for (const val of Object.values(obj)) {
      if (typeof val === "object")
        extractZillowPrices(val, rentData, depth + 1);
    }
  }
}

// ── AGGREGATE & UPSERT ──────────────────────────────────────────────────────
function aggregateRentData(rentData, source) {
  const results = [];
  for (const [beds, { prices }] of rentData) {
    if (beds < 0 || prices.length === 0) continue;
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    results.push({
      bedrooms: beds,
      source,
      min_rent: prices[0],
      max_rent: prices[prices.length - 1],
      median_rent:
        prices.length % 2 === 0
          ? Math.round((prices[mid - 1] + prices[mid]) / 2)
          : prices[mid],
      listing_count: prices.length,
    });
  }
  return results;
}

async function upsertRents(buildingId, rentRows) {
  if (rentRows.length === 0) return 0;

  const rows = rentRows.map((r) => ({
    building_id: buildingId,
    source: r.source,
    bedrooms: r.bedrooms,
    min_rent: r.min_rent,
    max_rent: r.max_rent,
    median_rent: r.median_rent,
    listing_count: r.listing_count,
    scraped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("building_rents")
    .upsert(rows, { onConflict: "building_id,source,bedrooms" });

  if (error) {
    console.log(`  Upsert error: ${error.message}`);
    return 0;
  }
  return rows.length;
}

async function upsertAmenities(buildingId, amenityRows) {
  if (amenityRows.length === 0) return 0;

  const rows = amenityRows.map((a) => ({
    building_id: buildingId,
    source: a.source,
    amenity: a.amenity,
    category: a.category,
    scraped_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("building_amenities")
    .upsert(rows, { onConflict: "building_id,source,amenity" });

  if (error) {
    console.log(`  Amenity upsert error: ${error.message}`);
    return 0;
  }
  return rows.length;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `Scraping rents — limit=${LIMIT}, borough=${BOROUGH || "all"}, source=${SOURCE || "both"}`
  );

  // Get buildings that haven't been scraped recently (or ever)
  let query = supabase
    .from("buildings")
    .select("id, full_address, borough, zip_code, slug, residential_units")
    .gt("residential_units", 0)
    .order("review_count", { ascending: false })
    .limit(LIMIT);

  if (BOROUGH) {
    query = query.eq("borough", BOROUGH);
  }

  const { data: buildings, error } = await query;
  if (error) {
    console.error("Failed to fetch buildings:", error.message);
    process.exit(1);
  }

  console.log(`Found ${buildings.length} buildings to scrape\n`);

  let totalRents = 0;
  let totalAmenities = 0;
  let scraped = 0;

  for (const building of buildings) {
    scraped++;
    console.log(
      `[${scraped}/${buildings.length}] ${building.full_address} (${building.borough})`
    );

    let allRents = [];
    let allAmenities = [];

    if (!SOURCE || SOURCE === "streeteasy") {
      try {
        const result = await scrapeStreetEasy(building);
        if (result.rents.length > 0) {
          console.log(`  StreetEasy: ${result.rents.length} rent entries`);
          allRents.push(...result.rents);
        } else {
          console.log(`  StreetEasy: no rent data`);
        }
        if (result.amenities.length > 0) {
          console.log(`  StreetEasy: ${result.amenities.length} amenities`);
          allAmenities.push(...result.amenities);
        }
      } catch (err) {
        console.log(`  StreetEasy error: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }

    if (!SOURCE || SOURCE === "zillow") {
      try {
        const result = await scrapeZillow(building);
        if (result.rents.length > 0) {
          console.log(`  Zillow: ${result.rents.length} rent entries`);
          allRents.push(...result.rents);
        } else {
          console.log(`  Zillow: no rent data`);
        }
        if (result.amenities.length > 0) {
          console.log(`  Zillow: ${result.amenities.length} amenities`);
          allAmenities.push(...result.amenities);
        }
      } catch (err) {
        console.log(`  Zillow error: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }

    totalRents += await upsertRents(building.id, allRents);
    totalAmenities += await upsertAmenities(building.id, allAmenities);
    console.log();
  }

  console.log(`\nDone! ${totalRents} rent records, ${totalAmenities} amenities for ${scraped} buildings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
