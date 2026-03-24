# LucidRents Marketing Automation Engine — Design Spec

**Date:** 2026-03-24
**Status:** Approved design, pending implementation plan

## Overview

An autonomous marketing engine built into LucidRents that generates, reviews, and publishes content across 9 social platforms + Reddit. Powered by Vercel Workflow DevKit for durability, Claude (via AI Gateway) for content generation, and three video generation tools for multi-format output.

### Goals

- Fully autonomous content generation from LucidRents' live data (violations, trends, landlord portfolios)
- High volume: 4 content runs/day + always-on Reddit monitoring
- Full editorial control via an in-app marketing dashboard
- Human-in-the-loop approval gate before anything publishes
- One-click "Approve & Publish" pushes to all platforms simultaneously
- Durable execution — no lost work from crashes, deploys, or API timeouts

### Platforms (9 broadcast + Reddit)

Instagram, TikTok, YouTube, X (Twitter), LinkedIn, Facebook, Pinterest, Threads, Bluesky

Reddit is handled separately via the Reddit monitoring & reply workflow (not broadcast).

### Content Types (6)

| Type | Description | Video Format |
|------|-------------|-------------|
| Landlord Exposé | Data-driven profiles of worst landlords by violation count | Avatar or Data Viz |
| Building Horror Story | Buildings with alarming violation spikes | Avatar or Data Viz |
| Neighborhood Trend | Rent changes + violation deltas by area | Data Viz |
| Tenant Rights Education | Actionable rights info per city | Avatar |
| News Reaction | Piggybacking trending housing stories with LucidRents data | Avatar or None |
| Viral Humor | AI characters (fruits, objects) delivering housing data in absurdist format | Kling AI character |

### Video Formats (3)

| Format | Tool | Use Case |
|--------|------|----------|
| Avatar narration | HeyGen | Serious/educational — narrator presenting data |
| Data visualization | Remotion (self-hosted) | Animated charts, maps, timelines |
| Viral character | Kling AI | AI fruit/object characters telling housing stories |

---

## Architecture

### System Diagram

```
                    +-----------------------------------------+
                    |          CRON TRIGGERS                   |
                    |  Content: every 6h (0,6,12,18 UTC)      |
                    |  Reddit: every 30m                       |
                    |  Analytics: daily at midnight UTC        |
                    +----------+------------------+-----------+
                               |                  |
                    +----------v--------+  +------v----------+
                    |  Content WDK      |  |  Reddit WDK     |
                    |  Workflow          |  |  Workflow        |
                    |                   |  |                  |
                    | 1. Select type    |  | 1. Scan subs     |
                    | 2. Gather data    |  | 2. Score         |
                    | 3. Generate copy  |  | 3. Draft replies |
                    | 3b. Pinterest img |  | 4. Save drafts   |
                    | 4. Video gen      |  | 5. [Hook: await] |
                    | 5. Save draft     |  | 6. Post reply    |
                    | 6. [Hook: await]  |  +------+----------+
                    | 7. Publish        |         |
                    +----------+--------+         |
                               |                  |
                    +----------v------------------v----------+
                    |       MARKETING DASHBOARD               |
                    |       /admin/marketing                   |
                    |                                         |
                    |  Content Queue | Reddit | Analytics      |
                    |  Review / Edit / Approve / Reject        |
                    +----------+------------------+----------+
                               |                  |
                    +----------v--------+  +------v----------+
                    |   Post Bridge     |  |   Composio      |
                    |   -> 9 platforms |  |   -> Reddit     |
                    +-------------------+  +-----------------+

External data sources:
  Xpoz         -> trend research (Twitter, IG, TikTok, Reddit)
  HeyGen       -> avatar video generation
  Kling AI     -> viral character video generation
  Remotion     -> data visualization video generation
  AI Gateway   -> Claude for content generation
```

### Key Design Decision: Pipeline + WDK Durability

Cron jobs are lightweight triggers that call `start(workflow)`. All real work happens inside WDK durable workflows. Each step is independently retryable. Human approval is a WDK hook that pauses the workflow indefinitely until the dashboard resumes it.

This means:
- If HeyGen times out during video generation, WDK retries that step — not the whole pipeline
- If a deploy happens mid-generation, the workflow resumes from the last completed step
- No wasted API calls on retries of already-completed steps
- Full observability into which step each run is on

---

## Database Schema

### New Tables (4)

#### `marketing_drafts` — Central content queue

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | |
| workflow_run_id | text | WDK run ID for traceability |
| hook_token | text | WDK hook token for resuming approval workflow |
| content_type | enum | `landlord_expose`, `building_horror`, `neighborhood_trend`, `tenant_rights`, `news_reaction`, `viral_humor` |
| status | enum | `generating`, `draft`, `approved`, `published`, `rejected`, `failed` |
| error_message | text | Populated when status = `failed` — step name + error details |
| source_data | jsonb | Raw data that inspired this post (building ID, violation IDs, trend data, etc.) |
| caption | text | Primary copy |
| platform_variants | jsonb | Platform-specific versions: `{ instagram: { caption, hashtags }, tiktok: { caption, hashtags }, pinterest: { title, description, board }, ... }` |
| media_urls | text[] | Generated video/image URLs (stored in Vercel Blob) |
| video_type | enum | `avatar`, `data_viz`, `viral_character`, `none` |
| published_at | timestamptz | When it went live |
| publish_results | jsonb | Per-platform post IDs/URLs from Post Bridge |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Status lifecycle:**
1. Row inserted at workflow start (Step 0) with `status = 'generating'`
2. Updated to `status = 'draft'` when all generation steps complete (Step 5)
3. Updated to `status = 'approved'` when human approves in dashboard
4. Updated to `status = 'published'` after Post Bridge confirms
5. Updated to `status = 'rejected'` if human rejects
6. Updated to `status = 'failed'` if any step exhausts retries (with `error_message`)

Dashboard shows a "Retry" button for `failed` drafts (starts a new workflow run with the same `source_data`) and a "Discard" button (deletes the row).

**Note:** `scheduled_for` is deferred to v2 — see Out of Scope.

#### `marketing_reddit_threads` — Tracked Reddit conversations

| Column | Type | Constraints | Purpose |
|--------|------|------------|---------|
| id | uuid | PK | |
| thread_id | text | UNIQUE NOT NULL | Reddit post ID — prevents duplicate drafts |
| subreddit | text | NOT NULL | |
| title | text | | |
| url | text | | |
| hook_token | text | | WDK hook token for resuming approval |
| relevance_score | float | | Claude-scored 0-1 |
| keywords_matched | text[] | | What triggered the match |
| draft_reply | text | | Claude's drafted response |
| status | enum | NOT NULL | `detected`, `draft_ready`, `approved`, `replied`, `skipped` |
| replied_at | timestamptz | | Authoritative timestamp for rate-limit enforcement |
| created_at | timestamptz | | |

**`replied_at` is the authoritative field** for determining when a reply was posted. `status = 'replied'` is set at the same time. Rate-limit queries use `replied_at` (indexed, non-null only when actually posted).

#### `marketing_trends` — Cached trend data from Xpoz

| Column | Type | Constraints | Purpose |
|--------|------|------------|---------|
| id | uuid | PK | |
| platform | text | UNIQUE NOT NULL | `twitter`, `reddit`, `tiktok`, `instagram` — one row per platform, upserted |
| trend_data | jsonb | | Raw trend payload |
| fetched_at | timestamptz | | When this data was last refreshed |

**Staleness rule:** Step 1 (`selectContentType`) re-fetches from Xpoz if `fetched_at` is older than 5 hours (slightly less than the 6-hour content cadence). Upserts by `platform` — no unbounded growth.

#### `marketing_analytics` — Post-publish performance (time-series snapshots)

| Column | Type | Constraints | Purpose |
|--------|------|------------|---------|
| id | uuid | PK | |
| draft_id | uuid | FK NOT NULL | Links to marketing_drafts |
| platform | text | NOT NULL | |
| impressions | int | | |
| engagements | int | | |
| clicks | int | | |
| fetched_at | date | NOT NULL | Date of snapshot |

**Unique constraint:** `UNIQUE(draft_id, platform, fetched_at)` — upsert on each daily pull. Stores one snapshot per platform per post per day, allowing performance tracking over time.

---

## Cron Triggers (1 new multiplexed job)

**Important:** The existing `vercel.json` already has 37 cron entries. Vercel Pro allows a maximum of 40. To preserve headroom, all marketing crons are consolidated into a single endpoint that fans out based on the current time.

| Cron | Schedule | Endpoint | What it does |
|------|----------|----------|--------------|
| Marketing dispatcher | `*/30 * * * *` | `/api/cron/marketing` | Multiplexes all marketing work |

**Dispatch logic inside `/api/cron/marketing`:**
1. **Every 30 minutes:** Start Reddit monitoring workflow run
2. **At 0:00, 6:00, 12:00, 18:00 UTC** (checked via `new Date().getUTCHours()`): Also start content generation workflow run
3. **At 0:00 UTC only:** Also start analytics pull workflow run

This uses 1 cron slot instead of 3, leaving 2 slots of headroom. The route is still thin — it just calls `start(workflow)` for whichever workflows are due, then returns 200. All real work is in WDK.

---

## Content Generation Workflow

### Steps

**Step 0: `initDraft()`**
- Inserts a row into `marketing_drafts` with `status = 'generating'` and the `workflow_run_id`
- This ensures the dashboard shows in-progress runs and can display failures
- Returns: `draftId`

**Step 1: `selectContentType()`**
- If no type specified, Claude picks based on:
  - What hasn't been posted recently (avoid repeats)
  - What's trending (Xpoz data from `marketing_trends`)
  - Time of day (humor evenings, education mornings)
- Returns: `contentType` + reasoning

**Step 2: `gatherSourceData()`**
- Queries Supabase for raw material based on content type:
  - Landlord expose: worst landlords by violation count, portfolio size
  - Building horror: buildings with spike in recent violations
  - Neighborhood trend: rent changes + violation deltas by zip
  - Tenant rights: curated topic list
  - News reaction: latest unposted articles from `news_articles` table
  - Viral humor: trending formats from Xpoz + random building data
- Returns: `sourceData` blob

**Step 3: `generateContent()`**
- Claude API (via AI Gateway) generates:
  - Primary caption
  - Platform variants (IG, TikTok, X, LinkedIn, FB, Pinterest, Threads, Bluesky, YouTube)
  - Hashtag sets per platform
  - Video script (if applicable)
  - Pinterest-specific: SEO title + keyword-rich description + suggested board
- System prompt includes brand voice guide, platform best practices, character limits
- Returns: content object with all variants

**Step 3b: `generatePinterestImage()`**
- AI image generation via AI Gateway (model TBD at implementation — confirm latest available image model)
- Creates tall infographic/data card (1000x1500px) with bold text overlays
- Upload to Vercel Blob
- Returns: Pinterest-specific image URL

**Step 4: `generateVideo()`**
- Routes based on `video_type`:
  - `avatar` -> HeyGen API (async polling pattern — see below)
  - `data_viz` -> Remotion Lambda render
  - `viral_character` -> Kling AI API (async polling pattern — see below)
  - `none` -> skip
- All results uploaded to Vercel Blob
- Returns: media URLs

**Async video polling pattern (HeyGen & Kling AI):**
Both APIs are asynchronous — you submit a job and poll for completion. Inside the WDK step:
1. Submit job, receive `jobId`
2. Poll every 30 seconds using WDK's `sleep("30s")` between checks
3. Timeout after 10 minutes — throw `RetryableError` if not complete
4. On completion, download the MP4 and upload to Vercel Blob
5. WDK's step retry handles transient failures (max 3 retries)

This keeps the step inside WDK's durable execution — if the function times out during polling, the step retries from scratch (the video API is idempotent for the same input).

**Step 5: `saveDraft()`**
- Updates the `marketing_drafts` row (created in Step 0) with all generated content, media URLs, and `status = 'draft'`
- Returns: draft ID

**Hook: `awaitApproval`**
- Workflow pauses indefinitely
- Step 5 stores the `hook_token` in the `marketing_drafts` row so the dashboard can reference it
- Dashboard shows the draft for review/edit/approve
- On approve: dashboard POSTs to `/api/marketing/approve` which calls `resumeHook`
- On reject: same endpoint with `rejected = true`, workflow ends
- On edit: dashboard updates the `marketing_drafts` row directly (caption, platform_variants), then approves

**Resume API route: `POST /api/marketing/approve`**

Request body:
```json
{
  "draftId": "uuid",
  "action": "approve" | "reject",
  "editedContent": {           // optional, only if edits were made
    "caption": "...",
    "platform_variants": {...}
  }
}
```

Logic:
1. Look up `marketing_drafts` by `draftId`, get `hook_token`
2. If `action === "approve"`: update status to `approved`, call `resumeHook(hookToken, { approved: true, editedContent })`
3. If `action === "reject"`: update status to `rejected`, call `resumeHook(hookToken, { approved: false })`
4. Workflow resumes — Step 6 reads `editedContent` from the hook payload and uses it if present

The same pattern applies to the Reddit workflow — `POST /api/marketing/approve-reddit` with `{ threadId, action, editedReply? }`.

**Step 6: `publish()`**
- Calls Post Bridge API with platform variants + media
- Updates draft `status = 'published'`
- Stores per-platform post IDs in `publish_results`
- Returns: publish confirmation

### Content Type Rotation Logic

- No same content type back-to-back
- At least 1 humor post per day
- News reaction gets priority when a relevant article is < 4 hours old
- Tenant rights at least 2x/week (evergreen, high save rate)

### Brand Voice Rules (Claude system prompt)

- **Tone:** Informative but punchy. Data-first. Never fear-mongering — empowering.
- **CTA pattern:** Always ends with soft CTA: "Check your building free at lucidrents.com"
- **Humor posts:** Absurdist but factual — the data is real, the delivery is funny.
- **Platform tuning:**
  - TikTok/Reels: Hook in first 2 seconds, under 60 seconds, trending audio references
  - X: Sharp one-liner + data point + link
  - LinkedIn: Professional angle — "housing transparency" framing
  - Pinterest: Search-optimized, infographic style (see Pinterest Strategy)
  - Reddit: NO promotional tone. Genuinely helpful. Link only if natural.

---

## Pinterest Strategy

Pinterest is a search engine, not a feed. Content has ~4-month lifespan vs. 24 hours on TikTok/X.

### Pin Types

| Pin Type | Example | Search Intent |
|----------|---------|---------------|
| Infographic | "10 Red Flags Before Signing a Lease in NYC" | Apartment hunting research |
| Data card | "Average Rent by NYC Neighborhood — March 2026" | Market research |
| Checklist | "Your Move-In Inspection Checklist" | Actionable tenant tools |
| Stat graphic | "Top 5 Most Violated Buildings in Brooklyn" | Curiosity/shareability |
| Quote card | Tenant rights fact with bold typography | Education/saves |

### Board Strategy (pre-configured, Claude selects per post)

- "NYC Apartment Tips" — tenant rights, checklists
- "NYC Rental Market Data" — trends, rent maps, stats
- "Landlord Red Flags" — exposes, violation data
- "LA Renter's Guide" / "Chicago Renter's Guide" — city-specific
- "Apartment Hunting Checklist" — evergreen, high search volume

### Pinterest SEO

Descriptions are keyword-rich (200-500 chars). Target keywords per city:
- NYC: "NYC apartments", "apartment red flags", "landlord violations", "rent stabilized apartments", "tenant rights NYC"
- LA: "LA rentals", "LAHD violations", "Los Angeles apartment tips", "LA renter rights"
- Chicago: "Chicago apartments", "Chicago building violations", "RLTO", "Chicago tenant rights"

### Cadence

1-2 pins/day (not all 4 content runs). Step 1 (`selectContentType`) tracks how many Pinterest pins were generated today. If >= 2, Step 3b is skipped for that run — the broadcast post still publishes to other platforms but Pinterest is omitted. This keeps Pinterest consistent without over-posting.

---

## Reddit Monitoring & Reply Workflow

### Target Subreddits

**NYC:** r/NYCapartments, r/AskNYC, r/nycrentals, r/NYCinfohub
**LA:** r/AskLosAngeles, r/LosAngeles, r/LArentals
**Chicago:** r/chicago, r/chicagoapartments
**General:** r/realestate, r/FirstTimeHomeBuyer, r/Tenant, r/renters, r/personalfinance (housing threads only)

### Workflow Steps

**Step 1: `scanSubreddits()`**
- Uses Reddit MCP to pull new/hot/rising posts from all target subreddits since last scan
- Keyword filter: violations, landlord, lease, HPD, LAHD, building complaints, rent stabilized, tenant rights, 311, apartment search, moving to [city], bad landlord
- Returns: `candidateThreads[]`

**Step 2: `scoreRelevance()`**
- Claude scores each candidate 0-1:
  - Direct relevance to LucidRents data (0.3 weight)
  - Opportunity to add genuine value (0.3 weight)
  - Thread activity/visibility (0.2 weight)
  - Natural fit for mentioning lucidrents.com (0.2 weight)
- Threshold: < 0.5 dropped
- Dedupes against `marketing_reddit_threads`
- Returns: `scoredThreads[]`

**Step 3: `draftReplies()`**
- Claude drafts a reply per qualifying thread
- Rules:
  - Lead with genuine help. Answer their question first.
  - Include specific data when possible ("that building at 123 Main St has 47 open violations per HPD records")
  - Only mention LucidRents if natural — never forced
  - Match subreddit tone (r/AskNYC = blunt, r/personalfinance = measured, r/Tenant = empathetic)
  - Never fake being a tenant. Transparent: "I built a tool that tracks this data"
- Returns: `drafts[]`

**Step 4: `saveDrafts()`**
- Inserts into `marketing_reddit_threads` with `status = 'draft_ready'`

**Hook: `awaitRedditApproval`** (per draft)
- Each reply appears in dashboard separately
- Shows: original thread + top comments + drafted reply
- Approve / Edit / Skip

**Step 5: `postReply()`**
- Composio Reddit MCP posts the approved reply
- Updates status to `replied`

### Rate Limiting & Safety

| Rule | Limit | Why |
|------|-------|-----|
| Max replies per day | 5 | Shadowban prevention |
| Min time between replies | 15 minutes | Looks organic |
| Max replies per subreddit/day | 2 | Don't dominate one community |
| Cool-off after rejection | Skip next scan cycle | If 3+ rejected in a row, targeting is off |
| Account age requirement | 30+ days with organic karma | New accounts get filtered |

**Enforcement mechanism:** Rate limits are enforced via queries against `marketing_reddit_threads` at two points:

1. **Step 2 (`scoreRelevance`)** — before scoring, check:
   - `SELECT COUNT(*) FROM marketing_reddit_threads WHERE replied_at >= CURRENT_DATE AND status = 'replied'` — if >= 5, skip entire run (daily limit hit)
   - Same query grouped by `subreddit` — skip threads in subreddits already at 2/day

2. **Step 5 (`postReply`)** — before posting, re-check with `SELECT FOR UPDATE`:
   - Re-verify daily count < 5 and subreddit count < 2 (guards against concurrent workflow runs)
   - Check `MAX(replied_at)` — if < 15 minutes ago, use WDK `sleep()` to wait the difference
   - This is a DB-level lock that prevents two concurrent Reddit workflows from both posting when only 1 slot remains

**Index:** `CREATE INDEX idx_reddit_threads_replied ON marketing_reddit_threads (replied_at) WHERE replied_at IS NOT NULL` — fast rate-limit lookups.

---

## Marketing Dashboard (`/admin/marketing`)

### Layout

```
/admin/marketing
+-- Tab: Content Queue    <- broadcast posts awaiting review
+-- Tab: Reddit           <- Reddit reply drafts
+-- Tab: Analytics        <- post-publish performance
```

### Content Queue Tab

**List view** — table sorted by `created_at` desc:

| Status | Type | Content Preview | Video | Platforms | Created | Actions |
|--------|------|----------------|-------|-----------|---------|---------|
| Draft | Landlord Expose | "This Bushwick landlord owns 47..." | Avatar | All 9 | 2m ago | Review |
| Draft | Viral Humor | "AI strawberry discovers your..." | Kling | TikTok, IG, YT | 1h ago | Review |
| Published | Neighborhood Trend | "Rent in Astoria dropped 6%..." | None | All 9 | 3h ago | View Results |

**Review modal** — full-screen on click:
- Left panel: Primary caption (editable) + hashtags
- Right panel: Platform variant tabs (IG, TikTok, X, LinkedIn, Pinterest, etc.) — each editable
- Bottom panel: Video/image preview (playable/zoomable)
- Source data section: Collapsible — shows what data generated this post with links to LucidRents pages
- Action bar: `Approve & Publish` | `Edit` | `Reject` | `Reschedule`

**Batch action bar** (when 2+ drafts ready):
```
3 drafts ready  ·  [ Review All ] [ Approve All ]
```
"Approve All" triggers `resumeHook` for each. Publishes with 2-minute gaps to avoid spam detection.

### Reddit Tab

Card-based layout per opportunity:
- Subreddit + thread title + age + relevance score
- Top 2-3 comments for context
- Editable draft reply
- Approve / Edit / Skip buttons

### Analytics Tab

- Summary cards: posts published (7d/30d), total impressions, total engagements, top post
- Table: each post with per-platform impressions/engagements/clicks
- Clickable for platform-specific breakdown

### Access Control

Behind existing Supabase auth. Gated to admin users via env var allowlist of admin user IDs (`MARKETING_ADMIN_IDS`). No new auth system.

---

## External Integrations

### Post Bridge ($14/mo)

- **Role:** Multi-platform publishing (all 9 broadcast platforms in one API call)
- **Integration:** Step 6 (`publish`) in content workflow
- **Auth:** `POST_BRIDGE_API_KEY` env var
- **Payload:** Per-platform content variants + media URLs
- **Returns:** Per-platform post IDs/URLs for analytics

### Xpoz MCP ($20/mo Pro)

- **Role:** Trend research across Twitter, Instagram, TikTok, Reddit
- **Integration:** Steps 1-2 in content workflow (inform content selection + gather trending hooks)
- **Cached:** In `marketing_trends` table, refreshed before each content run
- **Volume:** ~100 queries/day, fits Pro tier (1M results/mo)

### HeyGen ($24/mo Creator)

- **Role:** AI avatar video generation
- **Integration:** Step 4 when `video_type === 'avatar'`
- **Flow:** Send script + avatar ID -> async job (2-5 min) -> download MP4 -> Vercel Blob
- **Config:** 1-2 consistent avatar personas for brand recognition
- **Length:** 30-60 seconds (TikTok/Reels optimal)

### Kling AI (~$25/mo Pro)

- **Role:** Viral character video generation (AI fruits/objects)
- **Integration:** Step 4 when `video_type === 'viral_character'`
- **Flow:** Send character prompt + scenario -> async (1-3 min) -> download -> Vercel Blob
- **Characters:** Rotated (strawberry, avocado, orange, etc.) + LucidRents data as the punchline

### Remotion (free, self-hosted)

- **Role:** Programmatic data visualization videos
- **Integration:** Step 4 when `video_type === 'data_viz'`
- **Templates (v1):**
  - ViolationTimeline — animated violations stacking up
  - RentTrend — line chart of neighborhood rent over time
  - LandlordPortfolio — map pins appearing for each building owned
  - NeighborhoodCompare — side-by-side bars for 2 neighborhoods
  - StatCounter — big number counting up with context
- **Rendering:** Remotion Lambda (AWS serverless) in production, local Remotion CLI for dev
- **AWS requirements:** IAM role with Lambda + S3 permissions, `REMOTION_AWS_REGION`, `REMOTION_SERVE_URL`, `REMOTION_S3_BUCKET` env vars
- **Cost:** Remotion Lambda is ~$0.005/render at 10-30s videos — negligible at 4 runs/day (~$0.60/mo)

### Reddit MCP — mcp-server-reddit (free)

- **Role:** Read-only subreddit monitoring
- **Integration:** Step 1 in Reddit workflow
- **Setup:** uvx-based MCP server, no auth needed for public subreddits

### Composio Reddit MCP (free tier)

- **Role:** Write access — post comments
- **Integration:** Step 5 in Reddit workflow (only after human approval)
- **Setup:** OAuth connects your Reddit account
- **Scope:** Comment posting only (no upvoting, no post creation)

---

## Observability

### Workflow Events (via `getWritable()`)

| Event Type | When | Data |
|------------|------|------|
| `content_type_selected` | Step 1 complete | type, reasoning |
| `source_data_gathered` | Step 2 complete | building/landlord IDs, summary |
| `content_generated` | Step 3 complete | caption preview, platform count |
| `pinterest_image_generated` | Step 3b complete | image URL |
| `video_generating` | Step 4 started | video_type, tool |
| `video_complete` | Step 4 complete | media URL, duration |
| `draft_saved` | Step 5 complete | draft ID |
| `awaiting_approval` | Hook created | hook token, draft ID |
| `published` | Step 6 complete | platform results |
| `step_failed` | Any step fails | step name, error, retry count |

### Dashboard Activity Sidebar

Real-time pipeline status visible on the marketing page:
```
* Generating content... (landlord expose)
* Video rendering... (Kling AI - viral character)
[check] Draft saved - awaiting your review
```

### Structured Logging

Every step logs entry/exit with timing:
```json
{ "level": "info", "msg": "step_complete", "step": "generateVideo", "video_type": "viral_character", "tool": "kling", "ms": 45200 }
```

### Failure Alerts

If a workflow step fails 3 times (exhausts retries), email notification via Resend to admin address with step name, error, and draft ID. Draft stays in `generating` status with error badge in dashboard.

---

## Claude Code Commands

### `/social` — Ad-hoc content generation

```
/social "That landlord on the front page of r/nyc just got sued"
```

Fast lane for reactive content. **Requires the operator to be in the `MARKETING_ADMIN_IDS` allowlist** (same auth as the dashboard). The command:
1. Takes prompt as creative brief
2. Pulls relevant Supabase data
3. Generates content + platform variants
4. Shows preview in terminal
5. On approval, saves to `marketing_drafts` with `status = 'draft'` and creates a WDK workflow that starts at the approval hook — so it still goes through the standard `resumeHook` → publish flow, just with the terminal as the approval UI instead of the dashboard

### `/reddit-check` — Reddit monitoring status

```
/reddit-check
```

Shows pending reply drafts, today's reply count, recent matches. Links to dashboard.

---

## Cost Summary

| Tool | Monthly Cost | Role |
|------|-------------|------|
| Post Bridge | $14 | Multi-platform publishing |
| Xpoz MCP | $20 | Trend research |
| HeyGen | $24 | AI avatar videos |
| Kling AI | $25 | Viral character videos |
| Remotion | Free | Data viz videos |
| Reddit MCP | Free | Subreddit monitoring |
| Composio Reddit | Free | Reddit reply posting |
| **Total** | **$83/mo** | |

---

## Out of Scope (v1)

- Automated likes/follows (penalized in 2026, explicitly excluded)
- Direct message automation
- Blotato scheduling (redundant — WDK + Post Bridge covers this)
- Character animation tools beyond Kling AI (can add Hedra/Viggle later)
- A/B testing of post variants (future enhancement)
- Multi-account Reddit posting
- Paid ad management
- Scheduled/queued publishing (`scheduled_for` column deferred to v2)
