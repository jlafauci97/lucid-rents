create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- No policies added: service-role bypasses RLS, anon/authenticated have no access.

-- Backfill one row per existing user.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Auto-insert on new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists user_profiles_deleted_at_idx on public.user_profiles(deleted_at) where deleted_at is null;
