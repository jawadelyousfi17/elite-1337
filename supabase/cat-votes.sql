-- Run once in the Supabase SQL editor (same project as avatars.sql).
-- One row per student: voting again replaces the previous pick.
create table if not exists public.cat_votes (
  user_id bigint primary key check (user_id > 0),
  cat text not null check (cat in ('mochi', 'oreo', 'tux', 'kiwi', 'domino', 'tiger')),
  updated_at timestamptz not null default now()
);

alter table public.cat_votes enable row level security;
-- No anon/authenticated policies: only the server-side service role reads or writes votes.
