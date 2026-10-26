-- Leaderboard A/B test: page numbers against infinite scroll.
-- The app creates this table on first use (src/lib/rank-test.ts); this file documents it.
create table if not exists rank_scroll_test (
  user_id bigint primary key,
  login text not null,
  variant text not null check (variant in ('pages', 'infinite')),
  views integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  choice text check (choice in ('keep', 'switch')),
  mode text check (mode in ('pages', 'infinite')),
  answered_at timestamptz
);
