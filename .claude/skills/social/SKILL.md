---
description: Generate and publish a social media post about a given topic using LucidRents data
user_invocable: true
---

# /social — Ad-hoc Social Media Post

Generate a social media post from a topic or brief, using real LucidRents data, and publish it to all platforms via Post Bridge.

## Usage

```
/social "That landlord on the front page of r/nyc just got sued"
/social "Rent dropped 8% in Bushwick this month"
/social "Lucid the Lizard discovers a building with 200 violations"
```

## Workflow

1. **Parse the brief** — extract the topic, any mentioned buildings/landlords/neighborhoods, and suggested content type (landlord_expose, building_horror, neighborhood_trend, tenant_rights, news_reaction, viral_humor).

2. **Gather data** — if the brief mentions a specific building, landlord, or neighborhood, query Supabase for relevant data:
   - Buildings: `SELECT * FROM buildings WHERE full_address ILIKE '%...' OR name ILIKE '%...'`
   - Violations: `SELECT count(*), class FROM hpd_violations WHERE building_id = '...' GROUP BY class`
   - Landlords: `SELECT b.owner_name, count(*) as buildings, sum(b.violation_count) as total_violations FROM buildings b WHERE owner_name ILIKE '%...' GROUP BY b.owner_name`
   - Rent trends: `SELECT * FROM building_rents WHERE building_id = '...'`
   - Use the Supabase MCP `execute_sql` tool for queries.

3. **Generate content** — using the brand voice from `src/lib/marketing/brand-voice.ts`:
   - Generate a primary caption
   - Generate platform variants for: Instagram, TikTok, YouTube, X, LinkedIn, Facebook, Pinterest (title + description + board), Threads, Bluesky
   - Generate hashtag sets per platform rules
   - If viral_humor type, write a Lucid the Lizard video prompt

4. **Preview** — show the user:
   - Primary caption
   - 2-3 key platform variants (TikTok, X, Pinterest)
   - Video prompt if applicable
   - Source data summary

5. **On approval** — create the draft and trigger publish:
   - POST to the local dev server or production API at `/api/marketing/drafts` with the content
   - Then POST to `/api/marketing/approve` with `{ draftId, action: "approve" }`
   - Report back with confirmation and any publish results

## Brand Voice Rules

- Informative but punchy. Data-first. Never fear-mongering — empowering.
- Every post ends with soft CTA: "Check your building free at lucidrents.com"
- TikTok: Hook in 2 seconds, under 60s
- X: Sharp one-liner + data point + link, under 280 chars
- Pinterest: SEO title + keyword-rich description, no hashtags
- LinkedIn: Professional "housing transparency" framing
- Viral humor: Lucid the Lizard is the primary mascot character

## Important

- All data points MUST come from real Supabase queries. Never fabricate statistics.
- Always cite the data source (e.g., "per HPD records").
- Ask the user for confirmation before publishing. Show them what will be posted.
