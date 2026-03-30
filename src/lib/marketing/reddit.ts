import {
  getRedditDailyCount,
  getRedditSubredditCount,
  getLastReplyTimestamp,
} from "./supabase-queries";

const MAX_DAILY_REPLIES = 5;
const MAX_PER_SUBREDDIT = 2;
const MIN_GAP_MINUTES = 15;

/** Check if we can post any more replies today. */
export async function canPostToday(): Promise<boolean> {
  const count = await getRedditDailyCount();
  return count < MAX_DAILY_REPLIES;
}

/** Check if we can post to a specific subreddit today. */
export async function canPostToSubreddit(subreddit: string): Promise<boolean> {
  const count = await getRedditSubredditCount(subreddit);
  return count < MAX_PER_SUBREDDIT;
}

/** Get seconds to wait before next post is allowed (15-min gap). Returns 0 if can post now. */
export async function getWaitTimeSeconds(): Promise<number> {
  const lastReply = await getLastReplyTimestamp();
  if (!lastReply) return 0;

  const minGapMs = MIN_GAP_MINUTES * 60 * 1000;
  const elapsed = Date.now() - lastReply.getTime();
  const remaining = minGapMs - elapsed;

  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Check all rate limits at once. Returns { canPost, reason } */
export async function checkAllLimits(subreddit: string): Promise<{
  canPost: boolean;
  reason?: string;
  waitSeconds?: number;
}> {
  if (!(await canPostToday())) {
    return { canPost: false, reason: `Daily limit reached (${MAX_DAILY_REPLIES}/day)` };
  }
  if (!(await canPostToSubreddit(subreddit))) {
    return { canPost: false, reason: `Subreddit limit reached for r/${subreddit} (${MAX_PER_SUBREDDIT}/day)` };
  }
  const waitSeconds = await getWaitTimeSeconds();
  if (waitSeconds > 0) {
    return { canPost: false, reason: `Must wait ${waitSeconds}s (${MIN_GAP_MINUTES}min gap)`, waitSeconds };
  }
  return { canPost: true };
}

// Export constants for use in workflow logging
export { MAX_DAILY_REPLIES, MAX_PER_SUBREDDIT, MIN_GAP_MINUTES };
