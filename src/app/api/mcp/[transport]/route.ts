import { mcpRoute } from "@/lib/mcp/handler";

/**
 * MCP endpoint (Streamable HTTP) — see docs/superpowers/plans/
 * 2026-08-16-mcp-server-scope.md. The canonical client URL is
 * https://lucidrents.com/api/mcp (served by ../route.ts); this dynamic
 * segment also answers /api/mcp/mcp for clients configured with the older
 * mcp-handler path convention. mcp-handler is pathname-agnostic, so both
 * mounts share one handler. Kill switch: MCP_DISABLED=1 → 503.
 */
export { mcpRoute as GET, mcpRoute as POST, mcpRoute as DELETE };
