import type { City } from "@/lib/cities";

export interface Region {
  name: string;
  meta: string;
  count: string;
  slug: string;
  bg: string;
  featured?: boolean;
}

// Photo curation: every URL is a verified Unsplash residential / architecture
// shot — buildings, streets, condos, brownstones — never abstract scenes.
// Photo IDs were batch-tested against images.unsplash.com.
const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format`;

export const REGIONS_BY_CITY: Record<City, Region[]> = {
  nyc: [
    { featured: true, name: "Brooklyn",      meta: "Williamsburg · Park Slope · DUMBO · +55 nbhds", count: "89K BUILDINGS", slug: "brooklyn",      bg: u("1499092346589-b9b6be3e94b2") },
    {                 name: "Manhattan",     meta: "28 nbhds",                                       count: "42K BLDGS",     slug: "manhattan",     bg: u("1496442226666-8d4d0e62e6e9") },
    {                 name: "Queens",        meta: "80 nbhds",                                       count: "67K BLDGS",     slug: "queens",        bg: u("1480714378408-67cf0d13bc1b") },
    {                 name: "Bronx",         meta: "52 nbhds",                                       count: "58K BLDGS",     slug: "bronx",         bg: u("1469041797191-50ace28483c3") },
    {                 name: "Staten Island", meta: "29 nbhds",                                       count: "21K BLDGS",     slug: "staten-island", bg: u("1568605114967-8130f3a36994") },
  ],
  "los-angeles": [
    { featured: true, name: "Westside",            meta: "Venice · Santa Monica · West Hollywood · +12 nbhds", count: "140K BUILDINGS", slug: "westside",            bg: u("1531297484001-80022131f5a1") },
    {                 name: "Hollywood",           meta: "22 nbhds",                                  count: "110K BLDGS", slug: "hollywood",            bg: u("1486325212027-8081e485255e") },
    {                 name: "Downtown LA",         meta: "18 nbhds",                                  count: "85K BLDGS",  slug: "downtown-la",          bg: u("1494522855154-9297ac14b55f") },
    {                 name: "Eastside",            meta: "Silver Lake · Echo Park · +14",             count: "165K BLDGS", slug: "eastside",             bg: u("1545324418-cc1a3fa10c00") },
    {                 name: "San Fernando Valley", meta: "Studio City · Sherman Oaks · +35 nbhds",    count: "280K BLDGS", slug: "san-fernando-valley",  bg: u("1494526585095-c41746248156") },
  ],
  chicago: [
    { featured: true, name: "North Side",  meta: "Lincoln Park · Lakeview · Wicker Park · +18 nbhds", count: "185K BUILDINGS", slug: "north-side", bg: u("1505691938895-1758d7feb511") },
    {                 name: "The Loop",    meta: "8 nbhds",                                            count: "52K BLDGS",  slug: "loop",       bg: u("1494522358652-f30e61a60313") },
    {                 name: "West Side",   meta: "Fulton Market · West Loop · +12",                    count: "98K BLDGS",  slug: "west-side",  bg: u("1502672023488-70e25813eb80") },
    {                 name: "South Side",  meta: "Hyde Park · +22 nbhds",                              count: "135K BLDGS", slug: "south-side", bg: u("1571055107559-3e67626fa8be") },
    {                 name: "Lakefront",   meta: "Streeterville · Gold Coast · +8",                    count: "50K BLDGS",  slug: "lakefront",  bg: u("1518391846015-55a9cc003b25") },
  ],
  miami: [
    { featured: true, name: "South Beach",   meta: "Art Deco · Collins · Ocean Drive · +6 nbhds", count: "45K BUILDINGS", slug: "south-beach",   bg: u("1486406146926-c627a92ad1ab") },
    {                 name: "Brickell",      meta: "Financial district",                          count: "38K BLDGS",     slug: "brickell",      bg: u("1454942901704-3c44c11b2ad1") },
    {                 name: "Wynwood",       meta: "Arts district · +4",                          count: "22K BLDGS",     slug: "wynwood",       bg: u("1554072675-66db59dba46f") },
    {                 name: "Coral Gables",  meta: "Mediterranean · +5",                          count: "44K BLDGS",     slug: "coral-gables",  bg: u("1493809842364-78817add7ffb") },
    {                 name: "Coconut Grove", meta: "Bayside · +3 nbhds",                          count: "28K BLDGS",     slug: "coconut-grove", bg: u("1559329007-40df8a9345d8") },
  ],
  houston: [
    { featured: true, name: "The Heights",     meta: "Historic · Washington Ave · +8 nbhds", count: "65K BUILDINGS", slug: "heights",         bg: u("1518780664697-55e3ad937233") },
    {                 name: "Downtown",        meta: "Theatre District · +4",                count: "28K BLDGS",     slug: "downtown",        bg: u("1567696911980-2eed69a46042") },
    {                 name: "Museum District", meta: "Medical Center adj.",                   count: "42K BLDGS",     slug: "museum-district", bg: u("1572119003128-d110c07af847") },
    {                 name: "Montrose",        meta: "Arts · LGBTQ · +2",                     count: "38K BLDGS",     slug: "montrose",        bg: u("1519302959554-a75be0afc82a") },
    {                 name: "Uptown",          meta: "Galleria · River Oaks · +3",            count: "55K BLDGS",     slug: "uptown",          bg: u("1485871981521-5b1fd3805eee") },
  ],
};
