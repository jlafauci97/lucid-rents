// Next.js 16 proxy (formerly middleware.ts). Runs in the Node.js runtime by
// default in Next 16 — no runtime export allowed.

import { NextResponse, type NextRequest } from "next/server";
import { VALID_CITIES, HIDDEN_CITIES, STATE_CITY_MAP, CITY_META } from "@/lib/cities";
import { neighborhoodPageSlug } from "@/lib/nyc-neighborhoods";
import { neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";

/** Route prefixes that are city-specific and should be under /[city]/ */
const CITY_ROUTES = new Set([
  "buildings",
  "building",
  "building-list",
  "landlords",
  "landlord",
  // "search" intentionally NOT here — `/search` is a top-level cross-city
  // route added in #214 (referenced by the homepage WebSite SearchAction
  // JSON-LD). The city-scoped equivalent lives at `/[city]/search` and
  // doesn't pass through this redirect because the path already begins
  // with a valid city segment.
  "worst-rated-buildings",
  "building-rankings",
  "crime",
  "map",
  "feed",
  "news",
  "permits",
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

// Best-buildings chip eligibility. Duplicated here (rather than
// imported from the route) so the proxy stays self-contained.
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
 * If the request is /[city]/building-list/[chip] with an invalid chip, return
 * a proper 404 or 307 at the edge. Runtime notFound()/redirect() calls from
 * the page were being coerced to HTTP 200 in this Next.js 16 deployment.
 */
function checkBuildingListChip(
  request: NextRequest,
  segments: string[],
  firstSegment: string,
): NextResponse | null {
  let internalCity: string | null = null;
  let externalPrefix: string | null = null;
  let chip: string | null = null;

  const stateMap = STATE_CITY_MAP[firstSegment.toUpperCase()];
  if (stateMap && segments[3] === "building-list" && segments[4]) {
    const citySlugSegment = segments[2] || "";
    const city = stateMap[citySlugSegment];
    if (city) {
      internalCity = city;
      externalPrefix = `/${firstSegment}/${citySlugSegment}`;
      chip = segments[4].split("?")[0];
    }
  } else if (
    VALID_CITIES.includes(firstSegment as (typeof VALID_CITIES)[number]) &&
    segments[2] === "building-list" &&
    segments[3]
  ) {
    internalCity = firstSegment;
    externalPrefix = `/${CITY_META[firstSegment as (typeof VALID_CITIES)[number]].urlPrefix}`;
    chip = segments[3].split("?")[0];
  }

  if (!internalCity || !externalPrefix || !chip) return null;

  if (!BB_CHIPS.has(chip)) {
    return new NextResponse(null, { status: 404 });
  }

  const allow = BB_CHIP_CITY_ALLOWLIST[chip];
  if (allow && !allow.includes(internalCity)) {
    const url = request.nextUrl.clone();
    url.pathname = `${externalPrefix}/building-list`;
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Mission Control password gate (runs before any city routing).
  if (
    pathname.startsWith("/mission-control") &&
    pathname !== "/mission-control/login" &&
    pathname !== "/mission-control/logout"
  ) {
    const cookie = request.cookies.get(MC_COOKIE);
    if (!(await verifyCookieValue(cookie?.value))) {
      const url = request.nextUrl.clone();
      url.pathname = "/mission-control/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Split path segments: "/nyc/buildings" => ["", "nyc", "buildings"]
  const segments = pathname.split("/");
  const firstSegment = segments[1] || "";

  // 0. Hidden-city gate. Miami/Houston were pulled from public view (July
  // 2026), LA/Chicago in August 2026; their URLs get a hard 404 at the edge
  // in every form — internal slug (/miami), state prefix (/FL/Miami), and
  // shorthand (/mia). Done here rather than via notFound() because runtime
  // notFound() was being coerced to HTTP 200 soft-404s on this deployment
  // (see chip guard below).
  {
    const HIDDEN_SHORTHANDS: Record<string, string> = {
      mia: "miami",
      hou: "houston",
      la: "los-angeles",
      chi: "chicago",
    };
    const stateMapped = STATE_CITY_MAP[firstSegment.toUpperCase()]?.[segments[2] || ""];
    const hiddenHit =
      HIDDEN_CITIES.includes(firstSegment as (typeof HIDDEN_CITIES)[number]) ||
      (stateMapped && HIDDEN_CITIES.includes(stateMapped)) ||
      firstSegment in HIDDEN_SHORTHANDS;
    if (hiddenHit) {
      return withNoindex(new NextResponse(null, { status: 404 }), request);
    }
  }

  // 0. Best-buildings chip guard. Intercepts invalid (city, chip) combos at
  // the edge so the HTTP response is a real 307 redirect or 404 — Next.js
  // runtime notFound()/redirect() from the page were ending up as 200
  // soft-404s on this deployment.
  const bbResponse = checkBuildingListChip(request, segments, firstSegment);
  if (bbResponse) return withNoindex(bbResponse, request);

  // 0a2. Building "/review" → "/reviews". Cloudflare's AI Crawl Control
  // demand-signals report (Aug 2026) showed AI assistants guessing
  // /building/<borough>/<slug>/review across 384 distinct paths and 404ing —
  // active demand for review content bounced on a singular/plural miss.
  // Matches any city-prefix shape since /review is always the last segment
  // after /building/x/y.
  {
    const bIdx = segments.indexOf("building");
    if (
      bIdx > 0 &&
      segments.length === bIdx + 4 &&
      segments[segments.length - 1] === "review"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `${pathname.slice(0, -"/review".length)}/reviews`;
      return NextResponse.redirect(url, 301);
    }
  }

  // 0b. Directory pagination canonicalization, shared by both city-prefix
  // shapes below. Legacy ?page=N URLs (the fake-pagination era: every ?page=N
  // served page-1 content) 301 to the real path-segment form /page/N, and
  // /page/1 301s to the bare listing so page 1 has exactly one URL.
  const paginationRedirect = (externalPrefix: string, rest: string[]): NextResponse | null => {
    const isBoroughListing = rest[0] === "buildings" && rest.length >= 2;
    const isLandlords = rest[0] === "landlords";
    if (!isBoroughListing && !isLandlords) return null;

    const listingDepth = isLandlords ? 1 : 2; // segments that form the listing base
    const base = `/${externalPrefix}/${rest.slice(0, listingDepth).join("/")}`;

    // /page/1 → base
    if (rest[listingDepth] === "page" && rest[listingDepth + 1] === "1" && rest.length === listingDepth + 2) {
      const url = request.nextUrl.clone();
      url.pathname = base;
      return NextResponse.redirect(url, 301);
    }

    // ?page=N on the bare listing → /page/N (N>1) or base (N<=1/invalid).
    // Only when `page` is the SOLE query param: with sort/search present the
    // URL is client-side directory state (robots-disallowed ?sort, uncrawled
    // search), and redirecting would strip that state mid-interaction.
    const pageParam = request.nextUrl.searchParams.get("page");
    if (pageParam !== null && request.nextUrl.searchParams.size === 1 && rest.length === listingDepth) {
      const n = parseInt(pageParam, 10);
      const url = request.nextUrl.clone();
      url.searchParams.delete("page");
      url.pathname = Number.isFinite(n) && n > 1 ? `${base}/page/${n}` : base;
      return NextResponse.redirect(url, 301);
    }
    return null;
  };

  // 1a. Check for multi-segment city prefix: /CA/Los-Angeles/... → rewrite to /los-angeles/...
  const stateMap = STATE_CITY_MAP[firstSegment.toUpperCase()];
  if (stateMap) {
    const citySlugSegment = segments[2] || "";
    const internalCity = stateMap[citySlugSegment];
    if (internalCity) {
      // Rewrite the URL internally while preserving the external URL
      const remainingPath = segments.slice(3).join("/");
      const internalPath = `/${internalCity}${remainingPath ? `/${remainingPath}` : ""}`;

      // Old /rankings and /worst-rated-buildings paths must 301 HERE, before
      // the rewrite below hides them behind the internal city slug. Otherwise
      // they fall through to the page component, whose permanentRedirect() is
      // coerced by Next 16 streaming SSR into an HTTP 200 carrying
      // `<meta http-equiv="refresh">` — which Google files under "Page with
      // redirect" — and which pointed at the INTERNAL slug
      // (/chicago/building-rankings), itself a non-canonical URL that then
      // canonicalises to /IL/Chicago/building-rankings. Two wasted hops from a
      // 200 with no canonical of its own.
      if (segments[3] === "rankings" || segments[3] === "worst-rated-buildings") {
        const url = request.nextUrl.clone();
        const rest = segments.slice(4);
        url.pathname = `/${CITY_META[internalCity].urlPrefix}/building-rankings${rest.length ? "/" + rest.join("/") : ""}`;
        return NextResponse.redirect(url, 301);
      }

      {
        const pr = paginationRedirect(CITY_META[internalCity].urlPrefix, segments.slice(3));
        if (pr) return pr;
      }

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
      // NOTE: Don't mutate request headers via NextResponse.rewrite({ request: {...} }) —
      // doing so opts the rewritten route out of static rendering & ISR. The
      // Navbar derives the current city from the pathname (useCityFromPath),
      // so x-city is no longer needed downstream.
      const response = NextResponse.rewrite(url);
      return withNoindex(response, request);
    }
  }

  // 1b. Path already starts with a valid single-segment city (e.g. "nyc")
  if (VALID_CITIES.includes(firstSegment as (typeof VALID_CITIES)[number])) {
    // Redirect old /rankings or /worst-rated-buildings URL to /building-rankings.
    // Target the city's EXTERNAL prefix, not the matched segment: reaching this
    // via an internal slug (/chicago/...) would otherwise 301 to another
    // internal-slug URL that just canonicalises again. For nyc the two are the
    // same string, so that form is unchanged.
    if (segments[2] === "rankings" || segments[2] === "worst-rated-buildings") {
      const url = request.nextUrl.clone();
      const prefix = CITY_META[firstSegment as (typeof VALID_CITIES)[number]].urlPrefix;
      url.pathname = `/${prefix}/building-rankings${segments.slice(3).length ? "/" + segments.slice(3).join("/") : ""}`;
      return NextResponse.redirect(url, 301);
    }
    {
      const pr = paginationRedirect(firstSegment, segments.slice(2));
      if (pr) return pr;
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
    // Pass through without mutating request headers (see note above).
    return withNoindex(NextResponse.next(), request);
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

  // 3. Redirect bare /rankings or /worst-rated-buildings to /nyc/building-rankings
  if (firstSegment === "rankings" || firstSegment === "worst-rated-buildings") {
    const url = request.nextUrl.clone();
    url.pathname = `/nyc/building-rankings`;
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
  return withNoindex(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!_next|api|\\.well-known/workflow|favicon|.*\\..*).*)"],
};
