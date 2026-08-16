-- Self-posts now go through the same human gate as replies: the mission
-- control UI moves a draft to 'approved', and only approved self-posts are
-- served to the Mac mini poster. Previously drafts published unattended.
ALTER TABLE public.marketing_reddit_posts
  DROP CONSTRAINT IF EXISTS marketing_reddit_posts_status_check;

ALTER TABLE public.marketing_reddit_posts
  ADD CONSTRAINT marketing_reddit_posts_status_check
  CHECK (status IN ('draft', 'approved', 'posted', 'rejected'));
