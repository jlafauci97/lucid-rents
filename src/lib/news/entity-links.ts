/**
 * Build canonical URLs to lucidrents.com pages from a SignalCandidate's
 * metadata. The drafter weaves these into the article body as markdown
 * anchors, the cross-poster includes the primary one in the tweet, and the
 * UI can render them as a "Mentioned in this story" rail.
 *
 * Synchronous on purpose: every link is derivable from the metadata fields
 * the detectors already populate. The route handler may resolve a building
 * ID into a URL with a separate helper if needed.
 */

import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import {
  canonicalUrl,
  landlordUrl,
  neighborhoodUrl,
} from "@/lib/seo";
import { searchNeighborhoodsByCity } from "@/lib/neighborhoods";
import type { SignalCandidate } from "./templates/types";

export type EntityLinkKind = "landlord" | "neighborhood" | "building" | "city";

function urlField(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.startsWith("http") ? v : null;
}

export interface EntityLink {
  label: string;
  url: string;
  kind: EntityLinkKind;
}

function strField(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function neighborhoodLink(name: string, city: City): EntityLink | null {
  // Try to resolve the neighborhood to a known zip so we hit the canonical
  // /neighborhood/<slug>-<zip> URL. If no match (e.g. "Mid-Wilshire" not in
  // our zip table), fall back to the neighborhoods index for that city.
  const matches = searchNeighborhoodsByCity(name, city, 1);
  if (matches.length > 0) {
    return {
      label: name,
      url: canonicalUrl(neighborhoodUrl(matches[0].zipCode, city)),
      kind: "neighborhood",
    };
  }
  return {
    label: name,
    url: canonicalUrl(`/${CITY_META[city].urlPrefix}/neighborhoods`),
    kind: "neighborhood",
  };
}

export function entityLinksForSignal(
  signal: SignalCandidate,
  city: City
): EntityLink[] {
  const links: EntityLink[] = [];
  const meta = signal.metadata as Record<string, unknown>;

  const landlord = strField(meta, "landlord");
  if (landlord && landlord.toLowerCase() !== "unknown") {
    links.push({
      label: landlord,
      url: canonicalUrl(landlordUrl(landlord, city)),
      kind: "landlord",
    });
  }

  // Building features carry a ready-made canonical URL + short address label.
  const buildingUrl = urlField(meta, "building_url");
  const buildingAddress = strField(meta, "building_address");
  if (buildingUrl && buildingAddress) {
    links.push({ label: buildingAddress, url: buildingUrl, kind: "building" });
  }

  const neighborhood = strField(meta, "neighborhood");
  if (neighborhood) {
    const link = neighborhoodLink(neighborhood, city);
    if (link) links.push(link);
  }

  // Always include the city's news index — gives the AI an obvious target
  // for the "see more from <city>" type of internal link.
  links.push({
    label: `${CITY_META[city].fullName} renter news`,
    url: canonicalUrl(`/${CITY_META[city].urlPrefix}/news`),
    kind: "city",
  });

  return links;
}

/**
 * The link most relevant to use as the "tweet anchor" — the entity page that
 * a reader who clicks the tweet should land on alongside the article. Picks
 * the most specific link available (landlord > neighborhood > city).
 */
export function primaryEntityLink(links: EntityLink[]): EntityLink | null {
  return (
    links.find((l) => l.kind === "building") ??
    links.find((l) => l.kind === "landlord") ??
    links.find((l) => l.kind === "neighborhood") ??
    null
  );
}
