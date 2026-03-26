/**
 * Houston-area zip code -> primary neighborhood name mapping.
 * Covers the main residential zip codes in Houston / Harris County.
 */
export const HOUSTON_ZIP_NEIGHBORHOODS: Record<string, string> = {
  // ── Downtown / Midtown ────────────────────────────────────────
  "77002": "Downtown",
  "77003": "East End",
  "77004": "Third Ward",
  "77006": "Montrose",
  "77010": "Downtown",
  "77019": "River Oaks",

  // ── Midtown / Montrose / Museum District ──────────────────────
  "77005": "Rice Village",
  "77030": "Medical Center",
  "77098": "Upper Kirby",
  "77027": "Galleria",
  "77046": "Greenway",

  // ── Heights / Near Northside ──────────────────────────────────
  "77007": "Heights",
  "77008": "Heights",
  "77009": "Near Northside",
  "77022": "Independence Heights",
  "77026": "Northside",

  // ── Montrose / River Oaks extended ────────────────────────────
  "77024": "Memorial",
  "77025": "Braeswood",
  "77035": "Meyerland",
  "77096": "Meyerland",
  "77401": "Bellaire",

  // ── West / Memorial / Spring Branch ───────────────────────────
  "77018": "Oak Forest",
  "77043": "Spring Branch",
  "77055": "Spring Branch",
  "77080": "Spring Branch",
  "77079": "Memorial",
  "77042": "Westchase",
  "77057": "Galleria",
  "77063": "Sharpstown",
  "77036": "Gulfton",
  "77074": "Sharpstown",
  "77077": "Energy Corridor",
  "77082": "Westchase",
  "77084": "Cypress",

  // ── Inside the Loop (misc) ────────────────────────────────────
  "77011": "East End",
  "77012": "Second Ward",
  "77020": "East End",
  "77021": "Third Ward",
  "77023": "EaDo",

  // ── Southwest ─────────────────────────────────────────────────
  "77031": "South Main",
  "77033": "South Park",
  "77045": "South Main",
  "77047": "Sunnyside",
  "77048": "South Houston",
  "77051": "South Park",
  "77053": "Fort Bend",
  "77054": "Medical Center",
  "77071": "Sharpstown",
  "77081": "Sharpstown",
  "77085": "South Main",
  "77099": "Westchase",

  // ── Northwest ─────────────────────────────────────────────────
  "77014": "Greenspoint",
  "77015": "Channelview",
  "77016": "Homestead",
  "77028": "Kashmere Gardens",
  "77029": "Channelview",
  "77032": "Greenspoint",
  "77037": "Aldine",
  "77038": "Aldine",
  "77039": "Aldine",
  "77040": "Northwest Houston",
  "77041": "Northwest Houston",
  "77060": "Greenspoint",
  "77064": "Cypress",
  "77065": "Cypress",
  "77066": "Champions",
  "77067": "Greenspoint",
  "77068": "Champions",
  "77069": "Champions",
  "77070": "Northwest Houston",
  "77086": "Greenspoint",
  "77088": "Acres Home",
  "77091": "Acres Home",
  "77092": "Garden Oaks",
  "77093": "Aldine",

  // ── Northeast ─────────────────────────────────────────────────
  "77013": "Homestead",
  "77044": "Lake Houston",
  "77049": "Lake Houston",
  "77050": "Humble",

  // ── Suburbs / Outer ───────────────────────────────────────────
  "77058": "Clear Lake",
  "77059": "Clear Lake",
  "77062": "Clear Lake",
  "77089": "South Belt",
  "77017": "South Houston",
  "77034": "South Belt",
  "77075": "Glenbrook Valley",
  "77087": "Park Place",

  // ── Sugar Land / Pearland ─────────────────────────────────────
  "77478": "Sugar Land",
  "77479": "Sugar Land",
  "77498": "Sugar Land",
  "77581": "Pearland",
  "77584": "Pearland",
  "77588": "Pearland",

  // ── Katy ──────────────────────────────────────────────────────
  "77449": "Katy",
  "77450": "Katy",
  "77493": "Katy",
  "77494": "Katy",

  // ── Kingwood / Humble ─────────────────────────────────────────
  "77339": "Kingwood",
  "77345": "Kingwood",
  "77346": "Humble",
  "77338": "Humble",
  "77396": "Humble",

  // ── The Woodlands ─────────────────────────────────────────────
  "77380": "The Woodlands",
  "77381": "The Woodlands",
  "77382": "The Woodlands",
  "77384": "The Woodlands",
  "77385": "The Woodlands",
  "77386": "Spring",
  "77388": "Spring",
  "77389": "Spring",

  // ── Pasadena / Deer Park ──────────────────────────────────────
  "77502": "Pasadena",
  "77503": "Pasadena",
  "77504": "Pasadena",
  "77505": "Pasadena",
  "77506": "Pasadena",
  "77536": "Deer Park",

  // ── Timbergrove / Lazybrook ───────────────────────────────────
  "77092": "Garden Oaks",
};

/** Neighborhood -> region mapping for Houston areas */
const HOUSTON_REGION_MAP: Record<string, string> = {
  "Downtown": "Inner Loop",
  "Midtown": "Inner Loop",
  "Montrose": "Inner Loop",
  "Heights": "Inner Loop",
  "River Oaks": "Inner Loop",
  "Upper Kirby": "Inner Loop",
  "Museum District": "Inner Loop",
  "Medical Center": "Inner Loop",
  "Rice Village": "Inner Loop",
  "Greenway": "Inner Loop",
  "EaDo": "Inner Loop",
  "East End": "Inner Loop",
  "Second Ward": "Inner Loop",
  "Third Ward": "Inner Loop",
  "Northside": "Inner Loop",
  "Near Northside": "Inner Loop",

  "Galleria": "West Houston",
  "Memorial": "West Houston",
  "Spring Branch": "West Houston",
  "Energy Corridor": "West Houston",
  "Westchase": "West Houston",
  "Sharpstown": "West Houston",
  "Gulfton": "West Houston",
  "Katy": "West Houston",
  "Cypress": "West Houston",

  "West University": "Southwest Houston",
  "Bellaire": "Southwest Houston",
  "Meyerland": "Southwest Houston",
  "Braeswood": "Southwest Houston",
  "South Main": "Southwest Houston",
  "South Park": "Southwest Houston",
  "Sunnyside": "Southwest Houston",
  "Fort Bend": "Southwest Houston",
  "Sugar Land": "Southwest Houston",
  "Pearland": "Southwest Houston",

  "Oak Forest": "Northwest Houston",
  "Garden Oaks": "Northwest Houston",
  "Independence Heights": "Northwest Houston",
  "Acres Home": "Northwest Houston",
  "Greenspoint": "Northwest Houston",
  "Champions": "Northwest Houston",
  "Aldine": "Northwest Houston",
  "Northwest Houston": "Northwest Houston",
  "The Woodlands": "Northwest Houston",
  "Spring": "Northwest Houston",

  "Kashmere Gardens": "Northeast Houston",
  "Homestead": "Northeast Houston",
  "Lake Houston": "Northeast Houston",
  "Channelview": "Northeast Houston",
  "Humble": "Northeast Houston",
  "Kingwood": "Northeast Houston",

  "Clear Lake": "Southeast Houston",
  "South Belt": "Southeast Houston",
  "South Houston": "Southeast Houston",
  "Glenbrook Valley": "Southeast Houston",
  "Park Place": "Southeast Houston",
  "Pasadena": "Southeast Houston",
  "Deer Park": "Southeast Houston",
};

/** Zip code -> region mapping for Houston */
export const HOUSTON_ZIP_REGIONS: Record<string, string> = {};
for (const [zip, name] of Object.entries(HOUSTON_ZIP_NEIGHBORHOODS)) {
  HOUSTON_ZIP_REGIONS[zip] = HOUSTON_REGION_MAP[name] || "Greater Houston";
}

export interface HoustonNeighborhoodMatch {
  zipCode: string;
  name: string;
  region: string;
}

/** Search Houston neighborhoods by zip prefix or name substring */
export function searchHoustonNeighborhoods(query: string, limit = 3): HoustonNeighborhoodMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: HoustonNeighborhoodMatch[] = [];
  const isDigits = /^\d+$/.test(q);

  for (const [zip, name] of Object.entries(HOUSTON_ZIP_NEIGHBORHOODS)) {
    if (results.length >= limit) break;

    const match = isDigits
      ? zip.startsWith(q)
      : name.toLowerCase().includes(q);

    if (match) {
      results.push({
        zipCode: zip,
        name,
        region: HOUSTON_ZIP_REGIONS[zip] || "Greater Houston",
      });
    }
  }

  return results;
}

/** Get the neighborhood name for a Houston zip code, or null if unknown */
export function getHoustonNeighborhoodName(zipCode: string): string | null {
  return HOUSTON_ZIP_NEIGHBORHOODS[zipCode] ?? null;
}

/** Build the URL slug for a Houston neighborhood page. */
export function houstonNeighborhoodPageSlug(zipCode: string): string {
  const name = getHoustonNeighborhoodName(zipCode);
  if (!name) return zipCode;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${slug}-${zipCode}`;
}
