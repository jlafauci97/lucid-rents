import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import {
  worstBuildings,
  worstLandlords,
  worstNeighborhoods,
  type StoryMeta,
} from "./data-stories";

/**
 * Original Reddit posts built from our own data — no replying to anyone.
 *
 * These go to our own profile, so no subreddit rules apply and there is no
 * spam surface: nobody's thread gets interrupted, and a post nobody wants
 * simply gets no upvotes rather than a mod removal.
 *
 * The body is assembled deterministically rather than written by a model. A
 * ranking is a table; there is nothing for prose to add, and generating the
 * numbers would put a hallucination between our records and a public claim we
 * would then have to defend.
 */

export type SelfPostKind = "worst_buildings" | "worst_landlords" | "worst_neighborhoods";

export interface SelfPost {
  kind: SelfPostKind;
  city: City;
  title: string;
  body: string;
  /** Every URL cited, so the post can be checked without re-querying. */
  links: string[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

function methodologyLine(meta: StoryMeta): string {
  const basis =
    meta.basis === "per-unit"
      ? "Ranked per unit, not by raw count — otherwise the list is just the biggest buildings."
      : meta.basis === "per-building"
        ? "Ranked per tracked building, so a larger neighborhood doesn't top the list by size alone."
        : "Ranked by total open violations. Unit counts weren't available for enough of this set to rank per unit.";
  return `*Source: ${meta.sourceNote}, pulled ${meta.generatedAt.slice(0, 10)}. ${basis}*`;
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

export async function buildSelfPost(kind: SelfPostKind, city: City): Promise<SelfPost | null> {
  const cityName = CITY_META[city].fullName;

  if (kind === "worst_buildings") {
    const { meta, rows } = await worstBuildings(city, { limit: 10 });
    if (rows.length < 5) return null;

    const body = [
      `I maintain a database of ${cityName} building violation records. Here are the 10 worst buildings in the city right now.`,
      "",
      table(
        ["#", "Building", meta.basis === "per-unit" ? "Violations / unit" : "Open violations", "Total"],
        rows.map((r) => [
          String(r.rank),
          `[${r.address}](${r.url})`,
          meta.basis === "per-unit" && r.violationsPerUnit !== null
            ? r.violationsPerUnit.toFixed(1)
            : fmt(r.violations),
          fmt(r.violations),
        ])
      ),
      "",
      methodologyLine(meta),
      "",
      `You can look up any ${cityName} building the same way — the records are public, they're just scattered across systems that don't talk to each other.`,
    ].join("\n");

    return {
      kind,
      city,
      title: `The 10 worst buildings in ${cityName} by violation record (${new Date().getFullYear()} data)`,
      body,
      links: rows.map((r) => r.url),
    };
  }

  if (kind === "worst_landlords") {
    const { meta, rows } = await worstLandlords(city, 10);
    if (rows.length < 5) return null;

    const body = [
      `Pulled every violation on file for ${cityName} and grouped it by owner. These 10 landlords account for the most open violations across their portfolios.`,
      "",
      table(
        ["#", "Owner", "Buildings", "Open violations", "Worst property"],
        rows.map((r) => [
          String(r.rank),
          `[${r.owner}](${r.url})`,
          fmt(r.buildings),
          fmt(r.violations),
          r.worstBuilding ? `[${r.worstBuilding.address}](${r.worstBuilding.url})` : "—",
        ])
      ),
      "",
      methodologyLine(meta),
      "",
      `Worth saying plainly: a big portfolio collects more violations than a small one, so this is a list of where the most open violations sit, not a moral ranking. Per-building detail is on each owner's page.`,
    ].join("\n");

    return {
      kind,
      city,
      title: `Which ${cityName} landlords have the most open violations? I ranked the top 10.`,
      body,
      links: rows.map((r) => r.url),
    };
  }

  const { meta, rows } = await worstNeighborhoods(city, 10);
  if (rows.length < 5) return null;

  const body = [
    `I ranked ${cityName} neighborhoods by open violations per tracked building, so a dense area doesn't automatically top the list.`,
    "",
    table(
      ["#", "Neighborhood", "Violations / building", "Buildings tracked"],
      rows.map((r) => [
        String(r.rank),
        `[${r.name}](${r.url})`,
        String(r.violationsPerBuilding),
        fmt(r.buildings),
      ])
    ),
    "",
    methodologyLine(meta),
    "",
    `Neighborhoods with fewer than 20 tracked buildings are excluded — the rate gets meaningless below that.`,
  ].join("\n");

  return {
    kind: "worst_neighborhoods",
    city,
    title: `${cityName} neighborhoods ranked by building violations per building`,
    body,
    links: rows.map((r) => r.url),
  };
}
