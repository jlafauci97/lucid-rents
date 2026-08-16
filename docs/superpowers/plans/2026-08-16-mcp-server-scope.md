# LucidRents MCP Server — Scope

**Status:** Scoped, not started
**Origin:** Cloudflare Agent Readiness review (Aug 2026). The site already gets ~3K AI-answer retrievals/day via crawling; an MCP server makes LucidRents the *tool* AI assistants call for building intelligence rather than a site they scrape — structured answers, always-fresh data, and a citation link in every response.

## What it is

A remote MCP (Model Context Protocol) server exposing LucidRents' public building intelligence as callable tools. Any MCP-capable client (Claude, Claude Code, ChatGPT dev mode, Cursor, agent frameworks) can connect to `https://lucidrents.com/api/mcp` and ask questions like "what's the violation history at 48-04 48th Ave in Queens?" and get structured data plus a canonical lucidrents.com URL to cite.

Strictly **read-only, public data only** in v1 — the same data the website already serves anonymously. No reviews submission, no user accounts, nothing behind auth.

## Why it's strategically right for this product

- The moat is the data (violations + 311 + reviews + rents unified per building). Making it agent-queryable extends the moat into the agentic channel before a competitor does.
- Every tool response embeds the canonical page URL → agents cite/link us, which feeds the same authority loop as SEO.
- Cloudflare's demand-signals report already proves agents *want* granular building data (384 guessed-URL patterns in one day).
- Flips Cloudflare Agent Readiness Level 2/3 checks as a side effect.

## Architecture

- **Host in the existing Next app** as a route handler (`src/app/api/mcp/[transport]/route.ts`) using Vercel's `mcp-handler` package (Streamable HTTP transport; SSE fallback). Zero new infra: same repo, same deploy, same Supabase env, same Cloudflare in front.
  - Rejected alternative: Cloudflare Workers `McpAgent` (their Agents SDK). Cleaner for stateful/session servers, but adds a second deploy target, second secrets store, and code duplication for DB access. Revisit only if tool sessions need durable state.
  - **Verify at build time**: `mcp-handler` compatibility with Next 16.2 (it's a fast-moving package; check its peer deps before committing to it — fallback is hand-rolling the Streamable HTTP endpoint against `@modelcontextprotocol/sdk`, ~150 extra lines).
- **Auth: none in v1** (anonymous, like the website). MCP OAuth 2.1 only becomes relevant if/when a higher-rate-limit tier or user-scoped tools (saved buildings) are wanted.
- **Rate limiting: required from day one.** `@upstash/ratelimit` is already a dependency with Redis configured (KV_REST_API_* env). Suggested: 30 tool calls/min per IP, 429 with Retry-After. This is the abuse story for scraping-at-scale; revisit with an API-key tier if legitimate heavy users appear.
- **Performance rules** (hard-learned this week): every tool resolves through the cheap paths built in PRs #319/#327/#330 — planner-estimate counts, SQL aggregate RPCs, `unstable_cache` with the per-building tags. No tool may issue an unbounded row fetch. Budget: any tool call ≤ 3 Supabase queries, ≤ 1s p95.

## Traffic design: summary, not substitute

The server's traffic yield is a product decision, not a side effect. An agent
that fully answers in-line generates zero visits; one that answers *enough*
and points deeper generates them. Rules for every tool:

1. **Partial payloads by design.** Return the verdict-level data (score,
   headline counts, 2 pull quotes) and explicitly name what lives at the
   link: full violation timeline, all reviews, photos, rent history, unit
   detail. The response schema includes a `more` field enumerating what the
   page has that the payload doesn't — assistants relay that to users.
2. **Every URL is UTM-tagged** (`?utm_source=mcp&utm_medium=<tool-name>`) so
   click-through per tool is directly measurable in analytics.
3. **Deep links, not just homepages.** Section anchors where useful
   (`#issues`, `#reviews`) and related-entity URLs in responses (landlord
   page from a building report, neighborhood page from stats) — each
   response seeds multiple crawlable/clickable paths.
4. **Cross-recommendations.** `get_building_report` includes 2-3 similar
   nearby buildings (slug + URL, reusing the S08 data) — the agentic
   equivalent of internal linking.

**Honest expectations:** near-term traffic is a trickle — MCP servers today
are connected by power users, not mainstream assistant users. The value is
(a) long-tail coverage (2M buildings no AI has memorized become citable on
demand), (b) the brand loop ("according to LucidRents…" → brand searches),
and (c) a call option on assistant app directories going mainstream. The
traffic engines remain SEO recovery, crawl-based AI citations, and the
unbuilt rent-report content pages — this server complements, not replaces.

## Tools (v1)

All responses include `url` (canonical, UTM-tagged), `data_as_of`, and
`more` (what the linked page adds) fields.

1. **`search_buildings`** `(query: string, city?: nyc|los-angeles|chicago)` → up to 10 matches `{address, slug, city, borough, score, violation_count}`. Wraps the existing `search_buildings_ranked` RPC (already bounded + two-stage; serves /api/search today).
2. **`get_building_report`** `(city, slug)` → the building page's core numbers: score/grade, violation counts by class, open vs closed, 311 total, complaint categories (via `building_hpd_desc_counts` / `building_311_type_counts` aggregates), review aggregate (count, avg), rent summary if present (`building_rents`), landlord name + landlord page URL, year built/units, and 2-3 similar nearby buildings (S08 data) with URLs. Fail-soft per section like the page does.
3. **`get_landlord_record`** `(city, slug-or-name)` → `landlord_stats` row: portfolio size, total violations/complaints/litigations, avg score, worst building. Name resolution via the existing `search_landlord_stats` RPC.
4. **`get_neighborhood_stats`** `(city, zip)` → median rents by bedroom (`neighborhood_median_rents`), crime summary (`crime_by_zip_cache` / `crime_zip_aggregates`), 311 profile. Cache-table reads only — no live aggregation.
5. **`get_review_summary`** `(city, slug)` → review count, rating distribution, top pull quotes (the S03 loader's data). Directly answers the demand the /review 404s showed.

**v2 candidates** (only after v1 usage proves demand): `compare_buildings`, `get_rent_history` (submarket trend series), `find_buildings_near` (geo radius — reuse `neighborhood_risk_counts` bbox technique), resources for llms-full-style docs, prompts for common renter workflows.

## Discovery & distribution

- Add the endpoint to `llms.txt`, `/for-ai`, and robots.txt comments.
- `/.well-known/` MCP discovery metadata (spec still settling — implement whatever Cloudflare's Agent Readiness "MCP" check validates at build time).
- Submit to MCP registries/directories (official registry, mcp.so, Smithery, Cloudflare MCP portals) — this is where agent builders find tools.
- Optional: register in Cloudflare's WebMCP beta.

## Effort estimate

| Piece | Size |
|---|---|
| Scaffold route + transport + rate limiting | 0.5 day |
| 5 tools wrapping existing RPCs/caches, with zod schemas + canonical URLs | 1 day |
| Verification (MCP Inspector + Claude/Cursor live test), docs, llms.txt//for-ai updates | 0.5 day |
| Registry submissions | 0.5 day, mostly waiting |

**Total: ~2.5 focused days**, no new infrastructure, no migrations (all reads use existing RPCs/tables).

## Risks

- **DB load from agent fan-out**: an agent loop can hammer tools. Mitigated by rate limit + cache + the ≤3-queries budget. Watch `pg_stat_statements` after launch (we know how now).
- **Schema stability**: once agents depend on tool shapes, changing them breaks integrations. Version the tool names conservatively; additive changes only.
- **Package churn**: MCP ecosystem moves fast; pin versions, keep the transport layer thin so it's swappable.

## Success metrics

- Tool-call volume (log per-tool counts; a Vercel log drain or simple counter table).
- **Click-through**: sessions with `utm_source=mcp`, segmented by `utm_medium` (tool name) — the direct traffic yield of the summary-not-substitute design.
- Cloudflare AI Crawl Control: AI Assistant category traffic trend.
- Agent Readiness Level 2/3 checks flipping.
- Brand-search volume trend in GSC (the "according to LucidRents" loop is only visible here).
