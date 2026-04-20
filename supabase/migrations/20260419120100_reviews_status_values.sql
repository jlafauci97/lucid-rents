-- Ensure reviews has an updated_at column (used by moderation).
alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

-- Drop any existing CHECK constraint on status so 'flagged'/'removed' are accepted.
-- Runs as a DO block so it's safe whether or not the constraint exists.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end$$;

-- Add back a permissive CHECK that allows all moderation states.
-- Includes legacy 'approved' value (119 existing rows as of 2026-04-19) so the
-- constraint doesn't reject existing data. Treat 'approved' as equivalent to
-- 'published' in app logic.
alter table public.reviews
  add constraint reviews_status_check
  check (status in ('draft','published','approved','flagged','removed'));

create index if not exists reviews_status_created_idx
  on public.reviews(status, created_at desc);
