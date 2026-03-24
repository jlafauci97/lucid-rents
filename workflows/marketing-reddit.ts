import {
  getWritable,
  defineHook,
  sleep,
  FatalError,
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
  checkAllLimits,
} from "@/lib/marketing/reddit";

// Brand voice
import {
  REDDIT_SYSTEM_PROMPT,
  getSubredditTone,
  TARGET_SUBREDDITS,
  REDDIT_KEYWORDS,
} from "@/lib/marketing/brand-voice";

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

        const titleLower = (d.title ?? "").toLowerCase();
        const selftextLower = (d.selftext ?? "").toLowerCase();
        const combined = titleLower + " " + selftextLower;

        const matched = keywordsLower.some((kw) => combined.includes(kw));
        if (!matched) continue;

        candidates.push({
          threadId: d.name ?? d.id, // fullname e.g. t3_abc123
          subreddit,
          title: d.title ?? "",
          url: `https://www.reddit.com${d.permalink ?? ""}`,
          selftext: (d.selftext ?? "").slice(0, 2000), // cap for prompt size
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

  // Score each candidate via Claude
  const { generateText } = await import("ai");
  const keywordsLower = REDDIT_KEYWORDS.map((k) => k.toLowerCase());
  const scored: ScoredCandidate[] = [];

  for (const candidate of subredditChecked) {
    try {
      const result = await generateText({
        model: "anthropic/claude-sonnet-4.5" as never,
        system: `You are a relevance scorer for LucidRents, a rental intelligence platform. Score how relevant a Reddit thread is for a helpful, non-promotional reply that could mention lucidrents.com.

Return ONLY a JSON object with this structure:
{
  "directRelevance": 0.0-1.0,
  "valueOpportunity": 0.0-1.0,
  "threadActivity": 0.0-1.0,
  "naturalFit": 0.0-1.0
}

Scoring criteria:
- directRelevance (0.3 weight): Does this directly relate to rental data, landlords, building violations, tenant rights, or apartment searching?
- valueOpportunity (0.3 weight): Can we add genuine value with real data (violation records, building info, tenant rights)?
- threadActivity (0.2 weight): Is this thread getting engagement? (score > 5, or num_comments > 3 = higher)
- naturalFit (0.2 weight): Can we mention lucidrents.com without feeling forced or spammy?`,
        prompt: `Subreddit: r/${candidate.subreddit}
Title: ${candidate.title}
Body: ${candidate.selftext.slice(0, 1000)}
Score: ${candidate.score} | Comments: ${candidate.numComments}`,
        maxTokens: 300,
      });

      let parsed: {
        directRelevance: number;
        valueOpportunity: number;
        threadActivity: number;
        naturalFit: number;
      };
      try {
        let text = result.text.trim();
        if (text.startsWith("```")) {
          text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        parsed = JSON.parse(text);
      } catch {
        console.log(
          JSON.stringify({
            step: "scoreRelevance",
            event: "parse_error",
            threadId: candidate.threadId,
          })
        );
        continue;
      }

      const weightedScore =
        parsed.directRelevance * 0.3 +
        parsed.valueOpportunity * 0.3 +
        parsed.threadActivity * 0.2 +
        parsed.naturalFit * 0.2;

      if (weightedScore < 0.5) {
        console.log(
          JSON.stringify({
            step: "scoreRelevance",
            event: "below_threshold",
            threadId: candidate.threadId,
            score: weightedScore,
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
        relevanceScore: Math.round(weightedScore * 100) / 100,
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

  const { generateText } = await import("ai");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const drafts: DraftEntry[] = [];

  for (const thread of qualified) {
    try {
      // Try to look up relevant building data if an address-like pattern exists
      let buildingContext = "";
      const addressMatch = (thread.title + " " + thread.selftext).match(
        /\d+\s+[\w\s]+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|pl|place|way|ln|lane)\b/i
      );

      if (addressMatch) {
        const { data: buildings } = await supabase
          .from("buildings")
          .select("address, city, violation_count, owner_name")
          .ilike("address", `%${addressMatch[0].trim()}%`)
          .limit(3);

        if (buildings && buildings.length > 0) {
          buildingContext = `\n\nRELEVANT BUILDING DATA FROM LUCIDRENTS:\n${buildings
            .map(
              (b) =>
                `- ${b.address}, ${b.city}: ${b.violation_count ?? 0} violations, owner: ${b.owner_name ?? "unknown"}`
            )
            .join("\n")}`;
        }
      }

      const subredditTone = getSubredditTone(thread.subreddit);

      const result = await generateText({
        model: "anthropic/claude-sonnet-4.5" as never,
        system:
          REDDIT_SYSTEM_PROMPT +
          `\n\nSUBREDDIT TONE for r/${thread.subreddit}: ${subredditTone}`,
        prompt: `THREAD in r/${thread.subreddit}:
Title: ${thread.title}
Body: ${thread.selftext}
Thread score: ${thread.score} | Comments: ${thread.numComments}
${buildingContext}

Write a helpful Reddit reply. Lead with value. Be genuine. If there is relevant building data above, weave it in naturally. Only mention lucidrents.com if it fits as a natural next step (e.g., "you can look up any building's violation history at lucidrents.com").

Reply:`,
        maxTokens: 800,
      });

      drafts.push({
        threadId: thread.threadId,
        subreddit: thread.subreddit,
        title: thread.title,
        url: thread.url,
        draftReply: result.text.trim(),
        relevanceScore: thread.relevanceScore,
        keywordsMatched: thread.keywordsMatched,
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

async function postReply(
  id: string,
  subreddit: string,
  editedReply?: string
): Promise<void> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "postReply", event: "start", id }));

  // Re-check all rate limits before posting
  const limits = await checkAllLimits(subreddit);

  if (!limits.canPost && limits.waitSeconds && limits.waitSeconds > 0) {
    // Wait time available -- we'll return and let the workflow sleep
    console.log(
      JSON.stringify({
        step: "postReply",
        event: "must_wait",
        waitSeconds: limits.waitSeconds,
      })
    );
    throw new RetryableError(
      `WAIT:${limits.waitSeconds}:Must wait before posting (rate limit gap)`
    );
  }

  if (!limits.canPost) {
    console.log(
      JSON.stringify({
        step: "postReply",
        event: "limit_reached",
        reason: limits.reason,
      })
    );
    await updateRedditThread(id, { status: "skipped" });
    return;
  }

  // Get the thread from DB to retrieve the draft reply and thread ID
  const { getRedditThread } = await import(
    "@/lib/marketing/supabase-queries"
  );
  const thread = await getRedditThread(id);
  if (!thread) {
    throw new FatalError(`Reddit thread ${id} not found in DB`);
  }

  const replyText = editedReply ?? thread.draft_reply ?? "";
  if (!replyText) {
    throw new FatalError(`No reply text for thread ${id}`);
  }

  // Post to Reddit via OAuth API
  const accessToken = process.env.REDDIT_ACCESS_TOKEN;
  if (!accessToken) {
    throw new FatalError(
      "REDDIT_ACCESS_TOKEN env var not set -- cannot post replies"
    );
  }

  const res = await fetch("https://oauth.reddit.com/api/comment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LucidRents/1.0 (marketing-poster)",
    },
    body: new URLSearchParams({
      thing_id: thread.thread_id, // fullname e.g. t3_abc123
      text: replyText,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new FatalError(
        `Reddit auth error (${res.status}): ${body.slice(0, 200)}`
      );
    }
    throw new RetryableError(
      `Reddit API error (${res.status}): ${body.slice(0, 200)}`
    );
  }

  // Update DB status
  await updateRedditThread(id, {
    status: "replied",
    repliedAt: new Date().toISOString(),
    ...(editedReply ? { draftReply: editedReply } : {}),
  });

  console.log(
    JSON.stringify({ step: "postReply", event: "done", id, ms: Date.now() - t0 })
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
