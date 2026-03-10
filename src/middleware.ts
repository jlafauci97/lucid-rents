import { NextResponse, type NextRequest } from "next/server";
import { VALID_CITIES } from "@/lib/cities";
import { neighborhoodPageSlug } from "@/lib/nyc-neighborhoods";

/** Route prefixes that are city-specific and should be under /[city]/ */
const CITY_ROUTES = new Set([
  "buildings",
  "building",
  "landlords",
  "landlord",
  "search",
  "rankings",
  "crime",
  "map",
  "feed",
  "news",
  "energy",
  "permits",
  "scaffolding",
  "rent-data",
  "rent-stabilization",
  "compare",
  "neighborhood",
  "review",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Split path segments: "/nyc/buildings" => ["", "nyc", "buildings"]
  const segments = pathname.split("/");
  const firstSegment = segments[1] || "";

  // 1. Path already starts with a valid city — set header and continue
  if (VALID_CITIES.includes(firstSegment as (typeof VALID_CITIES)[number])) {
    // Redirect old-format neighborhood URLs: /nyc/neighborhood/10001 -> /nyc/neighborhood/chelsea-10001
    if (segments[2] === "neighborhood" && segments[3] && /^\d{5}$/.test(segments[3])) {
      const newSlug = neighborhoodPageSlug(segments[3]);
      if (newSlug !== segments[3]) {
        const url = request.nextUrl.clone();
        url.pathname = `/${firstSegment}/neighborhood/${newSlug}`;
        return NextResponse.redirect(url, 301);
      }
    }
    const response = NextResponse.next();
    response.headers.set("x-city", firstSegment);
    return response;
  }

  // 2. Path starts with a known city route prefix but has no city → 301 redirect to /nyc/...
  if (CITY_ROUTES.has(firstSegment)) {
    const url = request.nextUrl.clone();
    // Single-hop redirect for old neighborhood URLs: /neighborhood/10001 -> /nyc/neighborhood/chelsea-10001
    if (firstSegment === "neighborhood" && segments[2] && /^\d{5}$/.test(segments[2])) {
      url.pathname = `/nyc/neighborhood/${neighborhoodPageSlug(segments[2])}`;
    } else {
      url.pathname = `/nyc${pathname}`;
    }
    return NextResponse.redirect(url, 301);
  }

  // 3. Everything else (homepage, api, auth, dashboard, about, privacy, terms) — pass through
  const response = NextResponse.next();
  response.headers.set("x-city", "nyc");
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
