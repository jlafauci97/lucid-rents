---
description: Check Reddit monitoring status — pending drafts, today's reply count, recent matches
user_invocable: true
---

# /reddit-check — Reddit Monitoring Status

Quick terminal check of the Reddit monitoring pipeline without opening the dashboard.

## Workflow

1. **Fetch pending drafts** — query Supabase for Reddit threads awaiting review:
   ```sql
   SELECT subreddit, title, url, relevance_score, created_at
   FROM marketing_reddit_threads
   WHERE status = 'draft_ready'
   ORDER BY relevance_score DESC
   LIMIT 10
   ```

2. **Fetch today's reply count** — check against the 5/day limit:
   ```sql
   SELECT count(*) as replied_today
   FROM marketing_reddit_threads
   WHERE status = 'replied'
   AND replied_at >= CURRENT_DATE
   ```

3. **Fetch recent matches** — show what the scanner found recently:
   ```sql
   SELECT subreddit, title, status, relevance_score, created_at
   FROM marketing_reddit_threads
   WHERE created_at >= now() - interval '24 hours'
   ORDER BY created_at DESC
   LIMIT 5
   ```

4. **Display summary** in terminal:

```
Reddit Monitoring Status
========================
Pending drafts: X replies awaiting your review
Today's replies: X / 5 daily limit
Last 24h matches: X threads detected

Pending Drafts:
| Subreddit      | Title                          | Score | Age    |
|----------------|--------------------------------|-------|--------|
| r/AskNYC       | Anyone know about 123 Main St  | 0.82  | 15m    |
| r/NYCapartments| Landlord refusing repairs       | 0.71  | 1h     |

Review at: https://lucidrents.com/dashboard/mission-control/marketing (Reddit tab)
```

## Notes

- Use the Supabase MCP `execute_sql` tool for all queries.
- Use the project ID from the environment or from `list_projects`.
- If no pending drafts, show "All clear — no pending Reddit replies."
- If today's replies are at 5/5, note: "Daily limit reached — next replies available tomorrow."
