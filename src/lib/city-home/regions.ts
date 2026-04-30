import type { City } from "@/lib/cities";

export interface Region {
  name: string;
  meta: string;
  count: string; // e.g. "89K BUILDINGS"
  /**
   * URL slug. MUST match slugify(actualRegionName) where actualRegionName is a
   * value found in the city's *_ZIP_REGIONS map — otherwise clicking the card
   * filters to nothing on /[city]/neighborhoods.
   */
  slug: string;
  /** Image URL. Falls back to loremflickr for variety. */
  bg: string;
  featured?: boolean;
}

export const REGIONS_BY_CITY: Record<City, Region[]> = {
  nyc: [
    { featured: true, name: "Brooklyn",      meta: "Williamsburg · Park Slope · DUMBO",   count: "89K BUILDINGS", slug: "brooklyn",      bg: "https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?w=1200&q=80" },
    {                 name: "Manhattan",     meta: "Midtown · Upper East · SoHo",         count: "42K BLDGS",     slug: "manhattan",     bg: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=900&q=80" },
    {                 name: "Queens",        meta: "Astoria · LIC · Flushing",            count: "67K BLDGS",     slug: "queens",        bg: "https://loremflickr.com/900/600/queens,newyork,street/all" },
    {                 name: "Bronx",         meta: "Riverdale · Fordham · Mott Haven",    count: "58K BLDGS",     slug: "bronx",         bg: "https://loremflickr.com/900/600/bronx,newyork/all" },
    {                 name: "Staten Island", meta: "St. George · New Dorp · Tottenville", count: "21K BLDGS",     slug: "staten-island", bg: "https://loremflickr.com/900/600/statenisland,ferry,newyork/all" },
  ],
  "los-angeles": [
    { featured: true, name: "Westside",             meta: "Venice · Santa Monica · Brentwood",      count: "140K BUILDINGS", slug: "westside",             bg: "https://loremflickr.com/1200/800/venice,losangeles/all" },
    {                 name: "Central LA",           meta: "Hollywood · Koreatown · Mid-Wilshire",   count: "110K BLDGS",     slug: "central-la",           bg: "https://loremflickr.com/900/600/hollywood,losangeles/all" },
    {                 name: "Downtown",             meta: "Arts District · Financial District",     count: "85K BLDGS",      slug: "downtown",             bg: "https://loremflickr.com/900/600/downtown,losangeles/all" },
    {                 name: "South Bay",            meta: "Long Beach · Torrance · Carson",         count: "165K BLDGS",     slug: "south-bay",            bg: "https://loremflickr.com/900/600/longbeach,losangeles/all" },
    {                 name: "San Fernando Valley",  meta: "Studio City · Sherman Oaks · Encino",    count: "280K BLDGS",     slug: "san-fernando-valley",  bg: "https://loremflickr.com/900/600/sanfernandovalley,losangeles/all" },
  ],
  chicago: [
    { featured: true, name: "North Side",     meta: "Lincoln Park · Lakeview · Lincoln Square", count: "185K BUILDINGS", slug: "north-side",     bg: "https://loremflickr.com/1200/800/lincolnpark,chicago/all" },
    {                 name: "Central",        meta: "Loop · River North · Streeterville",       count: "52K BLDGS",      slug: "central",        bg: "https://loremflickr.com/900/600/loop,chicago,downtown/all" },
    {                 name: "West Side",      meta: "Wicker Park · Logan Square · Humboldt",    count: "98K BLDGS",      slug: "west-side",      bg: "https://loremflickr.com/900/600/wickerpark,chicago/all" },
    {                 name: "South Side",     meta: "Hyde Park · Bronzeville · Chatham",        count: "135K BLDGS",     slug: "south-side",     bg: "https://loremflickr.com/900/600/hydepark,chicago/all" },
    {                 name: "Far North Side", meta: "Rogers Park · Edgewater · Uptown",         count: "50K BLDGS",      slug: "far-north-side", bg: "https://loremflickr.com/900/600/edgewater,chicago,lake/all" },
  ],
  miami: [
    { featured: true, name: "Central Miami",     meta: "Brickell · Wynwood · Downtown",       count: "45K BUILDINGS", slug: "central-miami",     bg: "https://loremflickr.com/1200/800/brickell,miami,downtown/all" },
    {                 name: "Miami Beach",       meta: "South Beach · Mid-Beach · Surfside",  count: "38K BLDGS",     slug: "miami-beach",       bg: "https://loremflickr.com/900/600/southbeach,miami,artdeco/all" },
    {                 name: "South Miami",       meta: "Coral Gables · Coconut Grove",         count: "44K BLDGS",     slug: "south-miami",       bg: "https://loremflickr.com/900/600/coralgables,miami/all" },
    {                 name: "North Miami-Dade",  meta: "Aventura · Sunny Isles · N. Miami",    count: "28K BLDGS",     slug: "north-miami-dade",  bg: "https://loremflickr.com/900/600/aventura,miami/all" },
    {                 name: "West Miami-Dade",   meta: "Doral · Sweetwater · Fontainebleau",   count: "22K BLDGS",     slug: "west-miami-dade",   bg: "https://loremflickr.com/900/600/doral,miami/all" },
  ],
  houston: [
    { featured: true, name: "Inner Loop",         meta: "Heights · Montrose · Museum District", count: "65K BUILDINGS", slug: "inner-loop",         bg: "https://loremflickr.com/1200/800/heights,houston/all" },
    {                 name: "West Houston",       meta: "Galleria · Memorial · Energy Corridor", count: "55K BLDGS",     slug: "west-houston",       bg: "https://loremflickr.com/900/600/galleria,houston/all" },
    {                 name: "Southwest Houston",  meta: "Bellaire · Meyerland · Sugar Land",    count: "42K BLDGS",     slug: "southwest-houston",  bg: "https://loremflickr.com/900/600/bellaire,houston/all" },
    {                 name: "Northwest Houston",  meta: "Spring · The Woodlands · Cypress",     count: "38K BLDGS",     slug: "northwest-houston",  bg: "https://loremflickr.com/900/600/woodlands,houston/all" },
    {                 name: "Southeast Houston",  meta: "Pasadena · Deer Park · Park Place",    count: "28K BLDGS",     slug: "southeast-houston",  bg: "https://loremflickr.com/900/600/pasadena,houston/all" },
  ],
};
