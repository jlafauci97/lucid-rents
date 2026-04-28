---
description: Run the Reddit scanner from the user's Mac (Reddit blocks Vercel + GitHub Actions egress). Fetches new posts from target subreddits, POSTs candidates to /api/marketing/reddit/draft-batch, drafts land in Supabase as draft_ready for the marketing dashboard.
user_invocable: true
---

# /reddit-scan — Run the Reddit Scanner Locally

Run the scanner from the user's machine, since Reddit's residential IP isn't blocked. This is the same script that previously ran on GitHub Actions, just invoked locally.

## When to use

- The marketing dashboard's Reddit queue is empty and you want fresh drafts.
- After /reddit-check shows "All clear — no pending Reddit replies."
- The launchd job (com.lucidrents.reddit-scan) is normally the source of fresh drafts every 6h. Use this skill for ad-hoc runs in between, or if launchd is paused/disabled.

## Workflow

1. Run the wrapper script from the repo root. It sources `.env.local`, sets `BASE_URL`, and invokes `scripts/scan-and-draft-reddit.mjs`:

   ```bash
   bash /Users/jesselafauci/Desktop/lucid-rents/scripts/reddit-scan-local.sh
   ```

   For a dry run (scan + log candidates, do not POST to Vercel):

   ```bash
   bash /Users/jesselafauci/Desktop/lucid-rents/scripts/reddit-scan-local.sh --dry
   ```

2. Read the script output:
   - Per-subreddit lines like `[scan] r/AskNYC -> 25 posts, 3 matches`
   - A total: `[scan] total N keyword-matching candidates`
   - If N > 0, a POST line: `[post] 200 {...}` from the draft-batch endpoint
   - If every subreddit logs `HTTP 403`, Reddit has now blocked the user's home IP too — fall back to the Chrome-driven approach (likely needs a new skill).

3. After a successful run, recommend `/reddit-check` to view the new draft_ready rows in Supabase.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `FATAL: CRON_SECRET not set` | `.env.local` missing the value | Pull from Vercel: `vercel env pull .env.local` |
| `[scan] r/X -> HTTP 403` for every sub | Reddit blocking home IP | Try a VPN, or switch to Chrome-driven scan |
| `[scan] r/X -> HTTP 429` | Rate-limited (rare from a single Mac) | Wait an hour, rerun |
| `draft-batch returned 401` | `CRON_SECRET` mismatch with Vercel | Re-pull env vars |
| `draft-batch returned 5xx` | Vercel function error | Check `vercel logs --no-branch -q "/api/marketing/reddit/draft-batch"` |

## Notes

- The script defaults to a 6-hour lookback window, matching the launchd cadence. Override with `REDDIT_LOOKBACK_HOURS=24` for a wider sweep.
- The script dedupes against Supabase via the draft-batch endpoint, so running twice in quick succession is safe — repeats are dropped.
- Posting still happens via /reddit-post (driving the user's Chrome). This skill only populates the draft queue.
