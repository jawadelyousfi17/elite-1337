-- Navigation A/B test: "XP calculator" in place of "Offers" for half the students.
-- The app creates this table on first use (src/lib/nav-test.ts); this file documents it.
create table if not exists nav_test (
  user_id bigint primary key,
  login text not null,
  variant text not null check (variant in ('offers', 'xp')),
  sessions integer not null default 0,          -- browser sessions in which the nav was shown
  xp_clicks integer not null default 0,         -- clicks on the "XP calculator" link
  offers_clicks integer not null default 0,     -- clicks on the "Offers" link
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  first_xp_at timestamptz
);
