import { NextResponse, type NextRequest } from "next/server";
import { VALID_CITIES, STATE_CITY_MAP, CITY_META } from "@/lib/cities";
import { neighborhoodPageSlug } from "@/lib/nyc-neighborhoods";
import { neighborhoodPageSlugByCity } from "@/lib/neighborhoods";

/** Route prefixes that are city-specific and should be under /[city]/ */
const CITY_ROUTES = new Set([
  "buildings",
  "building",
  "landlords",
  "landlord",
  "search",
  "worst-rated-buildings",
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
  "transit",
  "apartments-near",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Split path segments: "/nyc/buildings" => ["", "nyc", "buildings"]
  const segments = pathname.split("/");
  const firstSegment = segments[1] || "";

  // 1a. Check for multi-segment city prefix: /CA/Los-Angeles/... → rewrite to /los-angeles/...
  const stateMap = STATE_CITY_MAP[firstSegment.toUpperCase()];
  if (stateMap) {
    const citySlugSegment = segments[2] || "";
    const internalCity = stateMap[citySlugSegment];
    if (internalCity) {
      // Rewrite the URL internally while preserving the external URL
      const remainingPath = segments.slice(3).join("/");
      const internalPath = `/${internalCity}${remainingPath ? `/${remainingPath}` : ""}`;

      // Handle neighborhood slug redirects for LA
      if (segments[3] === "neighborhood" && segments[4] && /^\d{5}$/.test(segments[4])) {
        const newSlug = neighborhoodPageSlugByCity(segments[4], internalCity);
        if (newSlug !== segments[4]) {
          const url = request.nextUrl.clone();
          url.pathname = `/${CITY_META[internalCity].urlPrefix}/neighborhood/${newSlug}`;
          return NextResponse.redirect(url, 301);
        }
      }

      const url = request.nextUrl.clone();
      url.pathname = internalPath;
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-city", internalCity);
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
      return response;
    }
  }

  // 1b. Path already starts with a valid single-segment city (e.g. "nyc")
  if (VALID_CITIES.includes(firstSegment as (typeof VALID_CITIES)[number])) {
    // Redirect old /rankings URL to /worst-rated-buildings
    if (segments[2] === "rankings") {
      const url = request.nextUrl.clone();
      url.pathname = `/${firstSegment}/worst-rated-buildings${segments.slice(3).length ? "/" + segments.slice(3).join("/") : ""}`;
      return NextResponse.redirect(url, 301);
    }
    // Redirect old-format neighborhood URLs: /nyc/neighborhood/10001 -> /nyc/neighborhood/chelsea-10001
    if (segments[2] === "neighborhood" && segments[3] && /^\d{5}$/.test(segments[3])) {
      const newSlug = neighborhoodPageSlug(segments[3]);
      if (newSlug !== segments[3]) {
        const url = request.nextUrl.clone();
        url.pathname = `/${firstSegment}/neighborhood/${newSlug}`;
        return NextResponse.redirect(url, 301);
      }
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-city", firstSegment);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 2. Redirect shorthand city slugs to canonical URLs
  // /la/... → /CA/Los-Angeles/...
  if (firstSegment === "la") {
    const url = request.nextUrl.clone();
    const rest = segments.slice(2).join("/");
    url.pathname = `/CA/Los-Angeles${rest ? `/${rest}` : ""}`;
    return NextResponse.redirect(url, 301);
  }
  // /chi/... → /IL/Chicago/...
  if (firstSegment === "chi") {
    const url = request.nextUrl.clone();
    const rest = segments.slice(2).join("/");
    url.pathname = `/IL/Chicago${rest ? `/${rest}` : ""}`;
    return NextResponse.redirect(url, 301);
  }

  // 3. Redirect bare /rankings to /nyc/worst-rated-buildings
  if (firstSegment === "rankings") {
    const url = request.nextUrl.clone();
    url.pathname = `/nyc/worst-rated-buildings`;
    return NextResponse.redirect(url, 301);
  }

  // 4. Path starts with a known city route prefix but has no city → 301 redirect to /nyc/...
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

  // 5. Everything else (homepage, api, auth, dashboard, about, privacy, terms) — pass through
  const fallbackHeaders = new Headers(request.headers);
  fallbackHeaders.set("x-city", "nyc");
  return NextResponse.next({ request: { headers: fallbackHeaders } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
