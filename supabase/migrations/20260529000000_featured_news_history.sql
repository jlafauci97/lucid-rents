-- Tracks every entity (building / landlord / neighborhood) featured in an
-- auto-generated news article, so the generator can enforce long cooldowns and
-- round-robin across the whole portfolio instead of re-featuring the same few
-- top-scoring entities. This is the durable anti-repetition backbone; the cron
-- route consults it before drafting and writes a row after each publish.
create table if not exists public.featured_news_history (
  id uuid primary key default gen_random_uuid(),
  metro text not null,
  -- 'building' | 'landlord' | 'neighborhood'
  entity_type text not null,
  -- normalized key: building id, lowercased landlord name, lowercased neighborhood
  entity_key text not null,
  signal_type text not null,
  article_id uuid references public.news_articles(id) on delete set null,
  featured_at timestamptz not null default now()
);

-- Cooldown lookups are always (metro, entity_type, entity_key) ordered by recency.
create index if not exists featured_news_history_lookup
  on public.featured_news_history (metro, entity_type, entity_key, featured_at desc);
