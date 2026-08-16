import { mcpRoute } from "@/lib/mcp/handler";

/**
 * Canonical MCP endpoint URL: https://lucidrents.com/api/mcp
 * Same handler as ./[transport]/route.ts — see src/lib/mcp/handler.ts.
 */
export { mcpRoute as GET, mcpRoute as POST, mcpRoute as DELETE };
