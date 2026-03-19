export interface SubwayLine {
  letter: string;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  group: string;
}

export const SUBWAY_LINES: SubwayLine[] = [
  // 1/2/3 (Red)
  { letter: "1", name: "1 Train", slug: "1-train", color: "#EE352E", textColor: "white", group: "1/2/3" },
  { letter: "2", name: "2 Train", slug: "2-train", color: "#EE352E", textColor: "white", group: "1/2/3" },
  { letter: "3", name: "3 Train", slug: "3-train", color: "#EE352E", textColor: "white", group: "1/2/3" },
  // 4/5/6 (Green)
  { letter: "4", name: "4 Train", slug: "4-train", color: "#00933C", textColor: "white", group: "4/5/6" },
  { letter: "5", name: "5 Train", slug: "5-train", color: "#00933C", textColor: "white", group: "4/5/6" },
  { letter: "6", name: "6 Train", slug: "6-train", color: "#00933C", textColor: "white", group: "4/5/6" },
  // 7 (Purple)
  { letter: "7", name: "7 Train", slug: "7-train", color: "#B933AD", textColor: "white", group: "7" },
  // A/C/E (Blue)
  { letter: "A", name: "A Train", slug: "a-train", color: "#2850AD", textColor: "white", group: "A/C/E" },
  { letter: "C", name: "C Train", slug: "c-train", color: "#2850AD", textColor: "white", group: "A/C/E" },
  { letter: "E", name: "E Train", slug: "e-train", color: "#2850AD", textColor: "white", group: "A/C/E" },
  // B/D/F/M (Orange)
  { letter: "B", name: "B Train", slug: "b-train", color: "#FF6319", textColor: "white", group: "B/D/F/M" },
  { letter: "D", name: "D Train", slug: "d-train", color: "#FF6319", textColor: "white", group: "B/D/F/M" },
  { letter: "F", name: "F Train", slug: "f-train", color: "#FF6319", textColor: "white", group: "B/D/F/M" },
  { letter: "M", name: "M Train", slug: "m-train", color: "#FF6319", textColor: "white", group: "B/D/F/M" },
  // G (Light Green)
  { letter: "G", name: "G Train", slug: "g-train", color: "#6CBE45", textColor: "white", group: "G" },
  // J/Z (Brown)
  { letter: "J", name: "J Train", slug: "j-train", color: "#996633", textColor: "white", group: "J/Z" },
  { letter: "Z", name: "Z Train", slug: "z-train", color: "#996633", textColor: "white", group: "J/Z" },
  // L (Gray)
  { letter: "L", name: "L Train", slug: "l-train", color: "#A7A9AC", textColor: "white", group: "L" },
  // N/Q/R/W (Yellow)
  { letter: "N", name: "N Train", slug: "n-train", color: "#FCCC0A", textColor: "black", group: "N/Q/R/W" },
  { letter: "Q", name: "Q Train", slug: "q-train", color: "#FCCC0A", textColor: "black", group: "N/Q/R/W" },
  { letter: "R", name: "R Train", slug: "r-train", color: "#FCCC0A", textColor: "black", group: "N/Q/R/W" },
  { letter: "W", name: "W Train", slug: "w-train", color: "#FCCC0A", textColor: "black", group: "N/Q/R/W" },
  // S (Shuttle)
  { letter: "S", name: "S Shuttle", slug: "s-shuttle", color: "#808183", textColor: "white", group: "Shuttles" },
];

export function getLineBySlug(slug: string): SubwayLine | undefined {
  return SUBWAY_LINES.find((l) => l.slug === slug);
}

export function getLineByLetter(letter: string): SubwayLine | undefined {
  return SUBWAY_LINES.find((l) => l.letter === letter);
}

export function transitLineUrl(slug: string, city: string = "nyc"): string {
  return `/${city}/apartments-near/${slug}`;
}

export function busRouteSlug(routeName: string): string {
  return `${routeName.toLowerCase()}-bus`;
}

export function busRouteFromSlug(slug: string | undefined): string | null {
  if (!slug || !slug.endsWith("-bus")) return null;
  const name = slug.slice(0, -4);
  let route = name.toUpperCase();
  // Fix Bronx mixed-case prefix: BX → Bx
  if (route.startsWith("BX") && route.length > 2) {
    route = "Bx" + route.slice(2);
  }
  return route;
}
