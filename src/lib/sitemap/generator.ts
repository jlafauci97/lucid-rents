/**
 * Sitemap chunk generator — TypeScript port of scripts/generate-sitemaps.mjs.
 *
 * Output must remain byte-identical with the legacy script so the cron-driven
 * Blob path can swap in without GSC re-crawl regressions. Inlined constants
 * (CITY_META regions, ZIP maps, etc) are intentionally duplicated from the
 * legacy script — keeping them in sync with src/lib/cities.ts is a manual
 * exercise. The duplication exists because the script was deliberately
 * detached from TS imports to avoid build-time coupling.
 */
import { put } from "@vercel/blob";

export const BASE_URL = "https://lucidrents.com";

// ─── Supabase config ───────────────────────────────────────────

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

// ─── City config (inlined to match scripts/generate-sitemaps.mjs) ───

export type City = "nyc" | "los-angeles" | "chicago" | "miami" | "houston";

export const VALID_CITIES: City[] = [
  "nyc",
  "los-angeles",
  "chicago",
  "miami",
  "houston",
];

interface CityMeta {
  urlPrefix: string;
  regions: string[];
}

const CITY_META: Record<City, CityMeta> = {
  nyc: {
    urlPrefix: "nyc",
    regions: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
  },
  "los-angeles": {
    urlPrefix: "CA/Los-Angeles",
    regions: [
      "Downtown","Hollywood","Silver Lake","Echo Park","Los Feliz","Koreatown","Mid-Wilshire","Westlake","East Hollywood","Thai Town","Highland Park","Eagle Rock","Boyle Heights","Lincoln Heights","El Sereno","Glassell Park","Atwater Village","Venice","Mar Vista","Palms","West Los Angeles","Sawtelle","Brentwood","Pacific Palisades","Westwood","Century City","Culver City","Playa Vista","South LA","Leimert Park","Baldwin Hills","Crenshaw","Watts","Wilmington","San Pedro","Harbor City","North Hollywood","Studio City","Sherman Oaks","Van Nuys","Encino","Tarzana","Reseda","Northridge","Chatsworth","Canoga Park","Woodland Hills","Sunland-Tujunga","Sylmar","Pacoima","Arleta","Sun Valley",
    ],
  },
  chicago: {
    urlPrefix: "IL/Chicago",
    regions: [
      "Loop","South Loop","West Loop","River North","Gold Coast","Streeterville","Old Town","Lincoln Park","Lakeview","Wicker Park","Bucktown","Logan Square","Humboldt Park","Avondale","Lincoln Square","Uptown","Edgewater","Rogers Park","Hyde Park","Bronzeville","Woodlawn","South Shore","Chatham","Englewood","Auburn Gresham","Beverly","Pilsen","Bridgeport","Chinatown","Back of the Yards","Brighton Park","Austin","Garfield Park","North Lawndale","Irving Park","Portage Park","Jefferson Park","Belmont Cragin","South Chicago","Roseland",
    ],
  },
  miami: {
    urlPrefix: "FL/Miami",
    regions: [
      "Brickell","Downtown Miami","Wynwood","Edgewater","Midtown","Miami Beach","South Beach","North Beach","Coconut Grove","Coral Gables","Little Havana","Little Haiti","Allapattah","Overtown","Design District","Upper East Side","Morningside","Doral","Kendall","Hialeah","Aventura","Sunny Isles Beach","Coral Way","Flagami","Key Biscayne","North Miami","Palmetto Bay","Pinecrest","Cutler Bay","Miami Gardens","Sweetwater","Surfside","Bal Harbour","West Kendall","Fontainebleau","Liberty City",
    ],
  },
  houston: {
    urlPrefix: "TX/Houston",
    regions: [
      "Downtown","Midtown","Montrose","Heights","River Oaks","Upper Kirby","Galleria","Museum District","Medical Center","Rice Village","West University","Bellaire","Meyerland","Memorial","Spring Branch","Katy","Energy Corridor","Westchase","Sharpstown","Gulfton","Third Ward","East End","Second Ward","EaDo","Northside","Near Northside","Independence Heights","Oak Forest","Garden Oaks","Timbergrove","Lazybrook","Greenway","Braeswood","South Main","Pearland","Sugar Land","Clear Lake","Pasadena","Cypress","Humble","Kingwood","The Woodlands",
    ],
  },
};

const NEWS_CATEGORIES = [
  "rental-market",
  "tenant-rights",
  "data-insights",
  "guides",
  "general",
];

const SUBWAY_LINE_SLUGS = [
  "1-train","2-train","3-train","4-train","5-train","6-train","7-train",
  "a-train","c-train","e-train","b-train","d-train","f-train","m-train",
  "g-train","j-train","z-train","l-train","n-train","q-train","r-train",
  "w-train","s-shuttle",
];

const NYC_ZIPS: Record<string, string> = {"10001":"Chelsea","10002":"Lower East Side","10003":"East Village","10004":"Financial District","10005":"Financial District","10006":"Financial District","10007":"Tribeca","10009":"East Village","10010":"Gramercy Park","10011":"Chelsea","10012":"SoHo","10013":"Tribeca","10014":"West Village","10016":"Murray Hill","10017":"Midtown East","10018":"Midtown","10019":"Midtown West","10020":"Midtown","10021":"Upper East Side","10022":"Midtown East","10023":"Upper West Side","10024":"Upper West Side","10025":"Upper West Side","10026":"Harlem","10027":"Harlem","10028":"Upper East Side","10029":"East Harlem","10030":"Harlem","10031":"Hamilton Heights","10032":"Washington Heights","10033":"Washington Heights","10034":"Inwood","10035":"East Harlem","10036":"Midtown West","10037":"Harlem","10038":"Financial District","10039":"Harlem","10040":"Washington Heights","10044":"Roosevelt Island","10065":"Upper East Side","10069":"Upper West Side","10075":"Upper East Side","10128":"Upper East Side","10280":"Battery Park City","10281":"Battery Park City","10282":"Battery Park City","10451":"Mott Haven","10452":"Highbridge","10453":"Morris Heights","10454":"Mott Haven","10455":"Hunts Point","10456":"Morrisania","10457":"Tremont","10458":"Fordham","10459":"Longwood","10460":"West Farms","10461":"Pelham Bay","10462":"Parkchester","10463":"Kingsbridge","10464":"City Island","10465":"Throgs Neck","10466":"Wakefield","10467":"Norwood","10468":"University Heights","10469":"Williamsbridge","10470":"Woodlawn","10471":"Riverdale","10472":"Soundview","10473":"Clason Point","10474":"Hunts Point","10475":"Co-op City","11201":"Brooklyn Heights","11203":"East Flatbush","11204":"Bensonhurst","11205":"Fort Greene","11206":"Williamsburg","11207":"East New York","11208":"East New York","11209":"Bay Ridge","11210":"Flatbush","11211":"Williamsburg","11212":"Brownsville","11213":"Crown Heights","11214":"Bensonhurst","11215":"Park Slope","11216":"Bedford-Stuyvesant","11217":"Park Slope","11218":"Kensington","11219":"Borough Park","11220":"Sunset Park","11221":"Bushwick","11222":"Greenpoint","11223":"Gravesend","11224":"Coney Island","11225":"Crown Heights","11226":"Flatbush","11228":"Dyker Heights","11229":"Sheepshead Bay","11230":"Midwood","11231":"Carroll Gardens","11232":"Sunset Park","11233":"Bedford-Stuyvesant","11234":"Canarsie","11235":"Brighton Beach","11236":"Canarsie","11237":"Bushwick","11238":"Prospect Heights","11239":"East New York","11101":"Long Island City","11102":"Astoria","11103":"Astoria","11104":"Sunnyside","11105":"Astoria","11106":"Astoria","11354":"Flushing","11355":"Flushing","11356":"College Point","11357":"Whitestone","11358":"Auburndale","11360":"Bayside","11361":"Bayside","11362":"Little Neck","11363":"Douglaston","11364":"Oakland Gardens","11365":"Fresh Meadows","11366":"Fresh Meadows","11367":"Kew Gardens Hills","11368":"Corona","11369":"East Elmhurst","11370":"East Elmhurst","11372":"Jackson Heights","11373":"Elmhurst","11374":"Rego Park","11375":"Forest Hills","11377":"Woodside","11378":"Maspeth","11379":"Middle Village","11385":"Ridgewood","11411":"Cambria Heights","11412":"St. Albans","11413":"Springfield Gardens","11414":"Howard Beach","11415":"Kew Gardens","11416":"Ozone Park","11417":"Ozone Park","11418":"Richmond Hill","11419":"South Richmond Hill","11420":"South Ozone Park","11421":"Woodhaven","11422":"Rosedale","11423":"Hollis","11426":"Bellerose","11427":"Queens Village","11428":"Queens Village","11429":"Queens Village","11432":"Jamaica","11433":"Jamaica","11434":"Jamaica","11435":"Briarwood","11436":"South Ozone Park","11691":"Far Rockaway","11692":"Arverne","11693":"Far Rockaway","11694":"Rockaway Park","11697":"Breezy Point","10301":"St. George","10302":"Port Richmond","10303":"Mariners Harbor","10304":"Stapleton","10305":"Rosebank","10306":"New Dorp","10307":"Tottenville","10308":"Great Kills","10309":"Charleston","10310":"West Brighton","10312":"Eltingville","10314":"Bulls Head"};

const LA_ZIPS: Record<string, string> = {"90012":"Downtown","90013":"Downtown","90014":"Downtown","90015":"Downtown","90017":"Downtown","90021":"Downtown","90071":"Downtown","90004":"Los Feliz","90005":"Koreatown","90006":"Koreatown","90010":"Mid-Wilshire","90019":"Mid-City","90020":"Koreatown","90026":"Echo Park","90027":"Los Feliz","90028":"Hollywood","90029":"East Hollywood","90036":"Mid-Wilshire","90038":"Hollywood","90039":"Silver Lake","90057":"Westlake","90031":"Lincoln Heights","90032":"El Sereno","90033":"Boyle Heights","90063":"East Los Angeles","90065":"Glassell Park","90041":"Eagle Rock","90042":"Highland Park","90024":"Westwood","90025":"West Los Angeles","90034":"Palms","90035":"Mid-Wilshire","90049":"Brentwood","90064":"Rancho Park","90066":"Mar Vista","90067":"Century City","90077":"Bel Air","90094":"Playa Vista","90230":"Culver City","90232":"Culver City","90272":"Pacific Palisades","90291":"Venice","90292":"Marina del Rey","90293":"Playa del Rey","90401":"Santa Monica","90402":"Santa Monica","90403":"Santa Monica","90404":"Santa Monica","90405":"Santa Monica","90001":"Florence","90002":"Watts","90003":"South LA","90007":"South LA","90008":"Baldwin Hills","90011":"South LA","90016":"West Adams","90018":"West Adams","90037":"South LA","90043":"Leimert Park","90044":"Willowbrook","90047":"Gramercy Park","90059":"Watts","90061":"South LA","90062":"South LA","90089":"University Park","90710":"Harbor City","90731":"San Pedro","90732":"San Pedro","90744":"Wilmington","90745":"Carson","90746":"Carson","90810":"Long Beach","91040":"Sunland-Tujunga","91042":"Tujunga","91302":"Calabasas","91303":"Canoga Park","91304":"Canoga Park","91306":"Winnetka","91307":"West Hills","91311":"Chatsworth","91316":"Encino","91324":"Northridge","91325":"Northridge","91326":"Porter Ranch","91331":"Pacoima","91335":"Reseda","91340":"San Fernando","91342":"Sylmar","91343":"North Hills","91344":"Granada Hills","91345":"Mission Hills","91352":"Sun Valley","91356":"Tarzana","91364":"Woodland Hills","91367":"Woodland Hills","91401":"Van Nuys","91402":"Panorama City","91403":"Sherman Oaks","91405":"Van Nuys","91406":"Van Nuys","91411":"Van Nuys","91423":"Sherman Oaks","91436":"Encino","91501":"Burbank","91502":"Burbank","91504":"Burbank","91505":"Burbank","91506":"Burbank","91601":"North Hollywood","91602":"North Hollywood","91604":"Studio City","91605":"North Hollywood","91606":"North Hollywood","91607":"Valley Village","91608":"Universal City","91201":"Glendale","91202":"Glendale","91203":"Glendale","91204":"Glendale","91205":"Glendale","91206":"Glendale","91207":"Glendale","91101":"Pasadena","91103":"Pasadena","91104":"Pasadena","91105":"Pasadena","91106":"Pasadena","91107":"Pasadena","90220":"Compton","90221":"Compton","90222":"Compton","90240":"Downey","90241":"Downey","90242":"Downey","90250":"Hawthorne","90260":"Lawndale","90262":"Lynwood","90270":"Maywood","90280":"South Gate","90301":"Inglewood","90302":"Inglewood","90303":"Inglewood","90304":"Inglewood","90501":"Torrance","90502":"Torrance","90503":"Torrance","90504":"Torrance","90505":"Torrance"};

const CHICAGO_ZIPS: Record<string, string> = {"60601":"South Loop","60602":"Loop","60603":"Loop","60604":"Loop","60605":"South Loop","60606":"West Loop","60607":"West Loop","60661":"West Loop","60610":"Old Town","60611":"Streeterville","60642":"Goose Island","60654":"River North","60613":"Lakeview","60614":"Lincoln Park","60618":"Avondale","60625":"Lincoln Square","60657":"Lakeview","60626":"Rogers Park","60640":"Uptown","60645":"West Ridge","60659":"West Rogers Park","60660":"Edgewater","60630":"Jefferson Park","60631":"Edison Park","60634":"Portage Park","60639":"Belmont Cragin","60641":"Irving Park","60646":"Norwood Park","60656":"O'Hare","60612":"Near West Side","60622":"Wicker Park","60623":"North Lawndale","60624":"Garfield Park","60644":"Austin","60647":"Logan Square","60651":"Humboldt Park","60608":"Pilsen","60609":"Back of the Yards","60616":"Chinatown","60629":"Chicago Lawn","60632":"Brighton Park","60636":"West Englewood","60638":"Clearing","60652":"Ashburn","60615":"Hyde Park","60617":"South Chicago","60619":"Chatham","60620":"Auburn Gresham","60621":"Englewood","60628":"Roseland","60637":"Woodlawn","60649":"South Shore","60653":"Bronzeville","60655":"Hegewisch","60643":"Beverly"};

const MIAMI_ZIPS: Record<string, string> = {"33128":"Downtown Miami","33130":"Downtown Miami","33131":"Brickell","33132":"Downtown Miami","33127":"Wynwood","33137":"Edgewater","33138":"Upper East Side","33139":"South Beach","33140":"Mid-Beach","33141":"North Beach","33109":"Fisher Island","33154":"Surfside","33125":"Little Havana","33126":"Flagami","33129":"Brickell","33133":"Coconut Grove","33135":"Flagami","33136":"Overtown","33142":"Allapattah","33144":"Coral Way","33145":"Coral Way","33150":"Little Haiti","33134":"Coral Gables","33143":"South Miami","33146":"Coral Gables","33147":"Liberty City","33148":"Liberty City","33160":"Sunny Isles Beach","33161":"North Miami","33162":"North Miami Beach","33167":"North Miami","33168":"Miami Gardens","33169":"Miami Gardens","33179":"Aventura","33180":"Aventura","33181":"North Miami Beach","33122":"Doral","33166":"Doral","33172":"Doral","33174":"Sweetwater","33175":"Fontainebleau","33178":"Doral","33184":"Sweetwater","33010":"Hialeah","33012":"Hialeah","33013":"Hialeah","33014":"Hialeah","33015":"Hialeah Gardens","33016":"Hialeah","33018":"Hialeah Gardens","33155":"West Miami","33156":"Pinecrest","33157":"Cutler Bay","33158":"Palmetto Bay","33173":"Kendall","33176":"Kendall","33177":"Kendall","33182":"West Kendall","33183":"Kendall","33185":"West Kendall","33186":"Kendall","33187":"West Kendall","33189":"Cutler Bay","33193":"Kendale Lakes","33196":"West Kendall","33149":"Key Biscayne","33153":"Bal Harbour","33030":"Homestead","33031":"Homestead","33033":"Homestead","33034":"Florida City","33035":"Homestead"};

const HOUSTON_ZIPS: Record<string, string> = {"77002":"Downtown","77003":"East End","77004":"Third Ward","77006":"Montrose","77010":"Downtown","77019":"River Oaks","77005":"Rice Village","77030":"Medical Center","77098":"Upper Kirby","77027":"Galleria","77046":"Greenway","77007":"Heights","77008":"Heights","77009":"Near Northside","77022":"Independence Heights","77026":"Northside","77024":"Memorial","77025":"Braeswood","77035":"Meyerland","77096":"Meyerland","77401":"Bellaire","77018":"Oak Forest","77043":"Spring Branch","77055":"Spring Branch","77080":"Spring Branch","77079":"Memorial","77042":"Westchase","77057":"Galleria","77063":"Sharpstown","77036":"Gulfton","77074":"Sharpstown","77077":"Energy Corridor","77082":"Westchase","77084":"Cypress","77011":"East End","77012":"Second Ward","77020":"East End","77021":"Third Ward","77023":"EaDo","77031":"South Main","77033":"South Park","77045":"South Main","77047":"Sunnyside","77048":"South Houston","77051":"South Park","77053":"Fort Bend","77054":"Medical Center","77071":"Sharpstown","77081":"Sharpstown","77085":"South Main","77099":"Westchase","77014":"Greenspoint","77015":"Channelview","77016":"Homestead","77028":"Kashmere Gardens","77029":"Channelview","77032":"Greenspoint","77037":"Aldine","77038":"Aldine","77039":"Aldine","77040":"Northwest Houston","77041":"Northwest Houston","77060":"Greenspoint","77064":"Cypress","77065":"Cypress","77066":"Champions","77067":"Greenspoint","77068":"Champions","77069":"Champions","77070":"Northwest Houston","77086":"Greenspoint","77088":"Acres Home","77091":"Acres Home","77092":"Garden Oaks","77093":"Aldine","77013":"Homestead","77044":"Lake Houston","77049":"Lake Houston","77050":"Humble","77058":"Clear Lake","77059":"Clear Lake","77062":"Clear Lake","77089":"South Belt","77017":"South Houston","77034":"South Belt","77075":"Glenbrook Valley","77087":"Park Place","77478":"Sugar Land","77479":"Sugar Land","77498":"Sugar Land","77581":"Pearland","77584":"Pearland","77588":"Pearland","77449":"Katy","77450":"Katy","77493":"Katy","77494":"Katy","77339":"Kingwood","77345":"Kingwood","77346":"Humble","77338":"Humble","77396":"Humble","77380":"The Woodlands","77381":"The Woodlands","77382":"The Woodlands","77384":"The Woodlands","77385":"The Woodlands","77386":"Spring","77388":"Spring","77389":"Spring","77502":"Pasadena","77503":"Pasadena","77504":"Pasadena","77505":"Pasadena","77506":"Pasadena","77536":"Deer Park"};

const ZIP_MAPS: Record<City, Record<string, string>> = {
  nyc: NYC_ZIPS,
  "los-angeles": LA_ZIPS,
  chicago: CHICAGO_ZIPS,
  miami: MIAMI_ZIPS,
  houston: HOUSTON_ZIPS,
};

const TEMPLATE_SLUGS = [
  "repair-maintenance-request",
  "rent-reduction-request",
  "security-deposit-demand",
  "lease-negotiation",
  "harassment-complaint",
  "heat-hot-water-complaint",
  "pest-complaint",
  "illegal-eviction-response",
];

const TENANT_RIGHTS_TOPICS: Partial<Record<City, string[]>> = {
  nyc: ["rent-stabilization-rights", "repairs-and-maintenance", "eviction-protections", "security-deposits", "lease-renewals", "harassment", "heat-and-hot-water", "bed-bugs-and-pests", "illegal-apartments", "retaliation"],
  "los-angeles": ["rso-rent-stabilization", "just-cause-eviction", "repairs-and-habitability", "relocation-assistance", "ellis-act", "security-deposits", "earthquake-retrofit", "harassment-and-retaliation"],
  chicago: ["rlto-protections", "repairs-and-maintenance", "just-cause-eviction", "security-deposits", "lease-renewals", "harassment", "heat-requirements", "lead-paint", "bed-bugs-and-pests", "retaliation"],
};

const CHIP_SLUGS = ["top-rated", "rent-stabilized", "most-reviewed", "no-violations", "large-buildings"];

const CHIP_CITY_GATES: Record<string, City[]> = {
  "rent-stabilized": ["nyc", "los-angeles"],
};

const CALCULATOR_PATHS = ["/rent-affordability-calculator", "/rent-timing-calculator"];

// ─── URL helpers ───────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

function regionSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function cityPath(path: string, city: City = "nyc"): string {
  return `/${CITY_META[city].urlPrefix}${path}`;
}

function buildingUrl(b: { borough: string; slug: string }, city: City = "nyc"): string {
  return `/${CITY_META[city].urlPrefix}/building/${regionSlug(b.borough)}/${b.slug}`;
}

function landlordUrl(slug: string, city: City = "nyc"): string {
  return `/${CITY_META[city].urlPrefix}/landlord/${slug}`;
}

function neighborhoodPageSlug(zip: string, city: City): string {
  const map = ZIP_MAPS[city];
  const name = map ? map[zip] : null;
  if (!name) return zip;
  return `${slugify(name)}-${zip}`;
}

function neighborhoodUrl(zip: string, city: City = "nyc"): string {
  return `/${CITY_META[city].urlPrefix}/neighborhood/${neighborhoodPageSlug(zip, city)}`;
}

function metroToCity(metro: string | null | undefined): City {
  if (metro === "los-angeles") return "los-angeles";
  if (metro === "chicago") return "chicago";
  if (metro === "miami") return "miami";
  if (metro === "houston") return "houston";
  return "nyc";
}

// ─── Supabase fetch (matches script retry behavior) ─────────────

async function supabaseFetch<T = unknown>(path: string): Promise<T> {
  const { url, key } = requireEnv();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        headers: { apikey: key },
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt < 4) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Supabase ${res.status}: ${path}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      const e = err as { message?: string; cause?: { code?: string } };
      if (
        attempt < 4 &&
        (e.message?.includes("500") || e.cause?.code === "UND_ERR_SOCKET")
      ) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

// ─── XML builders (must stay byte-identical with the script) ────

interface UrlEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSitemapXml(entries: UrlEntry[]): string {
  const urls = entries
    .map((e) => {
      let xml = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
      if (e.lastmod) xml += `\n    <lastmod>${e.lastmod}</lastmod>`;
      if (e.changefreq) xml += `\n    <changefreq>${e.changefreq}</changefreq>`;
      if (e.priority !== undefined) xml += `\n    <priority>${e.priority}</priority>`;
      return xml + "\n  </url>";
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

interface IndexEntry {
  name: string;
  lastmod: string;
}

export function buildSitemapIndex(files: IndexEntry[]): string {
  const entries = files
    .map(
      (f) =>
        `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${f.name}</loc>\n    <lastmod>${f.lastmod}</lastmod>\n  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

// ─── Static (0.xml) ────────────────────────────────────────────

interface ZipBuildingRow {
  zip_code: string | null;
  metro: string | null;
  updated_at?: string | null;
}

async function buildZipLastModMap(): Promise<Map<string, string>> {
  const zipData = await supabaseFetch<ZipBuildingRow[]>(
    "buildings?select=zip_code,metro,updated_at&zip_code=not.is.null&limit=10000",
  );
  const now = new Date().toISOString();
  const map = new Map<string, string>();
  for (const b of zipData) {
    if (!b.zip_code) continue;
    const city = metroToCity(b.metro);
    const key = `${city}:${b.zip_code}`;
    const d = b.updated_at || now;
    const existing = map.get(key);
    if (!existing || d > existing) map.set(key, d);
  }
  return map;
}

export async function generateStaticSitemap(): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [];
  const now = new Date().toISOString();

  entries.push({ url: BASE_URL, lastmod: now, changefreq: "daily", priority: 1.0 });

  for (const p of [
    { path: "/about", freq: "monthly", priority: 0.5 },
    { path: "/contact", freq: "monthly", priority: 0.5 },
    { path: "/privacy", freq: "monthly", priority: 0.3 },
    { path: "/terms", freq: "monthly", priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly", priority: 0.7 },
    { path: "/guides/la-tenant-rights", freq: "monthly", priority: 0.7 },
  ]) {
    entries.push({ url: `${BASE_URL}${p.path}`, lastmod: now, changefreq: p.freq, priority: p.priority });
  }

  const staticPages = ["/buildings", "/landlords", "/worst-rated-buildings", "/feed", "/crime", "/rent-stabilization", "/map", "/search", "/news", "/rent-data", "/scaffolding", "/permits", "/energy", "/transit", "/tenant-rights"];
  for (const city of VALID_CITIES) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}${cityPath(page, city)}`,
        lastmod: now,
        changefreq: page === "/news" ? "daily" : "weekly",
        priority: 0.8,
      });
    }
  }

  for (const city of VALID_CITIES) {
    for (const cat of NEWS_CATEGORIES) {
      entries.push({ url: `${BASE_URL}${cityPath(`/news/${cat}`, city)}`, changefreq: "daily", priority: 0.7 });
    }
  }

  for (const slug of SUBWAY_LINE_SLUGS) {
    entries.push({ url: `${BASE_URL}/nyc/apartments-near/${slug}`, changefreq: "weekly", priority: 0.7 });
  }

  for (const city of VALID_CITIES) {
    for (const region of CITY_META[city].regions) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/buildings/${regionSlug(region)}`, city)}`,
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  }

  // Neighborhoods + crime by zip
  const zipMap = await buildZipLastModMap();
  for (const [key, lastmod] of zipMap) {
    const [cityStr, zip] = key.split(":");
    const city = cityStr as City;
    entries.push({ url: `${BASE_URL}${neighborhoodUrl(zip, city)}`, lastmod, changefreq: "weekly", priority: 0.7 });
    entries.push({ url: `${BASE_URL}${cityPath(`/crime/${zip}`, city)}`, lastmod, changefreq: "weekly", priority: 0.6 });
  }

  // News articles (non-fatal)
  try {
    interface NewsRow {
      slug: string;
      published_at: string;
    }
    const articles = await supabaseFetch<NewsRow[]>(
      "news_articles?select=slug,published_at&order=published_at.desc&limit=1000",
    );
    for (const a of articles) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/news/${a.slug}`)}`,
        lastmod: new Date(a.published_at).toISOString(),
        changefreq: "monthly",
        priority: 0.5,
      });
    }
  } catch (e) {
    console.warn(`  Skipping news articles in sitemap: ${(e as Error).message}`);
  }

  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
  }

  return entries;
}

// ─── Hubs (hubs.xml) ───────────────────────────────────────────

export async function generateHubsSitemap(): Promise<UrlEntry[]> {
  const entries: UrlEntry[] = [];
  const now = new Date().toISOString();

  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/tenant-tools", city)}`, lastmod: now, changefreq: "monthly", priority: 0.5 });
  }

  for (const city of VALID_CITIES) {
    for (const slug of TEMPLATE_SLUGS) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/tenant-tools/templates/${slug}`, city)}`,
        lastmod: now,
        changefreq: "monthly",
        priority: 0.4,
      });
    }
  }

  for (const city of VALID_CITIES) {
    const topics = TENANT_RIGHTS_TOPICS[city] || [];
    for (const slug of topics) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/tenant-rights/${slug}`, city)}`,
        lastmod: now,
        changefreq: "monthly",
        priority: 0.5,
      });
    }
  }

  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhoods", city)}`, lastmod: now, changefreq: "weekly", priority: 0.6 });
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhoods/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
    entries.push({ url: `${BASE_URL}${cityPath("/neighborhood/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
  }

  try {
    const zipMap = await buildZipLastModMap();
    for (const [key, lastmod] of zipMap) {
      const [cityStr, zip] = key.split(":");
      const city = cityStr as City;
      const slug = neighborhoodPageSlug(zip, city);
      entries.push({
        url: `${BASE_URL}${cityPath(`/rents/${slug}`, city)}`,
        lastmod,
        changefreq: "weekly",
        priority: 0.5,
      });
    }
  } catch (e) {
    console.warn(`  Skipping rents-by-neighborhood in hubs sitemap: ${(e as Error).message}`);
  }

  entries.push({ url: `${BASE_URL}${cityPath("/ellis-act", "los-angeles")}`, lastmod: now, changefreq: "weekly", priority: 0.5 });

  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/building-list", city)}`, lastmod: now, changefreq: "weekly", priority: 0.5 });
    for (const slug of CHIP_SLUGS) {
      const gate = CHIP_CITY_GATES[slug];
      if (gate && !gate.includes(city)) continue;
      entries.push({
        url: `${BASE_URL}${cityPath(`/building-list/${slug}`, city)}`,
        lastmod: now,
        changefreq: "weekly",
        priority: 0.4,
      });
    }
  }

  for (const path of CALCULATOR_PATHS) {
    entries.push({ url: `${BASE_URL}${path}`, lastmod: now, changefreq: "monthly", priority: 0.6 });
  }

  return entries;
}

// ─── Landlord chunks (l-N.xml) ─────────────────────────────────

interface LandlordRow {
  id: string;
  name: string;
  slug: string | null;
  metro: string | null;
  updated_at: string | null;
}

export async function* generateLandlordChunks(): AsyncGenerator<string> {
  const URLS_PER_FILE = 10000;
  let pending: UrlEntry[] = [];
  let cursor = "00000000-0000-0000-0000-000000000000";

  while (true) {
    const rows = await supabaseFetch<LandlordRow[]>(
      `landlord_stats?select=id,name,slug,metro,updated_at&building_count=gt.0&id=gt.${cursor}&order=id.asc&limit=1000`,
    );
    if (!rows || rows.length === 0) break;

    for (const l of rows) {
      if (l.slug && l.metro) {
        const city = metroToCity(l.metro);
        pending.push({
          url: `${BASE_URL}${landlordUrl(l.slug, city)}`,
          lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
          changefreq: "monthly",
          priority: 0.5,
        });
      }
      if (pending.length >= URLS_PER_FILE) {
        yield buildSitemapXml(pending);
        pending = [];
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < 1000) break;
  }
  if (pending.length > 0) {
    yield buildSitemapXml(pending);
  }
}

// ─── Building chunks (b-N.xml) ─────────────────────────────────

interface BuildingRow {
  id: string;
  slug: string | null;
  borough: string | null;
  metro: string | null;
  updated_at: string | null;
}

export async function* generateBuildingChunks(): AsyncGenerator<string> {
  const PAGE_SIZE = 1000;
  const URLS_PER_FILE = 10000;
  let pending: UrlEntry[] = [];
  let cursor = "00000000-0000-0000-0000-000000000000";
  let done = false;

  while (!done) {
    const rows = await supabaseFetch<BuildingRow[]>(
      `buildings?select=id,slug,borough,metro,updated_at&id=gt.${cursor}&order=id.asc&limit=${PAGE_SIZE}`,
    );
    if (!rows || rows.length === 0) {
      done = true;
      break;
    }
    for (const b of rows) {
      if (b.slug && b.borough) {
        pending.push({
          url: `${BASE_URL}${buildingUrl({ slug: b.slug, borough: b.borough }, metroToCity(b.metro))}`,
          lastmod: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
          changefreq: "weekly",
          priority: 0.6,
        });
      }
      if (pending.length >= URLS_PER_FILE) {
        yield buildSitemapXml(pending);
        pending = [];
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < PAGE_SIZE) done = true;
  }
  if (pending.length > 0) {
    yield buildSitemapXml(pending);
  }
}

// ─── Single-chunk generator (for verify script) ────────────────

/**
 * Regenerate a single chunk by filename ("0.xml", "hubs.xml", "b-0.xml", etc).
 * Used by scripts/verify-sitemap-parity.mjs to diff individual chunks
 * against public/sitemap/*.xml without re-paginating the entire dataset.
 */
export async function generateChunk(name: string): Promise<string> {
  if (name === "0.xml") {
    return buildSitemapXml(await generateStaticSitemap());
  }
  if (name === "hubs.xml") {
    return buildSitemapXml(await generateHubsSitemap());
  }
  const b = name.match(/^b-(\d+)\.xml$/);
  if (b) {
    const idx = Number(b[1]);
    let i = 0;
    for await (const chunk of generateBuildingChunks()) {
      if (i === idx) return chunk;
      i++;
    }
    throw new Error(`Chunk ${name} out of range (have ${i})`);
  }
  const l = name.match(/^l-(\d+)\.xml$/);
  if (l) {
    const idx = Number(l[1]);
    let i = 0;
    for await (const chunk of generateLandlordChunks()) {
      if (i === idx) return chunk;
      i++;
    }
    throw new Error(`Chunk ${name} out of range (have ${i})`);
  }
  throw new Error(`Unknown chunk: ${name}`);
}

// ─── Full regeneration → Blob ──────────────────────────────────

export const BLOB_PREFIX = "sitemap";
const CACHE_MAX_AGE_SECONDS = 86400; // 1 day — matches the route handler header

async function writeChunkToBlob(name: string, xml: string): Promise<string> {
  const result = await put(`${BLOB_PREFIX}/${name}`, xml, {
    access: "public",
    contentType: "application/xml",
    cacheControlMaxAge: CACHE_MAX_AGE_SECONDS,
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  return result.url;
}

export interface RegenerateResult {
  ok: boolean;
  chunks: number;
  staticUrls: number;
  hubsUrls: number;
  landlordChunks: number;
  buildingChunks: number;
  durationMs: number;
  errors: string[];
}

export async function regenerateAllToBlob(): Promise<RegenerateResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  const now = new Date().toISOString();
  const written: string[] = [];

  let staticUrls = 0;
  let hubsUrls = 0;
  let landlordChunkCount = 0;
  let buildingChunkCount = 0;

  // Rewrite index.xml referencing whatever's in `written` so far. Called at
  // phase boundaries and every 10 chunks during streaming, so that even if
  // the function is killed by maxDuration we never lose the index entirely —
  // it always reflects the most recent successful checkpoint.
  async function checkpointIndex(): Promise<void> {
    try {
      const indexEntries: IndexEntry[] = written.map((name) => ({ name, lastmod: now }));
      indexEntries.sort((a, b) => order(a.name).localeCompare(order(b.name)));
      await writeChunkToBlob("index.xml", buildSitemapIndex(indexEntries));
    } catch (e) {
      // Swallow — checkpoint failures shouldn't kill the cron. The final
      // write at the end of this function will retry with the full set.
      console.warn(`[regenerate-sitemaps] checkpoint index failed: ${(e as Error).message}`);
    }
  }

  // 0.xml
  try {
    const staticEntries = await generateStaticSitemap();
    staticUrls = staticEntries.length;
    await writeChunkToBlob("0.xml", buildSitemapXml(staticEntries));
    written.push("0.xml");
  } catch (e) {
    errors.push(`0.xml: ${(e as Error).message}`);
  }

  // hubs.xml
  try {
    const hubsEntries = await generateHubsSitemap();
    hubsUrls = hubsEntries.length;
    await writeChunkToBlob("hubs.xml", buildSitemapXml(hubsEntries));
    written.push("hubs.xml");
  } catch (e) {
    errors.push(`hubs.xml: ${(e as Error).message}`);
  }
  await checkpointIndex();

  // Landlord chunks — stream each chunk straight to Blob as it's generated.
  // Bounded memory (one chunk at a time) + partial-recovery: if the function
  // dies mid-stream, every l-N.xml written before the failure stays in
  // `written` and the most recent checkpoint index.xml references it.
  try {
    let i = 0;
    for await (const chunk of generateLandlordChunks()) {
      const name = `l-${i}.xml`;
      await writeChunkToBlob(name, chunk);
      written.push(name);
      console.log(`[regenerate-sitemaps] wrote ${name} (${chunk.length} bytes)`);
      i++;
      if (i % 10 === 0) await checkpointIndex();
    }
    landlordChunkCount = i;
  } catch (e) {
    errors.push(`landlord chunks: ${(e as Error).message}`);
  }
  await checkpointIndex();

  // Building chunks — same streaming pattern. This is the phase that the
  // accumulate-then-write implementation timed out in: ~60 chunks of ~3MB
  // each held in memory while ~600 sequential paginations ran. Even with
  // streaming the buildings phase can exceed maxDuration on the cron tier,
  // so we re-checkpoint index every 10 chunks to ensure a usable index.xml
  // always exists after a partial run.
  try {
    let i = 0;
    for await (const chunk of generateBuildingChunks()) {
      const name = `b-${i}.xml`;
      await writeChunkToBlob(name, chunk);
      written.push(name);
      console.log(`[regenerate-sitemaps] wrote ${name} (${chunk.length} bytes)`);
      i++;
      if (i % 10 === 0) await checkpointIndex();
    }
    buildingChunkCount = i;
  } catch (e) {
    errors.push(`building chunks: ${(e as Error).message}`);
  }

  // Final index write — covers any partial chunks since the last checkpoint
  // boundary and ensures the index is consistent with the full `written` set.
  try {
    const indexEntries: IndexEntry[] = written.map((name) => ({ name, lastmod: now }));
    indexEntries.sort((a, b) => order(a.name).localeCompare(order(b.name)));
    await writeChunkToBlob("index.xml", buildSitemapIndex(indexEntries));
  } catch (e) {
    errors.push(`index.xml: ${(e as Error).message}`);
  }

  return {
    ok: errors.length === 0,
    chunks: written.length + 1, // + index.xml
    staticUrls,
    hubsUrls,
    landlordChunks: landlordChunkCount,
    buildingChunks: buildingChunkCount,
    durationMs: Date.now() - t0,
    errors,
  };
}

function order(n: string): string {
  if (n.startsWith("b-")) return `0-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (n.startsWith("l-")) return `1-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (n === "0.xml") return "2-0";
  if (n === "hubs.xml") return "3-0";
  return n;
}

// ─── Chunk name validation (for route handler) ─────────────────

export function isValidChunkName(name: string): boolean {
  if (name === "index.xml" || name === "0.xml" || name === "hubs.xml") return true;
  if (/^b-\d+\.xml$/.test(name)) return true;
  if (/^l-\d+\.xml$/.test(name)) return true;
  return false;
}
