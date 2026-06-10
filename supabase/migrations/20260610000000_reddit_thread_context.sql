-- Store the original Reddit post body + engagement stats so reviewers can
-- read what they're replying to (Mission Control previously showed only the
-- title), and so draft regeneration has the full thread context.
ALTER TABLE marketing_reddit_threads
  ADD COLUMN IF NOT EXISTS selftext text,
  ADD COLUMN IF NOT EXISTS post_score int,
  ADD COLUMN IF NOT EXISTS num_comments int;
