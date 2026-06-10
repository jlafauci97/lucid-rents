import {
  getWritable,
  defineHook,
  sleep,
  RetryableError,
} from "workflow";

// Types
import type {
  MarketingWorkflowEvent,
  MarketingRedditThread,
} from "@/types/marketing";

// DB queries
import {
  saveRedditThread,
  listRedditThreads,
  updateRedditThread,
  getRedditDailyCount,
} from "@/lib/marketing/supabase-queries";

// Rate-limit helpers
import {
  canPostToday,
  canPostToSubreddit,
  getWaitTimeSeconds,
} from "@/lib/marketing/reddit";

// Brand voice / scan config
import {
  TARGET_SUBREDDITS,
  REDDIT_KEYWORDS,
  GENERAL_SUBREDDITS,
} from "@/lib/marketing/brand-voice";

// Geo gates (shared with the GitHub Actions scanner path)
import {
  hasUnsupportedStateTag,
  mentionsSupportedMetro,
} from "@/lib/marketing/reddit-geo";

// LLM scoring + drafting (shared with /api/marketing/reddit/draft-batch)
import {
  scoreThreadRelevance,
  lookupBuildingContext,
  draftRedditReply,
} from "@/lib/marketing/reddit-ai";

// ---------------------------------------------------------------------------
// Types local to this workflow
// ---------------------------------------------------------------------------

interface RedditCandidate {
  threadId: string;
  subreddit: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  numComments: number;
}

interface ScoredCandidate extends RedditCandidate {
  relevanceScore: number;
  keywordsMatched: string[];
}

interface DraftEntry {
  threadId: string;
  subreddit: string;
  title: string;
  url: string;
  draftReply: string;
  relevanceScore: number;
  keywordsMatched: string[];
  selftext: string;
  postScore: number;
  numComments: number;
}

interface SavedDraft {
  id: string;
  hookToken: string;
  subreddit: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitEvent(event: MarketingWorkflowEvent): void {
  const writer = getWritable<MarketingWorkflowEvent>().getWriter();
  try {
    writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Hook: Reddit reply approval
// ---------------------------------------------------------------------------

export const redditApprovalHook = defineHook<{
  approved: boolean;
  editedReply?: string;
}>();

// ---------------------------------------------------------------------------
// Step 1 - Scan subreddits for relevant threads
// ---------------------------------------------------------------------------

async function scanSubreddits(): Promise<RedditCandidate[]> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "scanSubreddits", event: "start" }));

  const allSubreddits = [
    ...TARGET_SUBREDDITS.nyc,
    ...TARGET_SUBREDDITS["los-angeles"],
    ...TARGET_SUBREDDITS.chicago,
    ...TARGET_SUBREDDITS.miami,
    ...TARGET_SUBREDDITS.houston,
    ...TARGET_SUBREDDITS.general,
  ];

  const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
  const keywordsLower = REDDIT_KEYWORDS.map((k) => k.toLowerCase());
  const candidates: RedditCandidate[] = [];

  for (const subreddit of allSubreddits) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
        {
          headers: {
            "User-Agent": "LucidRents/1.0 (marketing-monitor)",
          },
        }
      );

      if (!res.ok) {
        console.log(
          JSON.stringify({
            step: "scanSubreddits",
            event: "fetch_error",
            subreddit,
            status: res.status,
          })
        );
        continue;
      }

      const json = await res.json();
      const posts = json?.data?.children ?? [];

      for (const post of posts) {
        const d = post.data;
        if (!d || d.created_utc < twoHoursAgo) continue;

        const titleRaw = d.title ?? "";
        const selftextRaw = d.selftext ?? "";
        const titleLower = titleRaw.toLowerCase();
        const selftextLower = selftextRaw.toLowerCase();
        const combined = titleLower + " " + selftextLower;

        const matched = keywordsLower.some((kw) => combined.includes(kw));
        if (!matched) continue;

        // Hard reject: explicit out-of-state tag like "[MI]" or "[OR]".
        if (hasUnsupportedStateTag(titleRaw, selftextRaw)) continue;

        // Posts from national subs (r/renters, r/Tenant, r/realestate, etc.)
        // must explicitly mention one of our metros, otherwise we drown in
        // out-of-state content.
        if (
          GENERAL_SUBREDDITS.has(subreddit) &&
          !mentionsSupportedMetro(titleRaw, selftextRaw)
        ) {
          continue;
        }

        candidates.push({
          threadId: d.name ?? d.id, // fullname e.g. t3_abc123
          subreddit,
          title: titleRaw,
          url: `https://www.reddit.com${d.permalink ?? ""}`,
          selftext: selftextRaw.slice(0, 2000), // cap for prompt size
          score: d.score ?? 0,
          numComments: d.num_comments ?? 0,
        });
      }

      // Brief pause between subreddits to respect Reddit rate limits
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.log(
        JSON.stringify({
          step: "scanSubreddits",
          event: "subreddit_error",
          subreddit,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      // Continue scanning other subreddits
    }
  }

  console.log(
    JSON.stringify({
      step: "scanSubreddits",
      event: "done",
      candidateCount: candidates.length,
      subredditsScanned: allSubreddits.length,
      ms: Date.now() - t0,
    })
  );

  if (candidates.length === 0 && allSubreddits.length > 0) {
    // If we got zero results from ALL subreddits, Reddit API may be down
    const testRes = await fetch("https://www.reddit.com/r/all/new.json?limit=1", {
      headers: { "User-Agent": "LucidRents/1.0 (marketing-monitor)" },
    }).catch(() => null);

    if (!testRes || !testRes.ok) {
      throw new RetryableError("Reddit API appears to be down (all subreddits returned 0 results)");
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Step 2 - Score relevance + check rate limits
// ---------------------------------------------------------------------------

async function scoreRelevance(
  candidates: RedditCandidate[]
): Promise<ScoredCandidate[]> {
  "use step";
  const t0 = Date.now();
  console.log(
    JSON.stringify({
      step: "scoreRelevance",
      event: "start",
      candidateCount: candidates.length,
    })
  );

  // Check daily limit first
  const dailyOk = await canPostToday();
  if (!dailyOk) {
    console.log(
      JSON.stringify({
        step: "scoreRelevance",
        event: "daily_limit_hit",
        ms: Date.now() - t0,
      })
    );
    return [];
  }

  // Dedup against existing threads in DB
  const existingThreads = await listRedditThreads();
  const existingIds = new Set(existingThreads.map((t) => t.thread_id));

  const freshCandidates = candidates.filter(
    (c) => !existingIds.has(c.threadId)
  );

  if (freshCandidates.length === 0) {
    console.log(
      JSON.stringify({
        step: "scoreRelevance",
        event: "all_duplicates",
        ms: Date.now() - t0,
      })
    );
    return [];
  }

  // Filter by subreddit rate limits
  const subredditChecked: RedditCandidate[] = [];
  for (const c of freshCandidates) {
    const subOk = await canPostToSubreddit(c.subreddit);
    if (subOk) {
      subredditChecked.push(c);
    }
  }

  if (subredditChecked.length === 0) {
    console.log(
      JSON.stringify({
        step: "scoreRelevance",
        event: "all_subreddits_maxed",
        ms: Date.now() - t0,
      })
    );
    return [];
  }

  // Score each candidate via Claude (shared scorer — same geo kill +
  // threshold as the draft-batch endpoint).
  const keywordsLower = REDDIT_KEYWORDS.map((k) => k.toLowerCase());
  const scored: ScoredCandidate[] = [];

  for (const candidate of subredditChecked) {
    try {
      const relevance = await scoreThreadRelevance(candidate);

      if (!relevance) {
        console.log(
          JSON.stringify({
            step: "scoreRelevance",
            event: "parse_error",
            threadId: candidate.threadId,
          })
        );
        continue;
      }

      if (!relevance.qualified) {
        // geoMatch < 0.5 means the post is about a metro we don't cover (or
        // no metro at all) — a strong directRelevance score can't drag a
        // Denver post over the line.
        console.log(
          JSON.stringify({
            step: "scoreRelevance",
            event:
              relevance.geoMatch < 0.5 ? "geo_mismatch" : "below_threshold",
            threadId: candidate.threadId,
            score: relevance.weighted,
            geoMatch: relevance.geoMatch,
          })
        );
        continue;
      }

      // Determine which keywords matched
      const combinedText =
        (candidate.title + " " + candidate.selftext).toLowerCase();
      const matched = keywordsLower.filter((kw) => combinedText.includes(kw));

      scored.push({
        ...candidate,
        relevanceScore: relevance.weighted,
        keywordsMatched: matched,
      });
    } catch (err) {
      // Log and skip this candidate, don't fail the whole workflow
      console.log(
        JSON.stringify({
          step: "scoreRelevance",
          event: "scoring_error",
          threadId: candidate.threadId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(
    JSON.stringify({
      step: "scoreRelevance",
      event: "done",
      qualifiedCount: scored.length,
      ms: Date.now() - t0,
    })
  );
  return scored;
}

// ---------------------------------------------------------------------------
// Step 3 - Draft replies
// ---------------------------------------------------------------------------

async function draftReplies(
  qualified: ScoredCandidate[]
): Promise<DraftEntry[]> {
  "use step";
  const t0 = Date.now();
  console.log(
    JSON.stringify({
      step: "draftReplies",
      event: "start",
      count: qualified.length,
    })
  );

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const drafts: DraftEntry[] = [];

  for (const thread of qualified) {
    try {
      // Look up relevant building data if an address-like pattern exists
      const buildingContext = await lookupBuildingContext(
        supabase,
        thread.title + " " + thread.selftext
      );

      const reply = await draftRedditReply(thread, buildingContext);

      drafts.push({
        threadId: thread.threadId,
        subreddit: thread.subreddit,
        title: thread.title,
        url: thread.url,
        draftReply: reply,
        relevanceScore: thread.relevanceScore,
        keywordsMatched: thread.keywordsMatched,
        selftext: thread.selftext,
        postScore: thread.score,
        numComments: thread.numComments,
      });
    } catch (err) {
      console.log(
        JSON.stringify({
          step: "draftReplies",
          event: "draft_error",
          threadId: thread.threadId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      // Skip this thread, continue with others
    }
  }

  console.log(
    JSON.stringify({
      step: "draftReplies",
      event: "done",
      draftCount: drafts.length,
      ms: Date.now() - t0,
    })
  );
  return drafts;
}

// ---------------------------------------------------------------------------
// Step 4 - Save drafts to DB
// ---------------------------------------------------------------------------

async function saveDrafts(drafts: DraftEntry[]): Promise<SavedDraft[]> {
  "use step";
  const t0 = Date.now();
  console.log(
    JSON.stringify({ step: "saveDrafts", event: "start", count: drafts.length })
  );

  const saved: SavedDraft[] = [];

  for (const draft of drafts) {
    const hookToken = `reddit:${crypto.randomUUID()}`;

    const row = await saveRedditThread({
      threadId: draft.threadId,
      subreddit: draft.subreddit,
      title: draft.title,
      url: draft.url,
      relevanceScore: draft.relevanceScore,
      keywordsMatched: draft.keywordsMatched,
      draftReply: draft.draftReply,
      hookToken,
      status: "draft_ready",
      selftext: draft.selftext,
      postScore: draft.postScore,
      numComments: draft.numComments,
    });

    if (row) {
      saved.push({
        id: row.id,
        hookToken,
        subreddit: row.subreddit,
      });
    } else {
      console.log(
        JSON.stringify({
          step: "saveDrafts",
          event: "duplicate_skipped",
          threadId: draft.threadId,
        })
      );
    }
  }

  console.log(
    JSON.stringify({
      step: "saveDrafts",
      event: "done",
      savedCount: saved.length,
      ms: Date.now() - t0,
    })
  );
  return saved;
}

// ---------------------------------------------------------------------------
// Step helper - Emit awaiting-approval event
// ---------------------------------------------------------------------------

async function emitAwaitingApproval(
  id: string,
  hookToken: string
): Promise<void> {
  "use step";
  console.log(
    JSON.stringify({
      step: "emitAwaitingApproval",
      event: "start",
      draftId: id,
    })
  );

  emitEvent({ type: "awaiting_approval", hookToken, draftId: id });

  console.log(
    JSON.stringify({
      step: "emitAwaitingApproval",
      event: "done",
      draftId: id,
    })
  );
}

// ---------------------------------------------------------------------------
// Step helper - Mark thread as skipped
// ---------------------------------------------------------------------------

async function markSkipped(id: string): Promise<void> {
  "use step";
  console.log(
    JSON.stringify({ step: "markSkipped", event: "start", id })
  );
  await updateRedditThread(id, { status: "skipped" });
  console.log(
    JSON.stringify({ step: "markSkipped", event: "done", id })
  );
}

// ---------------------------------------------------------------------------
// Step 5 - Post reply to Reddit
// ---------------------------------------------------------------------------

// Reddit posting is handled out-of-band by scripts/post-reddit-queue.mjs,
// which drives the user's logged-in Chrome session. Approval sets
// status='approved'; the browser poster picks approved rows up, posts, and
// transitions them to 'replied'. This step only persists an edited reply so
// the browser poster reads the final text, and enforces rate limits happen
// there (not here).
async function postReply(
  id: string,
  subreddit: string,
  editedReply?: string
): Promise<void> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "postReply", event: "start", id }));

  if (editedReply) {
    await updateRedditThread(id, { draftReply: editedReply });
  }

  console.log(
    JSON.stringify({
      step: "postReply",
      event: "queued_for_browser",
      id,
      subreddit,
      ms: Date.now() - t0,
    })
  );
}

// ---------------------------------------------------------------------------
// Main workflow
// ---------------------------------------------------------------------------

export async function redditMonitorWorkflow(): Promise<void> {
  "use workflow";

  console.log("[redditMonitorWorkflow] START");

  // Step 1: Scan subreddits for relevant threads
  const candidates = await scanSubreddits();
  console.log(
    `[redditMonitorWorkflow] scan done, ${candidates.length} candidates`
  );

  if (candidates.length === 0) {
    console.log("[redditMonitorWorkflow] no candidates, exiting");
    return;
  }

  // Step 2: Score relevance + check rate limits
  const qualified = await scoreRelevance(candidates);
  console.log(
    `[redditMonitorWorkflow] scored, ${qualified.length} qualified`
  );

  if (qualified.length === 0) {
    console.log("[redditMonitorWorkflow] none qualified, exiting");
    return;
  }

  // Step 3: Draft replies via Claude
  const drafts = await draftReplies(qualified);
  console.log(`[redditMonitorWorkflow] drafted ${drafts.length} replies`);

  if (drafts.length === 0) {
    console.log("[redditMonitorWorkflow] no drafts produced, exiting");
    return;
  }

  // Step 4: Save drafts to DB
  const savedDrafts = await saveDrafts(drafts);
  console.log(
    `[redditMonitorWorkflow] saved ${savedDrafts.length} drafts`
  );

  // For each saved draft: wait for approval, then post
  for (const draft of savedDrafts) {
    // Create the approval hook
    const hook = redditApprovalHook.create({
      token: draft.hookToken,
    });

    // Emit awaiting event so the dashboard knows
    await emitAwaitingApproval(draft.id, draft.hookToken);

    // Wait for human decision
    const result = await hook;

    if (!result.approved) {
      console.log(
        `[redditMonitorWorkflow] draft ${draft.id} skipped by reviewer`
      );
      await markSkipped(draft.id);
      continue;
    }

    // Approved -- enforce rate limit wait if needed
    const waitSeconds = await getWaitBeforePost();
    if (waitSeconds > 0) {
      console.log(
        `[redditMonitorWorkflow] waiting ${waitSeconds}s before posting ${draft.id}`
      );
      await sleep(waitSeconds);
    }

    // Post the reply
    await postReply(draft.id, draft.subreddit, result.editedReply);
    console.log(`[redditMonitorWorkflow] posted reply for ${draft.id}`);
  }

  console.log("[redditMonitorWorkflow] DONE");
}

// ---------------------------------------------------------------------------
// Step helper - Get wait time (used from workflow context via step)
// ---------------------------------------------------------------------------

async function getWaitBeforePost(): Promise<number> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "getWaitBeforePost", event: "start" }));

  const seconds = await getWaitTimeSeconds();

  console.log(
    JSON.stringify({
      step: "getWaitBeforePost",
      event: "done",
      waitSeconds: seconds,
      ms: Date.now() - t0,
    })
  );
  return seconds;
}
