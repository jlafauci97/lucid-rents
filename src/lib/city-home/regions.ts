import type { City } from "@/lib/cities";

export interface Region {
  name: string;
  meta: string;
  count: string; // e.g. "89K BUILDINGS"
  slug: string;
  /** Image URL. Falls back to loremflickr for variety. */
  bg: string;
  featured?: boolean;
  /** Zip codes that fall in this region tile. If set, used to filter the neighborhoods page. */
  zips?: string[];
  /** Region values (matched against neighborhood.region) included in this tile. */
  regionMatch?: string[];
}

export const REGIONS_BY_CITY: Record<City, Region[]> = {
  nyc: [
    { featured: true, name: "Brooklyn",      meta: "Williamsburg · Park Slope · DUMBO · +55 nbhds", count: "89K BUILDINGS", slug: "brooklyn",      bg: "https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?w=1200&q=80", regionMatch: ["Brooklyn"] },
    {                 name: "Manhattan",     meta: "28 nbhds",                                       count: "42K BLDGS",     slug: "manhattan",     bg: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=900&q=80", regionMatch: ["Manhattan"] },
    {                 name: "Queens",        meta: "80 nbhds",                                       count: "67K BLDGS",     slug: "queens",        bg: "https://loremflickr.com/900/600/queens,newyork,street/all", regionMatch: ["Queens"] },
    {                 name: "Bronx",         meta: "52 nbhds",                                       count: "58K BLDGS",     slug: "bronx",         bg: "https://loremflickr.com/900/600/bronx,newyork/all", regionMatch: ["Bronx"] },
    {                 name: "Staten Island", meta: "29 nbhds",                                       count: "21K BLDGS",     slug: "staten-island", bg: "https://loremflickr.com/900/600/statenisland,ferry,newyork/all", regionMatch: ["Staten Island"] },
  ],
  "los-angeles": [
    {
      featured: true, name: "Westside",
      meta: "Venice · Santa Monica · West Hollywood · +12 nbhds",
      count: "140K BUILDINGS", slug: "westside",
      bg: "https://loremflickr.com/1200/800/venice,losangeles/all",
      zips: ["90024","90025","90034","90035","90049","90064","90066","90067","90077","90094","90230","90232","90272","90291","90292","90293","90401","90402","90403","90404","90405"],
    },
    {
      name: "Hollywood",
      meta: "Hollywood · East Hollywood",
      count: "110K BLDGS", slug: "hollywood",
      bg: "https://loremflickr.com/900/600/hollywood,losangeles/all",
      zips: ["90028","90029","90038"],
    },
    {
      name: "Downtown LA",
      meta: "Downtown · Westlake · Mid-Wilshire",
      count: "85K BLDGS", slug: "downtown-la",
      bg: "https://loremflickr.com/900/600/downtown,losangeles/all",
      zips: ["90010","90012","90013","90014","90015","90017","90020","90021","90036","90057","90071"],
    },
    {
      name: "Eastside",
      meta: "Silver Lake · Echo Park · Highland Park · +6",
      count: "165K BLDGS", slug: "eastside",
      bg: "https://loremflickr.com/900/600/silverlake,losangeles/all",
      zips: ["90004","90026","90027","90031","90032","90033","90039","90041","90042","90063","90065"],
    },
    {
      name: "San Fernando Valley",
      meta: "Studio City · Sherman Oaks · +35 nbhds",
      count: "280K BLDGS", slug: "san-fernando-valley",
      bg: "https://loremflickr.com/900/600/sanfernandovalley,losangeles/all",
      regionMatch: ["San Fernando Valley"],
    },
  ],
  chicago: [
    { featured: true, name: "North Side", meta: "Lincoln Park · Lakeview · Wicker Park · +18 nbhds", count: "185K BUILDINGS", slug: "north-side", bg: "https://loremflickr.com/1200/800/lincolnpark,chicago/all" },
    {                 name: "The Loop",   meta: "8 nbhds", count: "52K BLDGS",  slug: "loop",       bg: "https://loremflickr.com/900/600/loop,chicago,downtown/all" },
    {                 name: "West Side",  meta: "Fulton Market · West Loop · +12", count: "98K BLDGS",  slug: "west-side",  bg: "https://loremflickr.com/900/600/westloop,chicago/all" },
    {                 name: "South Side", meta: "Hyde Park · +22 nbhds", count: "135K BLDGS", slug: "south-side", bg: "https://loremflickr.com/900/600/hydepark,chicago/all" },
    {                 name: "Lakefront",  meta: "Streeterville · Gold Coast · +8", count: "50K BLDGS", slug: "lakefront", bg: "https://loremflickr.com/900/600/goldcoast,chicago,lake/all" },
  ],
  miami: [
    { featured: true, name: "South Beach",   meta: "Art Deco · Collins · Ocean Drive · +6 nbhds", count: "45K BUILDINGS", slug: "south-beach",   bg: "https://loremflickr.com/1200/800/southbeach,miami,artdeco/all" },
    {                 name: "Brickell",      meta: "Financial district", count: "38K BLDGS", slug: "brickell",      bg: "https://loremflickr.com/900/600/brickell,miami/all" },
    {                 name: "Wynwood",       meta: "Arts district · +4", count: "22K BLDGS", slug: "wynwood",       bg: "https://loremflickr.com/900/600/wynwood,miami/all" },
    {                 name: "Coral Gables",  meta: "Mediterranean · +5", count: "44K BLDGS", slug: "coral-gables",  bg: "https://loremflickr.com/900/600/coralgables,miami/all" },
    {                 name: "Coconut Grove", meta: "Bayside · +3 nbhds", count: "28K BLDGS", slug: "coconut-grove", bg: "https://loremflickr.com/900/600/coconutgrove,miami/all" },
  ],
  houston: [
    { featured: true, name: "The Heights",     meta: "Historic · Washington Ave · +8 nbhds", count: "65K BUILDINGS", slug: "heights",         bg: "https://loremflickr.com/1200/800/heights,houston/all" },
    {                 name: "Downtown",        meta: "Theatre District · +4", count: "28K BLDGS", slug: "downtown",        bg: "https://loremflickr.com/900/600/downtown,houston/all" },
    {                 name: "Museum District", meta: "Medical Center adj.", count: "42K BLDGS", slug: "museum-district", bg: "https://loremflickr.com/900/600/museumdistrict,houston/all" },
    {                 name: "Montrose",        meta: "Arts · LGBTQ · +2",    count: "38K BLDGS", slug: "montrose",        bg: "https://loremflickr.com/900/600/montrose,houston/all" },
    {                 name: "Uptown",          meta: "Galleria · River Oaks · +3", count: "55K BLDGS", slug: "uptown",    bg: "https://loremflickr.com/900/600/galleria,houston/all" },
  ],
};
