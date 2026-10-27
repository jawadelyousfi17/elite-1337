-- Mobile leaderboard filter dialog: one row each time it is opened and closed.
-- The app creates this table on first use (src/lib/filter-stats.ts); this file documents it.
create table if not exists filter_sessions (
  id bigserial primary key,
  user_id bigint not null,
  page text not null,
  clicks integer not null,
  duration_ms integer not null,
  ended text not null,           -- close button, outside (backdrop), button (filter icon), left (page left while open)
  created_at timestamptz not null default now()
);
