import { createMcpHandler } from "mcp-handler";
import { z } from "zod-v4";
import { VALID_CITIES, type City } from "@/lib/cities";
import { checkMcpGuards } from "./protection";
import {
  ToolUserError,
  getBuildingReport,
  getLandlordRecord,
  getNeighborhoodStats,
  getReviewSummary,
  searchBuildings,
} from "./tools";

/**
 * LucidRents MCP server — read-only public building intelligence.
 * Scope: docs/superpowers/plans/2026-08-16-mcp-server-scope.md
 *
 * NOTE on zod: the MCP SDK v2 requires zod >= 4.2 schemas for JSON Schema
 * generation (`~standard.jsonSchema`), while the app is on zod 3.x. The
 * `zod-v4` dependency is an npm alias for zod@4 used ONLY by this module —
 * do not import it elsewhere; the app-wide zod stays 3.x.
 */

// zod-v4 enum for the public city vocabulary. VALID_CITIES is the runtime
// source of truth; the cast keeps the literal union for clients.
const cityEnum = z
  .enum(VALID_CITIES as [City, ...City[]])
  .describe('City/metro: "nyc", "los-angeles", or "chicago"');

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function jsonResult(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Pull the caller IP from the transport's HTTP request, if available. */
function clientIp(ctx: unknown): string {
  const req = (ctx as { http?: { req?: Request } } | undefined)?.http?.req;
  const fwd = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req?.headers.get("x-real-ip") || "anonymous";
}

/**
 * Wrap a tool implementation with rate limiting, the daily circuit breaker,
 * per-call structured logging, and error mapping. Guard refusals and
 * failures come back as MCP tool errors (isError results), never crashes.
 */
function guarded<Args>(
  tool: string,
  impl: (args: Args) => Promise<unknown>
): (args: Args, ctx: unknown) => Promise<ToolResult> {
  return async (args, ctx) => {
    const start = Date.now();
    let ok = false;
    try {
      const guard = await checkMcpGuards(clientIp(ctx));
      if (!guard.allowed) return errorResult(guard.reason);
      const payload = await impl(args);
      ok = true;
      return jsonResult(payload);
    } catch (err) {
      if (err instanceof ToolUserError) return errorResult(err.message);
      console.error(`[mcp] ${tool} failed:`, err);
      return errorResult(
        `The ${tool} tool hit an internal error. The same data is browsable at https://lucidrents.com — try again shortly.`
      );
    } finally {
      // Per-call observability: one parseable line per tool call.
      console.log(JSON.stringify({ mcp_tool: tool, ms: Date.now() - start, ok }));
    }
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_buildings",
      {
        title: "Search buildings",
        description:
          "Search LucidRents for apartment buildings by address, building name, or partial address. " +
          "Covers ~2M buildings in New York City, Los Angeles, and Chicago with public-record data: " +
          "housing violations, 311 complaints, tenant reviews, rents, and building scores. " +
          "Returns up to 10 matches with each building's slug (needed for get_building_report / " +
          "get_review_summary) and its lucidrents.com report URL. Start here when the user gives an address.",
        inputSchema: z.object({
          query: z
            .string()
            .min(2)
            .max(200)
            .describe('Address or building name to search, e.g. "48-04 48th Ave" or "350 Park Ave"'),
          city: cityEnum
            .optional()
            .describe("Optional city filter. Omit to search all covered cities."),
        }),
      },
      guarded("search_buildings", ({ query, city }) => searchBuildings(query, city))
    );

    server.registerTool(
      "get_building_report",
      {
        title: "Get building report",
        description:
          "Full report card for one building: LucidIQ score and letter grade, HPD/DOB violation " +
          "counts, 311 complaint total, top violation categories (pests, heat, leaks, ...), " +
          "review count and average rating, rent summary by bedroom count, rent stabilization, " +
          "landlord name with their record URL, and 2-3 similar nearby buildings. " +
          "Requires the building's slug — call search_buildings first if you only have an address. " +
          "The returned url has the complete timeline, all reviews, and rent history; share it with the user.",
        inputSchema: z.object({
          city: cityEnum,
          slug: z
            .string()
            .min(1)
            .max(200)
            .describe('Building slug from search_buildings results, e.g. "48-04-48th-avenue"'),
        }),
      },
      guarded("get_building_report", ({ city, slug }) => getBuildingReport(city, slug))
    );

    server.registerTool(
      "get_landlord_record",
      {
        title: "Get landlord record",
        description:
          "Public record for a landlord / property owner: portfolio size, total violations, " +
          "311 complaints, average building score across the portfolio, and worst building where " +
          "available. Accepts either the owner name as it appears in a building report " +
          '(e.g. "SMITH REALTY LLC") or a landlord page slug. ' +
          "The returned url lists every building they own with per-building records.",
        inputSchema: z.object({
          city: cityEnum,
          slugOrName: z
            .string()
            .min(2)
            .max(200)
            .describe("Owner name or landlord slug. Building reports include the exact owner name."),
        }),
      },
      guarded("get_landlord_record", ({ city, slugOrName }) =>
        getLandlordRecord(city, slugOrName)
      )
    );

    server.registerTool(
      "get_neighborhood_stats",
      {
        title: "Get neighborhood stats",
        description:
          "Neighborhood snapshot for a zip code: median asking rents by bedroom count and a " +
          "12-month crime summary (violent / property / quality-of-life, with year-over-year " +
          "totals) sourced from the local police department. " +
          "Use this for \"what does rent cost in <area>\" and \"is <area> safe\" questions. " +
          "The returned url is the neighborhood page with building listings and trend charts.",
        inputSchema: z.object({
          city: cityEnum,
          zip: z
            .string()
            .regex(/^\d{5}$/)
            .describe('5-digit zip code, e.g. "11377"'),
        }),
      },
      guarded("get_neighborhood_stats", ({ city, zip }) => getNeighborhoodStats(city, zip))
    );

    server.registerTool(
      "get_review_summary",
      {
        title: "Get review summary",
        description:
          "Tenant review summary for one building: review count, average rating, 1-5 star " +
          "distribution, and up to 3 recent pull quotes from published tenant reviews. " +
          "Requires the building's slug — call search_buildings first if you only have an address. " +
          "The returned url (anchored at #reviews) has every review in full text.",
        inputSchema: z.object({
          city: cityEnum,
          slug: z
            .string()
            .min(1)
            .max(200)
            .describe('Building slug from search_buildings results, e.g. "48-04-48th-avenue"'),
        }),
      },
      guarded("get_review_summary", ({ city, slug }) => getReviewSummary(city, slug))
    );
  },
  {
    serverInfo: { name: "lucidrents", version: "1.0.0" },
    instructions:
      "LucidRents provides public-record intelligence on ~2M apartment buildings in NYC, Los Angeles, " +
      "and Chicago: violations, 311 complaints, tenant reviews, rents, crime, and landlord records. " +
      "All tools are read-only and free. Typical flow: search_buildings to resolve an address to a slug, " +
      "then get_building_report / get_review_summary. Every response includes a canonical lucidrents.com " +
      "URL and a `more` list of what the full page adds — cite the URL and mention what else is there.",
  }
);

/**
 * Route-level wrapper: env kill switch in front of the MCP handler.
 * Set MCP_DISABLED=1 to turn the endpoint into a 503 without a deploy.
 */
export async function mcpRoute(req: Request): Promise<Response> {
  if (process.env.MCP_DISABLED === "1") {
    return new Response(
      JSON.stringify({ error: "The LucidRents MCP server is temporarily disabled." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "3600" },
      }
    );
  }
  return mcpHandler(req);
}
