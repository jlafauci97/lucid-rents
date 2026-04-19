// Next.js 16 proxy (formerly middleware.ts). Running in the Node.js runtime
// so response status codes for notFound() / redirect() propagate correctly —
// on Edge the old middleware.ts was coercing these into HTTP 200 soft-404s.
export const runtime = "nodejs";

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

const PRODUCTION_HOST = "lucidrents.com";

function isProduction(request: NextRequest): boolean {
  return request.headers.get("host")?.replace(/:\d+$/, "") === PRODUCTION_HOST;
}

/** On non-production deployments, tag the response with noindex so search engines skip it. */
function withNoindex(response: NextResponse, request: NextRequest): NextResponse {
  if (!isProduction(request)) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

// Best-buildings chip eligibility. Duplicated in middleware (rather than
// imported from the route) because middleware runs in the Edge runtime and
// must be kept small + self-contained.
const BB_CHIPS = new Set([
  "top-rated",
  "rent-stabilized",
  "most-reviewed",
  "no-violations",
  "large-buildings",
]);
const BB_CHIP_CITY_ALLOWLIST: Record<string, ReadonlyArray<string>> = {
  "rent-stabilized": ["nyc", "los-angeles"],
};

/**
 * If the request is /[city]/best-buildings/[chip] with an invalid chip, return
 * a proper 404 or 307 at the edge. Runtime notFound()/redirect() calls from
 * the page were being coerced to HTTP 200 in this Next.js 16 deployment.
 */
function checkBestBuildingsChip(
  request: NextRequest,
  segments: string[],
  firstSegment: string,
): NextResponse | null {
  // Locate internal city + external prefix from the URL. Two forms:
  //   /CA/Los-Angeles/best-buildings/<chip>         (state-prefixed external URL)
  //   /nyc/best-buildings/<chip>                    (internal-city URL)
  let internalCity: string | null = null;
  let externalPrefix: string | null = null;
  let chip: string | null = null;

  const stateMap = STATE_CITY_MAP[firstSegment.toUpperCase()];
  if (stateMap && segments[3] === "best-buildings" && segments[4]) {
    const citySlugSegment = segments[2] || "";
    const city = stateMap[citySlugSegment];
    if (city) {
      internalCity = city;
      externalPrefix = `/${firstSegment}/${citySlugSegment}`;
      chip = segments[4].split("?")[0];
    }
  } else if (
    VALID_CITIES.includes(firstSegment as (typeof VALID_CITIES)[number]) &&
    segments[2] === "best-buildings" &&
    segments[3]
  ) {
    internalCity = firstSegment;
    externalPrefix = `/${CITY_META[firstSegment as (typeof VALID_CITIES)[number]].urlPrefix}`;
    chip = segments[3].split("?")[0];
  }

  if (!internalCity || !externalPrefix || !chip) return null;

  // 1) Completely unknown chip slug → 404
  if (!BB_CHIPS.has(chip)) {
    return new NextResponse(null, { status: 404 });
  }

  // 2) Known chip but not enabled for this city → 307 to the city's index
  const allow = BB_CHIP_CITY_ALLOWLIST[chip];
  if (allow && !allow.includes(internalCity)) {
    const url = request.nextUrl.clone();
    url.pathname = `${externalPrefix}/best-buildings`;
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return null; // valid — let the normal city routing flow handle it
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Split path segments: "/nyc/buildings" => ["", "nyc", "buildings"]
  const segments = pathname.split("/");
  const firstSegment = segments[1] || "";

  // 0. Best-buildings chip guard. Intercepts invalid (city, chip) combos at
  // the edge so the HTTP response is a real 307 redirect or 404 — Next.js
  // runtime notFound()/redirect() from the page were ending up as 200
  // soft-404s on this deployment.
  const bbResponse = checkBestBuildingsChip(request, segments, firstSegment);
  if (bbResponse) return withNoindex(bbResponse, request);

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
      return withNoindex(response, request);
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
    return withNoindex(NextResponse.next({ request: { headers: requestHeaders } }), request);
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
  // /mia/... → /FL/Miami/...
  if (firstSegment === "mia") {
    const url = request.nextUrl.clone();
    const rest = segments.slice(2).join("/");
    url.pathname = `/FL/Miami${rest ? `/${rest}` : ""}`;
    return NextResponse.redirect(url, 301);
  }
  // /hou/... → /TX/Houston/...
  if (firstSegment === "hou") {
    const url = request.nextUrl.clone();
    const rest = segments.slice(2).join("/");
    url.pathname = `/TX/Houston${rest ? `/${rest}` : ""}`;
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
  return withNoindex(NextResponse.next({ request: { headers: fallbackHeaders } }), request);
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
